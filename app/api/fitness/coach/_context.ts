import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type SetRow = { exercise_name: string; weight_kg: number; reps: number; created_at: string; session_id: string }
type SessionRow = { date: string; split_name: string | null; is_completed: boolean; duration_min: number | null }
type DietRow = { date: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; water_l: number; memo?: string }
type DietPlanRow = { calories: number; protein_g: number; carbs_g: number; fat_g: number; water_l: number; memo?: string }
type ProgramRow = { name: string; description?: string }
type ProfileRow = { weight_kg: number | null; height_cm: number | null; age: number | null; goal: string; weekly_days: number; experience_level: string; notes: string | null }

const COMPOUNDS = ['벤치프레스', '데드리프트', '스쿼트', '오버헤드프레스', '바벨로우']

function inferMuscleGroup(name: string): string {
  if (/벤치|체스트|가슴|플라이|딥스/.test(name)) return '가슴'
  if (/데드|로우|풀업|랫|렛|등|시티드/.test(name)) return '등'
  if (/오버헤드|숄더|어깨|레터럴|프론트/.test(name)) return '어깨'
  if (/스쿼트|레그|하체|런지|힙|글루트|핵|파워/.test(name)) return '하체'
  if (/트라이셉|삼두/.test(name)) return '삼두'
  if (/바이셉|이두|컬/.test(name)) return '이두'
  if (/크런치|플랭크|복근/.test(name)) return '복근'
  return '기타'
}

