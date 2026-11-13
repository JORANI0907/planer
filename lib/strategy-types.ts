// 세부전략 보드 타입.
// 큰그림(life_goals) 아래에 전략(strategy) → 마일스톤(milestone, 순서 플로우)이 달린다.
// 실행항목은 plan_items(level='todo' + strategy_node_id)로 연결한다(Phase 3).

export type StrategyKind = 'strategy' | 'milestone'
export type StrategyStatus = 'todo' | 'doing' | 'done'

export interface StrategyNode {
  id: string
  life_goal_id: string | null
  kind: StrategyKind
  parent_id: string | null
  title: string
  description: string | null // TipTap HTML
  target_period_key: string | null // 마일스톤 목표시점 (예: 2026, 2026-Q2, 2026-03)
  status: StrategyStatus
  sort_order: number
  created_at: string
}

export const STRATEGY_STATUS_CONFIG: Record<StrategyStatus, { label: string; color: string }> = {
  todo: { label: '예정', color: 'bg-gray-100 text-gray-600' },
  doing: { label: '진행중', color: 'bg-blue-100 text-blue-700' },
  done: { label: '완료', color: 'bg-green-100 text-green-700' },
}

export const STRATEGY_STATUS_ORDER: StrategyStatus[] = ['todo', 'doing', 'done']
