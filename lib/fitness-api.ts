import { supabase } from '@/lib/supabase'
import {
  FitnessExercise, FitnessProgram, FitnessProgramSplit,
  FitnessSession, FitnessSet, FitnessDiet,
  calc1RM, calcProgressTrend, COMPOUND_HIGHLIGHTS,
  ProgressTrend, getWeekStartDate, getTodayKey,
} from '@/lib/fitness-types'

// ─── 운동 종목 ────────────────────────────────────────────

export async function getExercises(): Promise<FitnessExercise[]> {
  const { data, error } = await supabase
    .from('fitness_exercises')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function createExercise(
  input: Omit<FitnessExercise, 'id' | 'created_at'>
): Promise<FitnessExercise> {
  const { data, error } = await supabase
    .from('fitness_exercises')
    .insert([input])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateExercise(id: string, updates: Partial<FitnessExercise>): Promise<FitnessExercise> {
  const { data, error } = await supabase
    .from('fitness_exercises')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteExercise(id: string): Promise<void> {
  const { error } = await supabase.from('fitness_exercises').delete().eq('id', id)
  if (error) throw error
}

// ─── 프로그램 ────────────────────────────────────────────

export async function getPrograms(): Promise<FitnessProgram[]> {
  const { data, error } = await supabase
    .from('fitness_programs')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getActiveProgram(): Promise<FitnessProgram | null> {
  const { data, error } = await supabase
    .from('fitness_programs')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createProgram(
  input: Omit<FitnessProgram, 'id' | 'created_at' | 'updated_at'>
): Promise<FitnessProgram> {
  const { data, error } = await supabase
    .from('fitness_programs')
    .insert([input])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProgram(id: string, updates: Partial<FitnessProgram>): Promise<FitnessProgram> {
  const { data, error } = await supabase
    .from('fitness_programs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteProgram(id: string): Promise<void> {
  const { error } = await supabase.from('fitness_programs').delete().eq('id', id)
  if (error) throw error
}

export async function setActiveProgram(id: string): Promise<void> {
  const ts = new Date().toISOString()
  await supabase.from('fitness_programs').update({ is_active: false, updated_at: ts }).neq('id', id)
  await supabase.from('fitness_programs').update({ is_active: true, updated_at: ts }).eq('id', id)
}

// ─── 분할 ─────────────────────────────────────────────────

export async function getSplitsByProgram(programId: string): Promise<FitnessProgramSplit[]> {
  const { data, error } = await supabase
    .from('fitness_program_splits')
    .select('*')
    .eq('program_id', programId)
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function createSplit(
  input: Omit<FitnessProgramSplit, 'id' | 'created_at'>
): Promise<FitnessProgramSplit> {
  const { data, error } = await supabase
    .from('fitness_program_splits')
    .insert([input])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSplit(id: string, updates: Partial<FitnessProgramSplit>): Promise<FitnessProgramSplit> {
  const { data, error } = await supabase
    .from('fitness_program_splits')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSplit(id: string): Promise<void> {
  const { error } = await supabase.from('fitness_program_splits').delete().eq('id', id)
  if (error) throw error
}

// ─── 분할-종목 매핑 ────────────────────────────────────────

export async function getExercisesBySplit(splitId: string): Promise<FitnessExercise[]> {
  const { data, error } = await supabase
    .from('fitness_split_exercises')
    .select('sort_order, fitness_exercises(*)')
    .eq('split_id', splitId)
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map((row) => (row as unknown as { fitness_exercises: FitnessExercise }).fitness_exercises)
}

export async function addExerciseToSplit(splitId: string, exerciseId: string, sortOrder: number): Promise<void> {
  const { error } = await supabase
    .from('fitness_split_exercises')
    .insert([{ split_id: splitId, exercise_id: exerciseId, sort_order: sortOrder }])
  if (error) throw error
}

export async function removeExerciseFromSplit(splitId: string, exerciseId: string): Promise<void> {
  const { error } = await supabase
    .from('fitness_split_exercises')
    .delete()
    .eq('split_id', splitId)
    .eq('exercise_id', exerciseId)
  if (error) throw error
}

// ─── 세션 ─────────────────────────────────────────────────

export async function getSessions(limit = 20): Promise<FitnessSession[]> {
  const { data, error } = await supabase
    .from('fitness_sessions')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function getThisWeekSessions(): Promise<FitnessSession[]> {
  const { data, error } = await supabase
    .from('fitness_sessions')
    .select('*')
    .gte('date', getWeekStartDate())
    .lte('date', getTodayKey())
    .order('date', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createSession(
  input: Omit<FitnessSession, 'id' | 'created_at' | 'updated_at'>
): Promise<FitnessSession> {
  const { data, error } = await supabase
    .from('fitness_sessions')
    .insert([input])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSession(id: string, updates: Partial<FitnessSession>): Promise<FitnessSession> {
  const { data, error } = await supabase
    .from('fitness_sessions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase.from('fitness_sessions').delete().eq('id', id)
  if (error) throw error
}

// ─── 세트 ─────────────────────────────────────────────────

export async function getSetsBySession(sessionId: string): Promise<FitnessSet[]> {
  const { data, error } = await supabase
    .from('fitness_sets')
    .select('*')
    .eq('session_id', sessionId)
    .order('exercise_name')
    .order('set_number')
  if (error) throw error
  return data ?? []
}

export async function createSet(
  input: Omit<FitnessSet, 'id' | 'created_at'>
): Promise<FitnessSet> {
  const { data, error } = await supabase
    .from('fitness_sets')
    .insert([input])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSet(id: string): Promise<void> {
  const { error } = await supabase.from('fitness_sets').delete().eq('id', id)
  if (error) throw error
}

// 여러 종목의 직전 세션 세트 일괄 조회 (운동 기록 화면용)
export async function getPrevSessionSetsBulk(
  exerciseNames: string[]
): Promise<Map<string, FitnessSet[]>> {
  if (exerciseNames.length === 0) return new Map()

  const { data, error } = await supabase
    .from('fitness_sets')
    .select('*')
    .in('exercise_name', exerciseNames)
    .order('exercise_name')
    .order('created_at', { ascending: false })
    .limit(exerciseNames.length * 10)

  if (error) throw error

  // 종목별 최신 session_id 확인 후 해당 세션의 세트만 추출
  const latestSid = new Map<string, string>()
  for (const row of (data ?? []) as FitnessSet[]) {
    if (!latestSid.has(row.exercise_name)) latestSid.set(row.exercise_name, row.session_id)
  }

  const result = new Map<string, FitnessSet[]>()
  for (const row of (data ?? []) as FitnessSet[]) {
    if (latestSid.get(row.exercise_name) === row.session_id) {
      result.set(row.exercise_name, [...(result.get(row.exercise_name) ?? []), row])
    }
  }
  return result
}

// 종목별 세션 기록 (점진적 과부하 뷰용)
export async function getExerciseHistory(
  exerciseName: string,
  sessionLimit = 6
): Promise<Array<{ date: string; best_weight: number; best_reps: number; one_rm: number }>> {
  const { data, error } = await supabase
    .from('fitness_sets')
    .select('session_id, weight_kg, reps, created_at')
    .eq('exercise_name', exerciseName)
    .order('created_at', { ascending: false })
    .limit(sessionLimit * 8)

  if (error) throw error

  // 세션별 최고 1RM 세트 추출
  const sessionBest = new Map<string, { weight: number; reps: number; date: string }>()
  for (const row of (data ?? []) as Array<{ session_id: string; weight_kg: number; reps: number; created_at: string }>) {
    const existing = sessionBest.get(row.session_id)
    if (!existing || calc1RM(row.weight_kg, row.reps) > calc1RM(existing.weight, existing.reps)) {
      sessionBest.set(row.session_id, {
        weight: row.weight_kg,
        reps: row.reps,
        date: row.created_at.split('T')[0],
      })
    }
  }

  return Array.from(sessionBest.values())
    .slice(0, sessionLimit)
    .map(({ weight, reps, date }) => ({
      date,
      best_weight: weight,
      best_reps: reps,
      one_rm: calc1RM(weight, reps),
    }))
}

// 주요 컴파운드 현황 (대시보드용)
export async function getCompoundHighlights(): Promise<Array<{
  exercise: string
  latest_weight: number
  latest_reps: number
  one_rm: number
  trend: ProgressTrend
}>> {
  const compounds = [...COMPOUND_HIGHLIGHTS]

  const { data, error } = await supabase
    .from('fitness_sets')
    .select('session_id, exercise_name, weight_kg, reps, created_at')
    .in('exercise_name', compounds)
    .order('created_at', { ascending: false })
    .limit(compounds.length * 16)

  if (error) throw error

  // 종목별, 세션별 최고 1RM 추출
  const byExercise = new Map<string, Array<{ session_id: string; weight: number; reps: number }>>()

  for (const row of (data ?? []) as Array<{ session_id: string; exercise_name: string; weight_kg: number; reps: number }>) {
    const entries = byExercise.get(row.exercise_name) ?? []
    const idx = entries.findIndex(e => e.session_id === row.session_id)
    if (idx === -1) {
      byExercise.set(row.exercise_name, [...entries, { session_id: row.session_id, weight: row.weight_kg, reps: row.reps }])
    } else if (calc1RM(row.weight_kg, row.reps) > calc1RM(entries[idx].weight, entries[idx].reps)) {
      byExercise.set(row.exercise_name, entries.map((e, i) => i === idx ? { ...e, weight: row.weight_kg, reps: row.reps } : e))
    }
  }

  return compounds.map(exercise => {
    const entries = byExercise.get(exercise) ?? []
    if (entries.length === 0) return { exercise, latest_weight: 0, latest_reps: 0, one_rm: 0, trend: 'same' as ProgressTrend }
    const [latest, prev] = entries
    const latestOneRM = calc1RM(latest.weight, latest.reps)
    const prevOneRM = prev ? calc1RM(prev.weight, prev.reps) : latestOneRM
    return { exercise, latest_weight: latest.weight, latest_reps: latest.reps, one_rm: latestOneRM, trend: calcProgressTrend(prevOneRM, latestOneRM) }
  })
}

// ─── 식단 ─────────────────────────────────────────────────

export async function getDiet(date: string): Promise<FitnessDiet | null> {
  const { data, error } = await supabase
    .from('fitness_diet')
    .select('*')
    .eq('date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertDiet(
  input: Omit<FitnessDiet, 'id' | 'created_at' | 'updated_at'>
): Promise<FitnessDiet> {
  const { data, error } = await supabase
    .from('fitness_diet')
    .upsert([{ ...input, updated_at: new Date().toISOString() }], { onConflict: 'date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getDietHistory(days = 7): Promise<FitnessDiet[]> {
  const from = new Date()
  from.setDate(from.getDate() - days + 1)
  const fromStr = from.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('fitness_diet')
    .select('*')
    .gte('date', fromStr)
    .order('date', { ascending: false })
  if (error) throw error
  return data ?? []
}
