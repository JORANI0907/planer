export type ExerciseMuscleGroup = '가슴' | '등' | '어깨' | '하체' | '삼두' | '이두' | '복근' | '기타'

export interface FitnessExercise {
  id: string
  name: string
  muscle_group: ExerciseMuscleGroup
  is_compound: boolean
  sort_order: number
  created_at: string
}

export interface FitnessProgram {
  id: string
  name: string
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FitnessProgramSplit {
  id: string
  program_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface FitnessSession {
  id: string
  date: string
  split_id: string | null
  split_name: string
  program_name: string
  duration_min: number | null
  condition: number | null
  memo: string
  is_completed: boolean
  created_at: string
  updated_at: string
}

export interface FitnessSet {
  id: string
  session_id: string
  exercise_id: string | null
  exercise_name: string
  set_number: number
  weight_kg: number
  reps: number
  rpe: number | null
  created_at: string
}

export interface FitnessDiet {
  id: string
  date: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  water_l: number
  memo: string
  created_at: string
  updated_at: string
}

// 1RM 추정 (Epley 공식 — 추정치)
export function calc1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30))
}

export type ProgressTrend = 'up' | 'same' | 'down'

export function calcProgressTrend(prev: number, curr: number): ProgressTrend {
  if (curr > prev + 0.5) return 'up'
  if (curr < prev - 0.5) return 'down'
  return 'same'
}

export function getTodayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function getWeekStartDate(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 목표 매크로 (근비대 기준)
export const DIET_GOALS = {
  calories:  { min: 2800, max: 3000, label: '칼로리', unit: 'kcal' },
  protein_g: { min: 150,  max: 165,  label: '단백질', unit: 'g' },
  carbs_g:   { min: 350,  max: 400,  label: '탄수화물', unit: 'g' },
  fat_g:     { min: 70,   max: 80,   label: '지방', unit: 'g' },
  water_l:   { min: 2.5,  max: 3.0,  label: '수분', unit: 'L' },
} as const

export type DietGoalKey = keyof typeof DIET_GOALS

// 주요 컴파운드 종목 (강조 표시)
export const COMPOUND_HIGHLIGHTS = ['벤치프레스', '데드리프트', '스쿼트', '오버헤드프레스', '바벨로우'] as const

export interface FitnessProfile {
  id: string
  weight_kg: number | null
  height_cm: number | null
  age: number | null
  goal: string
  weekly_days: number
  experience_level: string
  notes: string | null
  updated_at: string
}

export interface FitnessCoachMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface SplitExercise extends FitnessExercise {
  target_sets: number
  target_reps: string
}

export const GOAL_OPTIONS = ['근비대', '린벌크', '컷팅', '유지'] as const
export const EXPERIENCE_OPTIONS = ['초급', '중급', '고급'] as const
export type FitnessGoal = typeof GOAL_OPTIONS[number]
export type ExperienceLevel = typeof EXPERIENCE_OPTIONS[number]

/** Mifflin-St Jeor (남성 기준) BMR */
export function calcBMR(weight: number, height: number, age: number): number {
  return Math.round(10 * weight + 6.25 * height - 5 * age + 5)
}

/** TDEE = BMR × 활동계수 */
export function calcTDEE(bmr: number, weeklyDays: number): number {
  const factor = weeklyDays >= 6 ? 1.725 : weeklyDays >= 4 ? 1.55 : weeklyDays >= 2 ? 1.375 : 1.2
  return Math.round(bmr * factor)
}

/** 목표별 권장 칼로리 */
export function calcGoalCalories(tdee: number, goal: string): number {
  if (goal === '린벌크') return tdee + 200
  if (goal === '근비대') return tdee + 300
  if (goal === '컷팅') return tdee - 400
  return tdee
}
