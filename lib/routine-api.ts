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
  await deleteFutureSchedules(id)
  const { error } = await supabase.from('routine_tasks').delete().eq('id', id)
  if (error) throw error
}

/**
 * 오늘부터 end_date까지 반복 일정 생성 — 중복 skip
 * end_date가 없거나 오늘 이전이면 생성하지 않음
 */
export async function generateRoutineSchedule(
  task: RoutineTask
): Promise<{ inserted: number; skipped: number }> {
  if (!task.end_date) return { inserted: 0, skipped: 0 }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDate = new Date(task.end_date)
  endDate.setHours(0, 0, 0, 0)

  if (endDate < today) return { inserted: 0, skipped: 0 }

  const targetDates: string[] = []
  for (let d = new Date(today); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay()
    const dayOfMonth = d.getDate()
    const matches =
      task.schedule_type === 'weekly'
        ? (task.weekly_days ?? []).includes(dayOfWeek)
        : (task.monthly_dates ?? []).includes(dayOfMonth)
    if (matches) targetDates.push(dateKey(new Date(d)))
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

/**
 * 오늘 이후 미완료 일정 삭제 (과거 + 완료된 항목은 보존)
 */
async function deleteFutureSchedules(taskId: string): Promise<void> {
  const today = todayKey()
  const { error } = await supabase
    .from('plan_items')
    .delete()
    .eq('routine_task_id', taskId)
    .gte('period_key', today)
    .neq('status', 'completed')
  if (error) throw error
}

/**
 * 과업 수정 + 미래 일정 자동 재반영
 * - 오늘 이후 미완료 일정 삭제 → 새 설정으로 재생성
 * - 과거 이력은 보존
 */
export async function updateRoutineTaskAndApplyToFuture(
  id: string,
  updates: Partial<Omit<RoutineTask, 'id' | 'created_at' | 'updated_at'>>
): Promise<RoutineTask> {
  await deleteFutureSchedules(id)
  const updated = await updateRoutineTask(id, updates)
  if (updated.is_active) {
    await generateRoutineSchedule(updated)
  }
  return updated
}

/**
 * 켜기: end_date까지 전체 일정 생성
 * 끄기: 오늘 이후 미완료 일정 삭제
 */
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

/** 필수과업으로 생성된 daily 항목인지 확인 */
export function isRoutineItem(item: PlanItem): boolean {
  return !!item.routine_task_id
}
