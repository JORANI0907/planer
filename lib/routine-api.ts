import { supabase } from './supabase'
import type { RoutineTask, PlanItem } from './types'

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function getRoutineTasks(): Promise<RoutineTask[]> {
  const { data, error } = await supabase
    .from('routine_tasks')
    .select('*')
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function createRoutineTask(
  task: Omit<RoutineTask, 'id' | 'created_at' | 'updated_at'>
): Promise<RoutineTask> {
  const { data, error } = await supabase
    .from('routine_tasks')
    .insert(task)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateRoutineTask(
  id: string,
  updates: Partial<Omit<RoutineTask, 'id' | 'created_at' | 'updated_at'>>
): Promise<RoutineTask> {
  const { data, error } = await supabase
    .from('routine_tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteRoutineTask(id: string): Promise<void> {
  // 미래 미완료 일정 먼저 삭제
  await deleteFutureSchedules(id)
  const { error } = await supabase.from('routine_tasks').delete().eq('id', id)
  if (error) throw error
}

/** 오늘부터 2주치(14일) 일정 생성 — 중복 skip */
export async function generateRoutineSchedule(
  task: RoutineTask
): Promise<{ inserted: number; skipped: number }> {
  const today = new Date()
  const targetDates: string[] = []

  for (let i = 0; i <= 14; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const dayOfWeek = d.getDay()
    const dayOfMonth = d.getDate()

    const matches =
      task.schedule_type === 'weekly'
        ? task.weekly_days.includes(dayOfWeek)
        : task.monthly_dates.includes(dayOfMonth)

    if (matches) targetDates.push(dateKey(d))
  }

  if (targetDates.length === 0) return { inserted: 0, skipped: 0 }

  // 이미 존재하는 날짜 확인
  const { data: existing } = await supabase
    .from('plan_items')
    .select('period_key')
    .eq('routine_task_id', task.id)
    .in('period_key', targetDates)

  const existingSet = new Set((existing ?? []).map((r: { period_key: string }) => r.period_key))
  const newDates = targetDates.filter(d => !existingSet.has(d))

  if (newDates.length === 0) return { inserted: 0, skipped: targetDates.length }

  const toInsert = newDates.map((date, idx) => ({
    level: 'daily' as const,
    period_key: date,
    title: task.title,
    description: null,
    categories: [] as string[],
    status: 'pending' as const,
    priority: 'medium' as const,
    sort_order: 9999 + idx,
    routine_task_id: task.id,
  }))

  const { error } = await supabase.from('plan_items').insert(toInsert)
  if (error) throw error

  return { inserted: newDates.length, skipped: existingSet.size }
}

/** 활성화된 모든 routine_tasks에 대해 2주치 일정 생성 */
export async function generateAllActiveRoutineSchedules(): Promise<{
  taskId: string
  title: string
  inserted: number
  skipped: number
}[]> {
  const tasks = await getRoutineTasks()
  const activeTasks = tasks.filter(t => t.is_active)
  const results = []
  for (const task of activeTasks) {
    const { inserted, skipped } = await generateRoutineSchedule(task)
    results.push({ taskId: task.id, title: task.title, inserted, skipped })
  }
  return results
}

/** off 전환 시: 오늘 이후 미완료 일정 삭제 */
async function deleteFutureSchedules(taskId: string): Promise<void> {
  const today = todayKey()
  const { error } = await supabase
    .from('plan_items')
    .delete()
    .eq('routine_task_id', taskId)
    .gt('period_key', today)
    .neq('status', 'completed')
  if (error) throw error
}

/** 토글: on이면 2주치 생성, off이면 미래 미완료 삭제 */
export async function toggleRoutineTask(
  id: string,
  isActive: boolean
): Promise<RoutineTask> {
  if (!isActive) {
    await deleteFutureSchedules(id)
  }
  const updated = await updateRoutineTask(id, { is_active: isActive })
  if (isActive) {
    await generateRoutineSchedule(updated)
  }
  return updated
}

/** 필수과업으로 생성된 daily 항목인지 확인용 (plan_items에서 사용) */
export function isRoutineItem(item: PlanItem): boolean {
  return !!item.routine_task_id
}
