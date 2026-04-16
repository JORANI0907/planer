export type ThoughtNodeKind = 'topic' | 'module' | 'wing'
// DB 호환용 단순 타입 (UI에서는 사용 안 함)
export type ThoughtNodeType = string
export type EdgeRelationType = 'center' | 'assist' | 'negative' | 'wing'

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

// 축 관계 설정: center=중심(초록), assist=보조(파랑), negative=부정(빨강), wing=날개(회색)
export const EDGE_RELATION_CONFIG: Record<EdgeRelationType, { label: string; color: string }> = {
  center:   { label: '중심축', color: '#16a34a' },
  assist:   { label: '보조축', color: '#2563eb' },
  negative: { label: '부정축', color: '#dc2626' },
  wing:     { label: '날개축', color: '#94a3b8' },
}

// 구버전 relation_type 매핑 (기존 데이터 호환)
export function mapRelationType(type: string): EdgeRelationType {
  switch (type) {
    case 'supports':    return 'assist'
    case 'contradicts': return 'negative'
    case 'leads_to':    return 'center'
    case 'related':     return 'center'
    case 'center': case 'assist': case 'negative': case 'wing': return type as EdgeRelationType
    default:            return 'center'
  }
}
