export type ThoughtNodeKind = 'topic' | 'module' | 'wing'
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
  grid_position: number
  node_kind: ThoughtNodeKind
  pos_x: number
  pos_y: number
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
  source_handle: string | null
  target_handle: string | null
  created_at: string
}

export const NODE_TYPE_CONFIG: Record<ThoughtNodeType, { label: string; icon: string; color: string; bg: string }> = {
  idea:     { label: '아이디어', icon: '💡', color: '#7c3aed', bg: '#ede9fe' },
  logic:    { label: '논리/근거', icon: '🔷', color: '#2563eb', bg: '#dbeafe' },
  concern:  { label: '고민/문제', icon: '❓', color: '#d97706', bg: '#fef3c7' },
  action:   { label: '추진사항', icon: '🚀', color: '#059669', bg: '#d1fae5' },
  business: { label: '사업안',   icon: '💼', color: '#1e40af', bg: '#dbeafe' },
  memo:     { label: '메모',     icon: '📝', color: '#6b7280', bg: '#f3f4f6' },
}

export const EDGE_RELATION_CONFIG: Record<EdgeRelationType, { label: string; color: string }> = {
  supports:    { label: '지지',   color: '#059669' },
  contradicts: { label: '반박',   color: '#dc2626' },
  leads_to:    { label: '이어짐', color: '#2563eb' },
  related:     { label: '관련',   color: '#6b7280' },
}
