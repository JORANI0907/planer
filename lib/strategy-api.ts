import { supabase } from './supabase'
import type { StrategyNode, StrategyKind, StrategyStatus } from './strategy-types'
import type { PlanItem, PlanLevel } from './types'
import { TODO_PERIOD_KEY } from './types'

// 목표시점(period_key) 포맷으로 plan_items 의 level 판별
export function periodKeyToLevel(key: string): PlanLevel {
  if (/^\d{4}$/.test(key)) return 'annual'
  if (/^\d{4}-Q[1-4]$/.test(key)) return 'quarterly'
  if (/^\d{4}-\d{2}$/.test(key)) return 'monthly'
  if (/^\d{4}-W\d{2}$/.test(key)) return 'weekly'
  return 'daily'
}

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
  description?: string | null
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
      description: input.description ?? null,
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

// ─── 마일스톤 → 일정(plan_items) 투입 ─────────────────────────────
// 마일스톤을 그 목표시점의 일정 항목으로 생성한다. 이미 투입돼 있으면 재생성하지 않는다.
export async function pushMilestoneToSchedule(
  m: StrategyNode,
): Promise<{ created: boolean; level: PlanLevel; periodKey: string }> {
  if (!m.target_period_key) throw new Error('목표시점을 먼저 설정하세요.')
  const periodKey = m.target_period_key
  const level = periodKeyToLevel(periodKey)

  const { data: existing, error: selErr } = await supabase
    .from('plan_items')
    .select('id')
    .eq('strategy_node_id', m.id)
    .eq('period_key', periodKey)
    .limit(1)
  if (selErr) throw selErr
  if (existing && existing.length > 0) return { created: false, level, periodKey }

  const { error } = await supabase.from('plan_items').insert({
    level,
    period_key: periodKey,
    title: m.title || '(단계)',
    description: m.description,
    categories: [],
    status: 'pending',
    priority: 'medium',
    sort_order: 0,
    strategy_node_id: m.id,
  })
  if (error) throw error
  return { created: true, level, periodKey }
}

// ─── 실행항목 (전략/마일스톤에 귀속된 TO-DO = plan_items) ──────────
export async function getStrategyTodos(strategyNodeId: string): Promise<PlanItem[]> {
  const { data, error } = await supabase
    .from('plan_items')
    .select('*')
    .eq('strategy_node_id', strategyNodeId)
    .eq('level', 'todo')
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function createStrategyTodo(strategyNodeId: string, title: string, sortOrder = 0): Promise<PlanItem> {
  const { data, error } = await supabase
    .from('plan_items')
    .insert({
      level: 'todo',
      period_key: TODO_PERIOD_KEY,
      title,
      categories: [],
      status: 'pending',
      priority: 'medium',
      sort_order: sortOrder,
      strategy_node_id: strategyNodeId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// TO-DO 탭 등에서 전략 출처 뱃지를 그리기 위한 전략노드 요약 조회
export async function getStrategyNodeMap(
  ids: string[],
): Promise<Record<string, { title: string; kind: StrategyKind }>> {
  if (ids.length === 0) return {}
  const { data, error } = await supabase.from('strategy_nodes').select('id, title, kind').in('id', ids)
  if (error) throw error
  const map: Record<string, { title: string; kind: StrategyKind }> = {}
  for (const r of (data ?? []) as { id: string; title: string; kind: StrategyKind }[]) {
    map[r.id] = { title: r.title, kind: r.kind }
  }
  return map
}

// 주어진 마일스톤 중 이미 일정에 투입된 것들의 id 집합
export async function getScheduledMilestoneIds(milestoneIds: string[]): Promise<Set<string>> {
  if (milestoneIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('plan_items')
    .select('strategy_node_id')
    .in('strategy_node_id', milestoneIds)
  if (error) throw error
  return new Set(
    (data ?? [])
      .map((r: { strategy_node_id: string | null }) => r.strategy_node_id)
      .filter((v): v is string => !!v),
  )
}
