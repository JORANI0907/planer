import type { PlanLevel } from './types'

// ─── period_key 파싱 결과 타입 ───────────────────────────────

export interface ParsedAnnual {
  type: 'annual'
  year: number
}

export interface ParsedQuarterly {
  type: 'quarterly'
  year: number
  quarter: number
}

export interface ParsedMonthly {
  type: 'monthly'
  year: number
  month: number
  quarter: number
}

export interface ParsedWeekly {
  type: 'weekly'
  year: number
  week: number
  month: number
  quarter: number
}

export interface ParsedDaily {
  type: 'daily'
  year: number
  month: number
  day: number
  quarter: number
  week: number
}

export type ParsedPeriod =
  | ParsedAnnual
  | ParsedQuarterly
  | ParsedMonthly
  | ParsedWeekly
  | ParsedDaily

// ─── 주차 → 월 계산 ──────────────────────────────────────────

function weekToMonth(year: number, week: number): number {
  // ISO week: Jan 4 항상 week 1에 포함
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = (jan4.getDay() + 6) % 7
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - dayOfWeek)

  const start = new Date(startOfWeek1)
  start.setDate(start.getDate() + (week - 1) * 7)

  // 해당 주차의 수요일(index 2) 기준으로 월 결정
  const wednesday = new Date(start)
  wednesday.setDate(start.getDate() + 2)
  return wednesday.getMonth() + 1
}

// ─── parsePeriodKey ──────────────────────────────────────────

export function parsePeriodKey(periodKey: string): ParsedPeriod | null {
  // '2026' — annual
  if (/^\d{4}$/.test(periodKey)) {
    const year = parseInt(periodKey, 10)
    return { type: 'annual', year }
  }

  // '2026-Q1' — quarterly
  const quarterMatch = periodKey.match(/^(\d{4})-Q(\d)$/)
  if (quarterMatch) {
    const year = parseInt(quarterMatch[1], 10)
    const quarter = parseInt(quarterMatch[2], 10)
    return { type: 'quarterly', year, quarter }
  }

  // '2026-03' — monthly
  const monthMatch = periodKey.match(/^(\d{4})-(\d{2})$/)
  if (monthMatch) {
    const year = parseInt(monthMatch[1], 10)
    const month = parseInt(monthMatch[2], 10)
    const quarter = Math.ceil(month / 3)
    return { type: 'monthly', year, month, quarter }
  }

  // '2026-W12' — weekly
  const weekMatch = periodKey.match(/^(\d{4})-W(\d{2})$/)
  if (weekMatch) {
    const year = parseInt(weekMatch[1], 10)
    const week = parseInt(weekMatch[2], 10)
    const month = weekToMonth(year, week)
    const quarter = Math.ceil(month / 3)
    return { type: 'weekly', year, week, month, quarter }
  }

  // '2026-03-15' — daily
  const dayMatch = periodKey.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dayMatch) {
    const year = parseInt(dayMatch[1], 10)
    const month = parseInt(dayMatch[2], 10)
    const day = parseInt(dayMatch[3], 10)
    const quarter = Math.ceil(month / 3)
    const week = getISOWeek(new Date(year, month - 1, day))
    return { type: 'daily', year, month, day, quarter, week }
  }

  return null
}

// ─── formatPeriodLabel ───────────────────────────────────────

const DAY_KOR = ['일', '월', '화', '수', '목', '금', '토']

export function formatPeriodLabel(periodKey: string): string {
  const parsed = parsePeriodKey(periodKey)
  if (!parsed) return periodKey

  switch (parsed.type) {
    case 'annual':
      return `${parsed.year}년`
    case 'quarterly':
      return `${parsed.quarter}분기`
    case 'monthly':
      return `${parsed.month}월`
    case 'weekly':
      return `${parsed.week}주차`
    case 'daily': {
      const dow = new Date(parsed.year, parsed.month - 1, parsed.day).getDay()
      return `${parsed.month}/${parsed.day}(${DAY_KOR[dow]})`
    }
  }
}

// ─── getParentPeriodKey ──────────────────────────────────────

export function getParentPeriodKey(periodKey: string): string | null {
  const parsed = parsePeriodKey(periodKey)
  if (!parsed) return null

  switch (parsed.type) {
    case 'annual':
      return null
    case 'quarterly':
      return `${parsed.year}`
    case 'monthly': {
      const q = Math.ceil(parsed.month / 3)
      return `${parsed.year}-Q${q}`
    }
    case 'weekly': {
      const mm = String(parsed.month).padStart(2, '0')
      return `${parsed.year}-${mm}`
    }
    case 'daily': {
      const ww = String(parsed.week).padStart(2, '0')
      return `${parsed.year}-W${ww}`
    }
  }
}

// ─── 레벨별 하위 period_key 목록 생성 ────────────────────────

export function getChildPeriodKeys(periodKey: string): string[] {
  const parsed = parsePeriodKey(periodKey)
  if (!parsed) return []

  switch (parsed.type) {
    case 'annual':
      return [1, 2, 3, 4].map(q => `${parsed.year}-Q${q}`)

    case 'quarterly': {
      const startMonth = (parsed.quarter - 1) * 3 + 1
      return [0, 1, 2].map(i => {
        const m = startMonth + i
        return `${parsed.year}-${String(m).padStart(2, '0')}`
      })
    }

    case 'monthly': {
      return getWeeksForMonth(parsed.year, parsed.month)
    }

    case 'weekly': {
      return getDaysForWeek(parsed.year, parsed.week)
    }

    case 'daily':
      return []
  }
}

function getDaysForWeek(year: number, week: number): string[] {
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = (jan4.getDay() + 6) % 7
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - dayOfWeek)
  const start = new Date(startOfWeek1)
  start.setDate(start.getDate() + (week - 1) * 7)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })
}

function getWeeksForMonth(year: number, month: number): string[] {
  const lastDay = new Date(year, month, 0).getDate()
  const seen = new Set<number>()
  const weeks: string[] = []

  for (let d = 1; d <= lastDay; d++) {
    const wn = getISOWeek(new Date(year, month - 1, d))
    if (seen.has(wn)) continue
    seen.add(wn)

    // 수요일 기준으로 해당 월 소속 결정
    const wednesday = getWeekWednesday(year, wn)
    if (wednesday.getMonth() + 1 === month) {
      weeks.push(`${year}-W${String(wn).padStart(2, '0')}`)
    }
  }
  return weeks
}

function getWeekWednesday(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = (jan4.getDay() + 6) % 7
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - dayOfWeek)
  const start = new Date(startOfWeek1)
  start.setDate(start.getDate() + (week - 1) * 7)
  const wednesday = new Date(start)
  wednesday.setDate(start.getDate() + 2)
  return wednesday
}

function getISOWeek(date: Date): number {
  const tmp = new Date(date.getTime())
  tmp.setHours(0, 0, 0, 0)
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7))
  const week1 = new Date(tmp.getFullYear(), 0, 4)
  return (
    1 +
    Math.round(
      ((tmp.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  )
}

// ─── level → 하위 레벨 ──────────────────────────────────────

export function getChildLevel(level: PlanLevel): PlanLevel | null {
  const map: Partial<Record<PlanLevel, PlanLevel>> = {
    annual: 'quarterly',
    quarterly: 'monthly',
    monthly: 'weekly',
    weekly: 'daily',
  }
  return map[level] ?? null
}

// ─── period_key → level 추론 ─────────────────────────────────

export function inferLevel(periodKey: string): PlanLevel | null {
  const parsed = parsePeriodKey(periodKey)
  if (!parsed) return null
  return parsed.type as PlanLevel
}
