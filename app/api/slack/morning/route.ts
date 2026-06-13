import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

function getKSTDateKey(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const y = kst.getUTCFullYear()
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kst.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatKSTLabel(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const dow = days[kst.getUTCDay()]
  return `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일 (${dow})`
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const slackUrl = process.env.SLACK_WEBHOOK_URL
  if (!slackUrl) {
    return NextResponse.json({ error: 'SLACK_WEBHOOK_URL not set' }, { status: 500 })
  }

  const dayKey = getKSTDateKey()
  const label = formatKSTLabel()

  const { data: items, error } = await supabase
    .from('plan_items')
    .select('title, status, scheduled_time, priority')
    .eq('level', 'daily')
    .eq('period_key', dayKey)
    .order('sort_order')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const list = items ?? []
  const total = list.length
  const done = list.filter(i => i.status === 'completed').length
  const remaining = list.filter(i => i.status !== 'completed')

  // 시간 있는 항목 먼저, 그 다음 시간 없는 항목
  const timed = remaining
    .filter(i => i.scheduled_time)
    .sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))
  const untimed = remaining.filter(i => !i.scheduled_time)

  const priorityEmoji = (p: string) => p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '⚪'

  let text = `☀️ *JORANI 아침 브리핑*\n📅 ${label}\n\n`

  if (total === 0) {
    text += `오늘 등록된 일정이 없습니다.\n플래너에서 일정을 추가해보세요! 📝`
  } else {
    text += `📋 *오늘 일정 (${total}개 · 완료 ${done}개)*\n\n`

    if (timed.length > 0) {
      text += `⏰ *시간 지정 일정*\n`
      timed.forEach(item => {
        text += `${priorityEmoji(item.priority)} \`${item.scheduled_time}\` ${item.title}\n`
      })
      text += '\n'
    }

    if (untimed.length > 0) {
      text += `📌 *시간 미지정 일정*\n`
      untimed.forEach(item => {
        text += `${priorityEmoji(item.priority)} ${item.title}\n`
      })
    }

    if (remaining.length === 0) {
      text += `✅ 모든 일정이 완료되었습니다! 대단해요! 🎉`
    } else {
      text += `\n💪 오늘도 화이팅! (남은 일정 ${remaining.length}개)`
    }
  }

  try {
    const res = await fetch(slackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) throw new Error(`Slack responded ${res.status}`)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  return NextResponse.json({ ok: true, dayKey, total, remaining: remaining.length })
}
