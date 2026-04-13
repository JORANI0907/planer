import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendMessage, getKSTDate, formatDateKey, formatKSTDateLabel } from '@/lib/telegram'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = getKSTDate(0)
  const dayKey = formatDateKey(today)
  const label = formatKSTDateLabel(today)

  const { data: items } = await supabase
    .from('plan_items')
    .select('*')
    .eq('level', 'daily')
    .eq('period_key', dayKey)
    .order('sort_order')

  const list = items ?? []
  const total = list.length
  const done = list.filter(i => i.status === 'completed').length
  const pending = list.filter(i => i.status === 'pending')

  let text = `☀️ <b>JORANI 아침 브리핑</b>\n`
  text += `📅 ${label}\n\n`

  if (total === 0) {
    text += `오늘 등록된 일정이 없습니다.\n`
    text += `\n플래너에서 일정을 추가해보세요! 📝`
  } else {
    text += `📋 <b>오늘 일정 (${total}개)</b>\n`
    pending.forEach((item, i) => {
      text += `${i + 1}. ${item.title}\n`
    })
    if (done > 0) {
      text += `\n✅ 이미 완료: ${done}개`
    }
    text += `\n\n💪 오늘도 화이팅입니다!`
  }

  await sendMessage(text)
  return NextResponse.json({ ok: true, dayKey, total })
}
