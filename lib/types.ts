export type PlanLevel = 'annual' | 'quarterly' | 'monthly' | 'weekly' | 'daily'
export type PlanStatus = 'pending' | 'in_progress' | 'completed' | 'on_hold'
export type PlanPriority = 'high' | 'medium' | 'low'
export type AgeGroup = '30대' | '40대' | '50대' | '60대'
export type GoalProgress = '1.진행 중' | '2.아이디어' | '3.완료'
export type GoalType = '가족목표' | '개인목표' | '사업목표'

export const CATEGORIES = [
  { value: '사업', label: '💼 사업', color: 'bg-blue-100 text-blue-800' },
  { value: '건강운동', label: '🏃 건강/운동', color: 'bg-green-100 text-green-800' },
  { value: '독서자기계발', label: '📚 독서/자기계발', color: 'bg-purple-100 text-purple-800' },
  { value: '투자경매', label: '🏠 투자/경매', color: 'bg-yellow-100 text-yellow-800' },
  { value: '개인가족', label: '❤️ 개인/가족', color: 'bg-pink-100 text-pink-800' },
] as const

export const STATUS_CONFIG = {
  pending: { label: '미시작', color: 'bg-gray-100 text-gray-600' },
  in_progress: { label: '진행중', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '완료', color: 'bg-green-100 text-green-700' },
  on_hold: { label: '보류', color: 'bg-orange-100 text-orange-700' },
} as const

export const PRIORITY_CONFIG = {
  high: { label: '높음', color: 'text-red-600' },
  medium: { label: '중간', color: 'text-yellow-600' },
  low: { label: '낮음', color: 'text-gray-400' },
} as const

export const GOAL_PROGRESS_CONFIG: Record<GoalProgress, { label: string; color: string }> = {
  '1.진행 중': { label: '진행 중', color: 'bg-red-100 text-red-700' },
  '2.아이디어': { label: '아이디어', color: 'bg-purple-100 text-purple-700' },
  '3.완료': { label: '완료', color: 'bg-blue-100 text-blue-700' },
}

export const GOAL_TYPE_CONFIG: Record<GoalType, { label: string; color: string; icon: string }> = {
  '가족목표': { label: '가족목표', color: 'bg-green-100 text-green-700', icon: '❤️' },
  '개인목표': { label: '개인목표', color: 'bg-orange-100 text-orange-700', icon: '🙋' },
  '사업목표': { label: '사업목표', color: 'bg-blue-100 text-blue-700', icon: '💼' },
}

export interface LifeGoal {
  id: string
  notion_id: string | null
  title: string
  age_group: AgeGroup
  progress: GoalProgress
  goal_type: GoalType | null
  target_date: string | null
  birthday: string | null
  start_value: number | null
  end_value: number | null
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface LifeGoalAnnualMapping {
  id: string
  life_goal_id: string
  annual_period_key: string
  note: string | null
  created_at: string
}

export interface PlanItem {
  id: string
  level: PlanLevel
  period_key: string
  title: string
  description: string | null
  categories: string[]
  status: PlanStatus
  priority: PlanPriority
  sort_order: number
  parent_plan_item_id: string | null
  section_id: string | null
  created_at: string
  updated_at: string
}

export interface PlanMapping {
  id: string
  parent_item_id: string
  child_period_key: string
  child_note: string | null
  created_at: string
}

export interface PlanSection {
  id: string
  year: number
  title: string
  color: string
  sort_order: number
  created_at: string
}

export interface PlanItemTask {
  id: string
  plan_item_id: string
  title: string
  is_completed: boolean
  sort_order: number
  created_at: string
}

export interface Profile {
  id: string
  name: string
  birthday: string | null
  physical_abilities: string[]
  computer_skills: string[]
  other_certificates: string[]
  social_career: string[]
  other_career: string[]
  religion: string[]
  memo: string | null
  created_at: string
  updated_at: string
}

// 헬퍼 함수
export function getQuarterKey(year: number, quarter: number) {
  return `${year}-Q${quarter}`
}

export function getMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function getDayKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function getWeekKey(year: number, week: number) {
  return `${year}-W${String(week).padStart(2, '0')}`
}

export function getQuarterMonths(year: number, quarter: number): string[] {
  const startMonth = (quarter - 1) * 3 + 1
  return [startMonth, startMonth + 1, startMonth + 2].map(m => getMonthKey(year, m))
}

export function getMonthWeeks(year: number, month: number): string[] {
  // 수요일(index 2)이 해당 월에 속하는 주차만 포함
  // → 월 경계에 걸치는 주는 수요일 기준으로 어느 월에 표기할지 결정
  const lastDay = new Date(year, month, 0).getDate()
  const seen = new Set<number>()
  const weeks: string[] = []
  for (let d = 1; d <= lastDay; d++) {
    const wn = getISOWeek(new Date(year, month - 1, d))
    if (seen.has(wn)) continue
    seen.add(wn)
    const wDays = getWeekDays(year, wn)
    const wednesday = new Date(wDays[2]) // 0=Mon … 2=Wed … 6=Sun
    if (wednesday.getMonth() + 1 === month) {
      weeks.push(getWeekKey(year, wn))
    }
  }
  return weeks
}

export function getWeekDays(year: number, week: number): string[] {
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = (jan4.getDay() + 6) % 7
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - dayOfWeek)
  const start = new Date(startOfWeek1)
  start.setDate(start.getDate() + (week - 1) * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return getDayKey(d.getFullYear(), d.getMonth() + 1, d.getDate())
  })
}

function getISOWeek(date: Date): number {
  const tmp = new Date(date.getTime())
  tmp.setHours(0, 0, 0, 0)
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7))
  const week1 = new Date(tmp.getFullYear(), 0, 4)
  return (
    1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  )
}

export function getISOWeekPublic(date: Date): number {
  return getISOWeek(date)
}

export function getCurrentYear() { return new Date().getFullYear() }
export function getCurrentMonth() { return new Date().getMonth() + 1 }
export function getCurrentQuarter() { return Math.ceil(getCurrentMonth() / 3) }

// 완료 나이 계산
export function calcCompletionAge(birthday: string, targetDate: string): number {
  const birth = new Date(birthday)
  const target = new Date(targetDate)
  return target.getFullYear() - birth.getFullYear()
}

// 마감까지 남은 일수 계산
export function calcDaysLeft(targetDate: string): number {
  const today = new Date()
  const target = new Date(targetDate)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

// 진행상황 계산 (%)
export function calcProgressPct(startValue: number | null, endValue: number | null, currentValue?: number | null): number | null {
  if (startValue == null || endValue == null || endValue === 0) return null
  const current = currentValue ?? startValue
  return Math.round(((current - startValue) / (endValue - startValue)) * 100)
}
