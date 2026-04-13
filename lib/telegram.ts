const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!
const API = `https://api.telegram.org/bot${BOT_TOKEN}`

export async function sendMessage(text: string, chatId = CHAT_ID) {
  const res = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
  return res.json()
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getKSTDate(offsetDays = 0): Date {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  kst.setUTCDate(kst.getUTCDate() + offsetDays)
  return kst
}

export function formatKSTDateLabel(date: Date): string {
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1
  const d = date.getUTCDate()
  const dow = days[date.getUTCDay()]
  return `${y}년 ${m}월 ${d}일 (${dow})`
}
