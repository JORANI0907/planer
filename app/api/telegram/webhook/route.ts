import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendMessage, getKSTDate, formatDateKey, formatKSTDateLabel } from '@/lib/telegram'

async function getTodayItems(dayKey: string) {
  const { data } = await supabase
    .from('plan_items')
    .select('*')
    .eq('level', 'daily')
    .eq('period_key', dayKey)
    .order('sort_order')
  return data ?? []
}

async function handleCommand(text: string, chatId: string) {
  const today = getKSTDate(0)
  const tomorrow = getKSTDate(1)
  const todayKey = formatDateKey(today)
  const tomorrowKey = formatDateKey(tomorrow)

  // 오늘 일정 조회
  if (text === '/today' || text === '/오늘' || text === '오늘 일정') {
    const items = await getTodayItems(todayKey)
    const label = formatKSTDateLabel(today)
    let msg = `📅 <b>${label} 일정</b>\n\n`
    if (items.length === 0) {
      msg += '등록된 일정이 없습니다.'
    } else {
      items.forEach((item, i) => {
        const check = item.status === 'completed' ? '✅' : '⬜'
        msg += `${check} ${i + 1}. ${item.title}\n`
      })
      const done = items.filter(i => i.status === 'completed').length
      msg += `\n완료: ${done}/${items.length}`
    }
    await sendMessage(msg, chatId)
    return
  }

  // 내일 일정 조회
  if (text === '/tomorrow' || text === '/내일' || text === '내일 일정') {
    const items = await getTodayItems(tomorrowKey)
    const label = formatKSTDateLabel(tomorrow)
    let msg = `📅 <b>내일 ${label} 일정</b>\n\n`
    if (items.length === 0) {
      msg += '등록된 일정이 없습니다.'
    } else {
      items.forEach((item, i) => {
        const check = item.status === 'completed' ? '✅' : '⬜'
        msg += `${check} ${i + 1}. ${item.title}\n`
      })
    }
    await sendMessage(msg, chatId)
    return
  }

  // 일정 추가 (예: "추가 오늘 헬스장 가기" 또는 "내일 추가 회의 준비")
  const addTodayMatch = text.match(/^(오늘\s*)?추가\s+(.+)$/) || text.match(/^추가\s+(오늘\s+)?(.+)$/)
  if (addTodayMatch) {
    const title = (addTodayMatch[2] || addTodayMatch[1] || '').trim()
    const existing = await getTodayItems(todayKey)
    await supabase.from('plan_items').insert({
      title, level: 'daily', period_key: todayKey,
      description: null, categories: [], status: 'pending',
      priority: 'medium', sort_order: existing.length,
    })
    await sendMessage(`✅ 오늘 일정에 추가했습니다!\n📝 <b>${title}</b>`, chatId)
    return
  }

  const addTomorrowMatch = text.match(/^내일\s*추가\s+(.+)$/) || text.match(/^추가\s+내일\s+(.+)$/)
  if (addTomorrowMatch) {
    const title = addTomorrowMatch[1].trim()
    const existing = await getTodayItems(tomorrowKey)
    await supabase.from('plan_items').insert({
      title, level: 'daily', period_key: tomorrowKey,
      description: null, categories: [], status: 'pending',
      priority: 'medium', sort_order: existing.length,
    })
    await sendMessage(`✅ 내일 일정에 추가했습니다!\n📝 <b>${title}</b>`, chatId)
    return
  }

  // 완료 처리 (예: "완료 1" 또는 "1 완료")
  const doneMatch = text.match(/^완료\s+(\d+)$/) || text.match(/^(\d+)\s*완료$/)
  if (doneMatch) {
    const idx = parseInt(doneMatch[1]) - 1
    const items = await getTodayItems(todayKey)
    if (idx >= 0 && idx < items.length) {
      await supabase.from('plan_items').update({ status: 'completed' }).eq('id', items[idx].id)
      await sendMessage(`✅ 완료 처리했습니다!\n<b>${items[idx].title}</b>`, chatId)
    } else {
      await sendMessage(`❌ ${idx + 1}번 일정을 찾을 수 없습니다.`, chatId)
    }
    return
  }

  // /start 또는 도움말
  if (text === '/start' || text === '/help' || text === '도움말') {
    const msg = `👋 <b>JORANI 일정 관리 비서입니다!</b>\n\n`
      + `사용 가능한 명령어:\n`
      + `📋 <b>오늘 일정</b> — 오늘 일정 조회\n`
      + `📋 <b>내일 일정</b> — 내일 일정 조회\n`
      + `➕ <b>추가 [내용]</b> — 오늘 일정 추가\n`
      + `➕ <b>내일 추가 [내용]</b> — 내일 일정 추가\n`
      + `✅ <b>완료 [번호]</b> — 일정 완료 처리\n\n`
      + `매일 ☀️ <b>06:00</b> 아침 브리핑\n`
      + `매일 🌙 <b>20:00</b> 저녁 브리핑`
    await sendMessage(msg, chatId)
    return
  }

  // 이해 못한 경우
  await sendMessage(`🤔 잘 모르겠어요. <b>도움말</b> 을 입력해보세요!`, chatId)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const message = body?.message
    if (!message?.text) return NextResponse.json({ ok: true })

    const text = message.text.trim()
    const chatId = String(message.chat.id)

    await handleCommand(text, chatId)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
