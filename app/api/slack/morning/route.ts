import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

function getKSTDateKey(offsetDays = 0): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000 + offsetDays * 86400000)
  const y = kst.getUTCFullYear()
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kst.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const dow = days[date.getDay()]
  return `${m}월 ${d}일 (${dow})`
}

const priorityEmoji = (p: string) => p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '⚪'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const slackUrl = process.env.SLACK_WEBHOOK_URL
  if (!slackUrl) {
    return NextResponse.json({ error: 'SLACK_WEBHOOK_URL not set' }, { status: 500 })
  }

  const dateKeys = [0, 1, 2].map(offset => getKSTDateKey(offset))

  const { data: items, error } = await supabase
    .from('plan_items')
    .select('title, status, scheduled_time, priority, period_key')
    .eq('level', 'daily')
    .in('period_key', dateKeys)
    .order('period_key')
    .order('sort_order')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const allItems = items ?? []

  // 오늘 날짜 기준 헤더
  const [todayKey] = dateKeys
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const weekDays = ['일', '월', '화', '수', '목', '금', '토']
  const todayFull = `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일 (${weekDays[kst.getUTCDay()]})`

  let text = `☀️ *JORANI 아침 브리핑*\n📅 ${todayFull}\n\n`

  const totalByDay: Record<string, number> = {}
  const remainingByDay: Record<string, number> = {}

  for (const dateKey of dateKeys) {
    const dayItems = allItems.filter(i => i.period_key === dateKey)
    const total = dayItems.length
    const done = dayItems.filter(i => i.status === 'completed').length
    const remaining = dayItems.filter(i => i.status !== 'completed')

    totalByDay[dateKey] = total
    remainingByDay[dateKey] = remaining.length

    const label = formatDateLabel(dateKey)
    const isToday = dateKey === todayKey

    text += isToday
      ? `📋 *오늘 ${label} — ${total}개 · 완료 ${done}개*\n`
      : `📅 *${label} — ${total}개*\n`

    if (total === 0) {
      text += `  등록된 일정 없음\n\n`
      continue
    }

    const timed = remaining
      .filter(i => i.scheduled_time)
      .sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))
    const untimed = remaining.filter(i => !i.scheduled_time)

    if (timed.length > 0) {
      timed.forEach(item => {
        text += `  ${priorityEmoji(item.priority)} \`${item.scheduled_time}\` ${item.title}\n`
      })
    }
    if (untimed.length > 0) {
      untimed.forEach(item => {
        text += `  ${priorityEmoji(item.priority)} ${item.title}\n`
      })
    }
    if (remaining.length === 0) {
      text += `  ✅ 모든 일정 완료!\n`
    }

    text += '\n'
  }

  const todayRemaining = remainingByDay[todayKey] ?? 0
  text += todayRemaining === 0
    ? `🎉 오늘 일정이 모두 완료되었습니다! 대단해요!`
    : `💪 오늘도 화이팅! (오늘 남은 일정 ${todayRemaining}개)`

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

  return NextResponse.json({
    ok: true,
    dates: dateKeys,
    total: Object.values(totalByDay).reduce((a, b) => a + b, 0),
    todayRemaining,
  })
}
