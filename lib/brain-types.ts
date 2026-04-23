export type ThoughtNodeKind = 'topic' | 'module' | 'wing'
export type ThoughtNodeType = string
export type EdgeRelationType = string  // hex 색상 또는 'wing'

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

// 8가지 선 색상
export const EDGE_COLORS = [
  '#94a3b8',  // 회색 (기본)
  '#16a34a',  // 초록
  '#2563eb',  // 파랑
  '#dc2626',  // 빨강
  '#f97316',  // 주황
  '#9333ea',  // 보라
  '#06b6d4',  // 청록
  '#ec4899',  // 핑크
] as const

export type EdgeColor = typeof EDGE_COLORS[number]

export function getEdgeColor(relationType: string): string {
  if ((EDGE_COLORS as readonly string[]).includes(relationType)) return relationType
  if (relationType === 'wing') return '#94a3b8'
  // 레거시 타입 변환
  switch (relationType) {
    case 'center': case 'leads_to': case 'related': return '#16a34a'
    case 'assist': case 'supports': return '#2563eb'
    case 'negative': case 'contradicts': return '#dc2626'
    default: return '#94a3b8'
  }
}

// 레거시 호환: DB에서 읽은 relation_type을 그대로 반환 (이제 색상 hex 또는 'wing')
export function mapRelationType(type: string): string {
  return getEdgeColor(type) === '#94a3b8' && type === 'wing' ? 'wing' : getEdgeColor(type)
}