export async function buildContext(): Promise<string> {
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0]
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  // 이번 주 월요일
  const weekStart = new Date()
  const dayOfWeek = weekStart.getDay()
  weekStart.setDate(weekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  const weekStartStr = weekStart.toISOString().split('T')[0]

  const [
    { data: sessions },
    { data: dietPlan },
    { data: activeProgram },
    { data: recentSets },
    { data: profile },
    { data: recentDiets },
  ] = await Promise.all([
    supabase.from('fitness_sessions').select('date,split_name,duration_min,is_completed').gte('date', twoWeeksAgo).order('date', { ascending: false }).limit(20),
    supabase.from('fitness_diet_plan').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('fitness_programs').select('name,description').eq('is_active', true).maybeSingle(),
    supabase.from('fitness_sets').select('exercise_name,weight_kg,reps,created_at,session_id').order('created_at', { ascending: false }).limit(200),
    supabase.from('fitness_profile').select('weight_kg,height_cm,age,goal,weekly_days,experience_level,notes').limit(1).maybeSingle(),
    supabase.from('fitness_diet').select('date,calories,protein_g,carbs_g,fat_g,water_l,memo').gte('date', threeDaysAgo).order('date', { ascending: false }).limit(3),
  ])

  // 컴파운드 최고 1RM + 세션별 추세
  const compound1RMs: Record<string, number> = {}
  const compoundSessionBest: Record<string, { sessionId: string; rm: number }[]> = {}
  // 전 종목 최고 기록
  const allExercises: Record<string, { weight: number; reps: number }> = {}
  // 2주간 근육군별 세트 수
  const muscleGroupSets: Record<string, number> = {}

  for (const set of (recentSets ?? []) as SetRow[]) {
    const rm = Math.round(set.weight_kg * (1 + set.reps / 30))

    if (COMPOUNDS.includes(set.exercise_name)) {
      if (!compound1RMs[set.exercise_name] || rm > compound1RMs[set.exercise_name]) {
        compound1RMs[set.exercise_name] = rm
      }
      if (!compoundSessionBest[set.exercise_name]) compoundSessionBest[set.exercise_name] = []
      const list = compoundSessionBest[set.exercise_name]
      const idx = list.findIndex(e => e.sessionId === set.session_id)
      if (idx === -1 && list.length < 3) {
        list.push({ sessionId: set.session_id, rm })
      } else if (idx !== -1 && rm > list[idx].rm) {
        list[idx].rm = rm
      }
    }

    const ex = allExercises[set.exercise_name]
    const exRM = ex ? Math.round(ex.weight * (1 + ex.reps / 30)) : 0
    if (!ex || rm > exRM) allExercises[set.exercise_name] = { weight: set.weight_kg, reps: set.reps }

    const mg = inferMuscleGroup(set.exercise_name)
    muscleGroupSets[mg] = (muscleGroupSets[mg] ?? 0) + 1
  }

  const p = profile as ProfileRow | null
  const profileLine = p
    ? [
        p.weight_kg != null ? `몸무게: ${p.weight_kg}kg` : null,
        p.height_cm != null ? `키: ${p.height_cm}cm` : null,
        p.age != null ? `나이: ${p.age}세` : null,
        `목표: ${p.goal}`,
        `운동 경력: ${p.experience_level}`,
        `주 ${p.weekly_days}회 계획`,
        p.notes ? `특이사항: ${p.notes}` : null,
      ].filter(Boolean).join(', ')
    : '프로필 미입력 (내 정보 탭에서 입력 필요)'

  const sessionList = (sessions ?? []) as SessionRow[]
  const thisWeekCount = sessionList.filter(s => s.date >= weekStartStr && s.is_completed).length

  const lines: string[] = [
    '=== 사용자 프로필 ===',
    profileLine,
    '',
    '=== 현재 프로그램 ===',
    activeProgram
      ? `${(activeProgram as ProgramRow).name}${(activeProgram as ProgramRow).description ? ` (${(activeProgram as ProgramRow).description})` : ''}`
      : '프로그램 없음',
    '',
    `=== 최근 2주 운동 세션 (이번 주 완료: ${thisWeekCount}회) ===`,
  ]

  for (const s of sessionList) {
    const tag = s.date === today ? ' (오늘)' : ''
    lines.push(`- ${s.date}${tag} | ${s.split_name ?? '(분할 없음)'} | ${s.is_completed ? '완료' : '미완료'}${s.duration_min ? ` | ${s.duration_min}분` : ''}`)
  }
  if (!sessionList.length) lines.push('- 기록 없음')

  lines.push('', '=== 2주간 근육군별 세트 볼륨 ===')
  const muscleOrder = ['가슴', '등', '어깨', '하체', '이두', '삼두', '복근', '기타']
  const volumeEntries = muscleOrder.filter(mg => muscleGroupSets[mg])
  if (volumeEntries.length > 0) {
    for (const mg of volumeEntries) lines.push(`- ${mg}: ${muscleGroupSets[mg]}세트`)
  } else {
    lines.push('- 데이터 없음')
  }

  lines.push('', '=== 컴파운드 추정 1RM (추세) ===')
  const rmEntries = Object.entries(compound1RMs)
  if (rmEntries.length > 0) {
    for (const [name, rm] of rmEntries) {
      const trend = compoundSessionBest[name] ?? []
      let trendStr = ''
      if (trend.length >= 2) {
        const diff = trend[0].rm - trend[1].rm
        trendStr = diff > 2 ? ` ↑+${diff}kg` : diff < -2 ? ` ↓${diff}kg` : ' →유지'
      }
      lines.push(`- ${name}: ~${rm}kg${trendStr}`)
    }
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

  lines.push('', '=== 현재 식단 플랜 (목표치) ===')
  if (dietPlan) {
    const d = dietPlan as DietPlanRow
    lines.push(`칼로리: ${d.calories}kcal | 단백질: ${d.protein_g}g | 탄수화물: ${d.carbs_g}g | 지방: ${d.fat_g}g | 수분: ${d.water_l}L`)
    if (d.memo) lines.push(`메모: ${d.memo}`)
  } else {
    lines.push('- 식단 플랜 없음')
  }

  lines.push('', '=== 최근 3일 실제 식단 기록 ===')
  const diets = (recentDiets ?? []) as DietRow[]
  if (diets.length > 0) {
    for (const d of diets) {
      const tag = d.date === today ? ' (오늘)' : ''
      lines.push(`- ${d.date}${tag}: ${d.calories}kcal | 단백질 ${d.protein_g}g | 탄수 ${d.carbs_g}g | 지방 ${d.fat_g}g${d.memo ? ` | ${d.memo}` : ''}`)
    }
  } else {
    lines.push('- 기록 없음')
  }

  return lines.join('\n')
}
