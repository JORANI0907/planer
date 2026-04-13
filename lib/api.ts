import { supabase } from './supabase'
import type { PlanItem, PlanMapping, PlanLevel, LifeGoal, LifeGoalAnnualMapping, AgeGroup, PlanItemTask, Profile, PlanSection } from './types'

// ─── Life Goals ──────────────────────────────────────────────
export async function getLifeGoals(ageGroup?: AgeGroup): Promise<LifeGoal[]> {
  let query = supabase.from('life_goals').select('*').order('sort_order')
  if (ageGroup) query = query.eq('age_group', ageGroup)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createLifeGoal(goal: Omit<LifeGoal, 'id' | 'created_at' | 'updated_at'>): Promise<LifeGoal> {
  const { data, error } = await supabase.from('life_goals').insert(goal).select().single()
  if (error) throw error
  return data
}

export async function updateLifeGoal(id: string, updates: Partial<Omit<LifeGoal, 'id' | 'created_at' | 'updated_at'>>): Promise<LifeGoal> {
  const { data, error } = await supabase.from('life_goals').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteLifeGoal(id: string): Promise<void> {
  const { error } = await supabase.from('life_goals').delete().eq('id', id)
  if (error) throw error
}

// ─── Life Goal → Annual Mappings ─────────────────────────────
export async function getLifeGoalsForAnnual(annualPeriodKey: string): Promise<{ mapping: LifeGoalAnnualMapping; goal: LifeGoal }[]> {
  const { data, error } = await supabase
    .from('life_goal_annual_mappings')
    .select('*, life_goals(*)')
    .eq('annual_period_key', annualPeriodKey)
  if (error) throw error
  if (!data) return []
  return data.map((row: LifeGoalAnnualMapping & { life_goals: LifeGoal }) => ({
    mapping: { id: row.id, life_goal_id: row.life_goal_id, annual_period_key: row.annual_period_key, note: row.note, created_at: row.created_at },
    goal: row.life_goals,
  }))
}

export async function getMappedAnnualPeriodKeys(lifeGoalId: string): Promise<string[]> {
  const { data, error } = await supabase.from('life_goal_annual_mappings').select('annual_period_key').eq('life_goal_id', lifeGoalId)
  if (error) throw error
  return (data ?? []).map(r => r.annual_period_key)
}

export async function createLifeGoalAnnualMapping(lifeGoalId: string, annualPeriodKey: string): Promise<void> {
  const { error } = await supabase.from('life_goal_annual_mappings')
    .upsert({ life_goal_id: lifeGoalId, annual_period_key: annualPeriodKey }, { onConflict: 'life_goal_id,annual_period_key' })
  if (error) throw error
}

export async function deleteLifeGoalAnnualMapping(lifeGoalId: string, annualPeriodKey: string): Promise<void> {
  const { error } = await supabase.from('life_goal_annual_mappings')
    .delete().eq('life_goal_id', lifeGoalId).eq('annual_period_key', annualPeriodKey)
  if (error) throw error
}

// ─── Plan Items ───────────────────────────────────────────────
export async function getPlanItems(level: PlanLevel, periodKey: string): Promise<PlanItem[]> {
  const { data, error } = await supabase.from('plan_items').select('*')
    .eq('level', level).eq('period_key', periodKey)
    .order('sort_order').order('created_at')
  if (error) throw error
  return data ?? []
}

export async function getAllPlanItems(level: PlanLevel): Promise<PlanItem[]> {
  const { data, error } = await supabase.from('plan_items').select('*')
    .eq('level', level).order('period_key').order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function createPlanItem(item: Omit<PlanItem, 'id' | 'created_at' | 'updated_at' | 'parent_plan_item_id' | 'section_id'> & { parent_plan_item_id?: string | null; section_id?: string | null }): Promise<PlanItem> {
  const { data, error } = await supabase.from('plan_items').insert(item).select().single()
  if (error) throw error
  return data
}

export async function updatePlanItem(id: string, updates: Partial<Omit<PlanItem, 'id' | 'created_at' | 'updated_at'>>): Promise<PlanItem> {
  const { data, error } = await supabase.from('plan_items').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deletePlanItem(id: string): Promise<void> {
  const { error } = await supabase.from('plan_items').delete().eq('id', id)
  if (error) throw error
}

// ─── Plan Mappings ────────────────────────────────────────────
export async function getMappingsForParent(parentItemId: string): Promise<PlanMapping[]> {
  const { data, error } = await supabase.from('plan_mappings').select('*').eq('parent_item_id', parentItemId)
  if (error) throw error
  return data ?? []
}

export async function getParentItemsForPeriod(childPeriodKey: string): Promise<{ mapping: PlanMapping; item: PlanItem }[]> {
  const { data, error } = await supabase.from('plan_mappings').select('*, plan_items(*)').eq('child_period_key', childPeriodKey)
  if (error) throw error
  if (!data) return []
  return data.map((row: PlanMapping & { plan_items: PlanItem }) => ({
    mapping: { id: row.id, parent_item_id: row.parent_item_id, child_period_key: row.child_period_key, child_note: row.child_note, created_at: row.created_at },
    item: row.plan_items,
  }))
}

export async function createMapping(parentItemId: string, childPeriodKey: string, childNote?: string): Promise<PlanMapping> {
  const { data, error } = await supabase.from('plan_mappings')
    .upsert({ parent_item_id: parentItemId, child_period_key: childPeriodKey, child_note: childNote ?? null }, { onConflict: 'parent_item_id,child_period_key' })
    .select().single()
  if (error) throw error
  return data
}

export async function deleteMapping(parentItemId: string, childPeriodKey: string): Promise<void> {
  const { error } = await supabase.from('plan_mappings').delete()
    .eq('parent_item_id', parentItemId).eq('child_period_key', childPeriodKey)
  if (error) throw error
}

export async function getMappingsForItems(itemIds: string[]): Promise<PlanMapping[]> {
  if (itemIds.length === 0) return []
  const { data, error } = await supabase.from('plan_mappings').select('*').in('parent_item_id', itemIds)
  if (error) throw error
  return data ?? []
}

export async function deleteAllMappingsForItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('plan_mappings').delete().eq('parent_item_id', itemId)
  if (error) throw error
}

// 월별 일일 계획 일괄 조회
export async function getDailyItemsForMonth(year: number, month: number): Promise<PlanItem[]> {
  const pad = (n: number) => String(n).padStart(2, '0')
  const { data, error } = await supabase.from('plan_items')
    .select('*')
    .eq('level', 'daily')
    .gte('period_key', `${year}-${pad(month)}-01`)
    .lte('period_key', `${year}-${pad(month)}-31`)
    .order('period_key').order('sort_order')
  if (error) throw error
  return data ?? []
}

// ─── Plan Sections ────────────────────────────────────────────
export async function getPlanSections(year: number): Promise<PlanSection[]> {
  const { data, error } = await supabase.from('plan_sections').select('*')
    .eq('year', year).order('sort_order').order('created_at')
  if (error) throw error
  return data ?? []
}

export async function createPlanSection(year: number, title: string, color: string, sortOrder: number): Promise<PlanSection> {
  const { data, error } = await supabase.from('plan_sections')
    .insert({ year, title, color, sort_order: sortOrder }).select().single()
  if (error) throw error
  return data
}

export async function updatePlanSection(id: string, updates: Partial<Pick<PlanSection, 'title' | 'color' | 'sort_order'>>): Promise<PlanSection> {
  const { data, error } = await supabase.from('plan_sections').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deletePlanSection(id: string): Promise<void> {
  const { error } = await supabase.from('plan_sections').delete().eq('id', id)
  if (error) throw error
}

// year 기준 모든 계획 항목 (daily 제외)
export async function getPlanItemsForYear(year: number): Promise<PlanItem[]> {
  const { data, error } = await supabase.from('plan_items').select('*')
    .neq('level', 'daily')
    .or(`period_key.eq.${year},period_key.like.${year}-%`)
    .order('sort_order').order('created_at')
  if (error) throw error
  return data ?? []
}

export async function updatePlanItemSection(id: string, sectionId: string | null): Promise<void> {
  const { error } = await supabase.from('plan_items').update({ section_id: sectionId }).eq('id', id)
  if (error) throw error
}

// ─── Plan Item Tasks (체크리스트) ─────────────────────────────
export async function getTasksForItem(planItemId: string): Promise<PlanItemTask[]> {
  const { data, error } = await supabase.from('plan_item_tasks').select('*')
    .eq('plan_item_id', planItemId).order('sort_order').order('created_at')
  if (error) throw error
  return data ?? []
}

export async function createTask(planItemId: string, title: string, sortOrder: number): Promise<PlanItemTask> {
  const { data, error } = await supabase.from('plan_item_tasks')
    .insert({ plan_item_id: planItemId, title, sort_order: sortOrder })
    .select().single()
  if (error) throw error
  return data
}

export async function updateTask(id: string, updates: Partial<Pick<PlanItemTask, 'title' | 'is_completed' | 'sort_order'>>): Promise<PlanItemTask> {
  const { data, error } = await supabase.from('plan_item_tasks').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('plan_item_tasks').delete().eq('id', id)
  if (error) throw error
}

// ─── Profile ──────────────────────────────────────────────────
export async function getProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').limit(1).single()
  if (error && error.code !== 'PGRST116') throw error
  return data ?? null
}

export async function updateProfile(id: string, updates: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>): Promise<Profile> {
  const { data, error } = await supabase.from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}
