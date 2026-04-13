import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendMessage, getKSTDate, formatDateKey, formatKSTDateLabel } from '@/lib/telegram'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tomorrow = getKSTDate(1)
  const dayKey = formatDateKey(tomorrow)
  const label = formatKSTDateLabel(tomorrow)

  const { data: items } = await supabase
    .from('plan_items')
    .select('*')
    .eq('level', 'daily')
    .eq('period_key', dayKey)
    .order('sort_order')

  const list = items ?? []

  let text = `🌙 <b>JORANI 저녁 브리핑</b>\n`
  text += `📅 내일: ${label}\n\n`

  if (list.length === 0) {
    text += `내일 등록된 일정이 없습니다.\n\n`
    text += `지금 플래너에서 내일 일정을 추가해보세요! 📝`
  } else {
    text += `📋 <b>내일 일정 (${list.length}개)</b>\n`
    list.forEach((item, i) => {
      const check = item.status === 'completed' ? '✅' : '⬜'
      text += `${check} ${i + 1}. ${item.title}\n`
    })
    text += `\n내일도 계획대로 진행해봐요! 💪`
  }

  await sendMessage(text)
  return NextResponse.json({ ok: true, dayKey, total: list.length })
}
