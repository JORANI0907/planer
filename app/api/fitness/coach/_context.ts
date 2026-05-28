import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type SetRow = { exercise_name: string; weight_kg: number; reps: number; created_at: string }
type SessionRow = { date: string; split_name: string | null; is_completed: boolean; duration_min: number | null }
type DietRow = { date: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; water_l: number; memo?: string }
type ProgramRow = { name: string; description?: string }

export async function buildContext(): Promise<string> {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  const [
    { data: sessions },
    { data: todayDiet },
    { data: recentDiet },
    { data: activeProgram },
    { data: recentSets },
  ] = await Promise.all([
    supabase.from('fitness_sessions').select('date,split_name,duration_min,is_completed').gte('date', weekAgo).order('date', { ascending: false }).limit(10),
    supabase.from('fitness_diet').select('*').eq('date', today).maybeSingle(),
    supabase.from('fitness_diet').select('*').order('date', { ascending: false }).limit(7),
    supabase.from('fitness_programs').select('name,description').eq('is_active', true).maybeSingle(),
    supabase.from('fitness_sets').select('exercise_name,weight_kg,reps,created_at').order('created_at', { ascending: false }).limit(100),
  ])

  const compound1RMs: Record<string, number> = {}
  const COMPOUNDS = ['벤치프레스', '데드리프트', '스쿼트', '오버헤드프레스', '바벨로우']
  const allExercises: Record<string, { weight: number; reps: number }> = {}

  for (const set of (recentSets ?? []) as SetRow[]) {
    const rm = Math.round(set.weight_kg * (1 + set.reps / 30))
    if (COMPOUNDS.includes(set.exercise_name)) {
      if (!compound1RMs[set.exercise_name] || rm > compound1RMs[set.exercise_name]) {
        compound1RMs[set.exercise_name] = rm
      }
    }
    const ex = allExercises[set.exercise_name]
    const exRM = ex ? Math.round(ex.weight * (1 + ex.reps / 30)) : 0
    if (!ex || rm > exRM) allExercises[set.exercise_name] = { weight: set.weight_kg, reps: set.reps }
  }

  const lines: string[] = [
    '=== 사용자 프로필 ===',
    '몸무게: 75kg, 키: 178cm, 목표: 근비대 (hypertrophy)',
    '',
    '=== 현재 프로그램 ===',
    activeProgram ? `${(activeProgram as ProgramRow).name}${(activeProgram as ProgramRow).description ? ` (${(activeProgram as ProgramRow).description})` : ''}` : '프로그램 없음',
    '',
    '=== 최근 1주일 운동 세션 ===',
  ]

  for (const s of (sessions ?? []) as SessionRow[]) {
    lines.push(`- ${s.date} | ${s.split_name ?? '(분할 없음)'} | ${s.is_completed ? '완료' : '미완료'}${s.duration_min ? ` | ${s.duration_min}분` : ''}`)
  }
  if (!sessions?.length) lines.push('- 기록 없음')

  lines.push('', '=== 컴파운드 추정 1RM ===')
  const rmEntries = Object.entries(compound1RMs)
  if (rmEntries.length > 0) {
    for (const [name, rm] of rmEntries) lines.push(`- ${name}: ~${rm}kg`)
  } else {
    lines.push('- 데이터 없음')
  }

  lines.push('', '=== 최근 운동 종목 최고 기록 ===')
  const exEntries = Object.entries(allExercises)
  if (exEntries.length > 0) {
    for (const [name, { weight, reps }] of exEntries) lines.push(`- ${name}: ${weight}kg × ${reps}회`)
  } else {
    lines.push('- 데이터 없음')
  }

  lines.push('', '=== 오늘 식단 ===')
  if (todayDiet) {
    const d = todayDiet as DietRow
    lines.push(`칼로리: ${d.calories}kcal | 단백질: ${d.protein_g}g | 탄수화물: ${d.carbs_g}g | 지방: ${d.fat_g}g | 수분: ${d.water_l}L`)
    if (d.memo) lines.push(`메모: ${d.memo}`)
  } else {
    lines.push('- 기록 없음')
  }

  lines.push('', '=== 최근 7일 식단 ===')
  for (const d of (recentDiet ?? []) as DietRow[]) {
    lines.push(`- ${d.date}: ${d.calories}kcal | 단백질 ${d.protein_g}g`)
  }
  if (!recentDiet?.length) lines.push('- 데이터 없음')

  return lines.join('\n')
}
