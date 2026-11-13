import { supabase } from './supabase'
import type { StrategyNode, StrategyKind, StrategyStatus } from './strategy-types'

// ─── 세부전략 노드 (전략 + 마일스톤) ──────────────────────────────
export async function getStrategyNodes(lifeGoalId: string): Promise<StrategyNode[]> {
  const { data, error } = await supabase
    .from('strategy_nodes')
    .select('*')
    .eq('life_goal_id', lifeGoalId)
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function createStrategyNode(input: {
  life_goal_id: string | null
  kind: StrategyKind
  parent_id?: string | null
  title?: string
  target_period_key?: string | null
  sort_order?: number
}): Promise<StrategyNode> {
  const { data, error } = await supabase
    .from('strategy_nodes')
    .insert({
      life_goal_id: input.life_goal_id,
      kind: input.kind,
      parent_id: input.parent_id ?? null,
      title: input.title ?? '',
      target_period_key: input.target_period_key ?? null,
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateStrategyNode(
  id: string,
  updates: Partial<Pick<StrategyNode, 'title' | 'description' | 'target_period_key' | 'status' | 'sort_order' | 'parent_id'>>,
): Promise<StrategyNode> {
  const { data, error } = await supabase
    .from('strategy_nodes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// 마일스톤 두 개의 순서(sort_order) 교환 — 플로우 순서 조정용.
export async function swapStrategyOrder(a: StrategyNode, b: StrategyNode): Promise<void> {
  const { error } = await supabase.from('strategy_nodes').upsert([
    { ...a, sort_order: b.sort_order },
    { ...b, sort_order: a.sort_order },
  ])
  if (error) throw error
}

export async function deleteStrategyNode(id: string): Promise<void> {
  // 전략 삭제 시 하위 마일스톤은 FK on delete cascade 로 함께 삭제됨.
  const { error } = await supabase.from('strategy_nodes').delete().eq('id', id)
  if (error) throw error
}

export function nextStatus(s: StrategyStatus): StrategyStatus {
  return s === 'todo' ? 'doing' : s === 'doing' ? 'done' : 'todo'
}
