export type ThoughtNodeType = 'idea' | 'logic' | 'concern' | 'action' | 'business' | 'memo'
export type EdgeRelationType = 'supports' | 'contradicts' | 'leads_to' | 'related'

export interface ThoughtNode {
  id: string
  parent_id: string | null
  title: string
  content: string | null
  type: ThoughtNodeType
  color: string
  tags: string[]
  grid_position: number // 0~8, 4 = center
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ThoughtEdge {
  id: string
  source_id: string
  target_id: string
  label: string | null
  relation_type: EdgeRelationType
  created_at: string
}

export const NODE_TYPE_CONFIG: Record<ThoughtNodeType, { label: string; icon: string; color: string; bg: string }> = {
  idea:     { label: '아이디어', icon: '💡', color: '#7c3aed', bg: '#ede9fe' },
  logic:    { label: '논리/근거', icon: '🔷', color: '#2563eb', bg: '#dbeafe' },
  concern:  { label: '고민/문제', icon: '❓', color: '#d97706', bg: '#fef3c7' },
  action:   { label: '추진사항', icon: '🚀', color: '#059669', bg: '#d1fae5' },
  business: { label: '사업안',   icon: '💼', color: '#1e3a8a', bg: '#dbeafe' },
  memo:     { label: '메모',     icon: '📝', color: '#6b7280', bg: '#f3f4f6' },
}

export const EDGE_RELATION_CONFIG: Record<EdgeRelationType, { label: string; color: string }> = {
  supports:    { label: '지지',   color: '#059669' },
  contradicts: { label: '반박',   color: '#dc2626' },
  leads_to:    { label: '이어짐', color: '#2563eb' },
  related:     { label: '관련',   color: '#6b7280' },
}

// 만다라 3×3 그리드에서 position → [row, col]
export function gridPositionToRC(pos: number): [number, number] {
  return [Math.floor(pos / 3), pos % 3]
}
