import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type SetRow = { exercise_name: string; weight_kg: number; reps: number; created_at: string }
type SessionRow = { date: string; split_name: string | null; is_completed: boolean; duration_min: number | null }
type DietRow = { calories: number; protein_g: number; carbs_g: number; fat_g: number; water_l: number; memo?: string }
type ProgramRow = { name: string; description?: string }
type ProfileRow = { weight_kg: number | null; height_cm: number | null; age: number | null; goal: string; weekly_days: number; experience_level: string; notes: string | null }

export async function buildContext(): Promise<string> {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  const [
    { data: sessions },
    { data: dietPlan },
    { data: activeProgram },
    { data: recentSets },
    { data: profile },
  ] = await Promise.all([
    supabase.from('fitness_sessions').select('date,split_name,duration_min,is_completed').gte('date', weekAgo).order('date', { ascending: false }).limit(10),
    supabase.from('fitness_diet_plan').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('fitness_programs').select('name,description').eq('is_active', true).maybeSingle(),
    supabase.from('fitness_sets').select('exercise_name,weight_kg,reps,created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('fitness_profile').select('weight_kg,height_cm,age,goal,weekly_days,experience_level,notes').limit(1).maybeSingle(),
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

  const p = profile as ProfileRow | null
  const profileLine = p
    ? [
        p.weight_kg != null ? `몸무게: ${p.weight_kg}kg` : null,
        p.height_cm != null ? `키: ${p.height_cm}cm` : null,
        p.age != null ? `나이: ${p.age}세` : null,
        `목표: ${p.goal}`,
        `운동 경력: ${p.experience_level}`,
        `주 ${p.weekly_days}회`,
        p.notes ? `특이사항: ${p.notes}` : null,
      ].filter(Boolean).join(', ')
    : '프로필 미입력 (내 정보 탭에서 입력 필요)'

  const lines: string[] = [
    '=== 사용자 프로필 ===',
    profileLine,
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

  lines.push('', '=== 현재 식단 플랜 ===')
  if (dietPlan) {
    const d = dietPlan as DietRow
    lines.push(`칼로리: ${d.calories}kcal | 단백질: ${d.protein_g}g | 탄수화물: ${d.carbs_g}g | 지방: ${d.fat_g}g | 수분: ${d.water_l}L`)
    if (d.memo) lines.push(`메모: ${d.memo}`)
  } else {
    lines.push('- 아직 식단 플랜 없음')
  }

  return lines.join('\n')
}
