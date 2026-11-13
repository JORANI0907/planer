// 마인드맵 색상 팔레트 — 차분하고 모던한 톤(기존 쨍한 8색 대체).
export type Palette = {
  key: string
  dot: string // 노드 악센트/점
  soft: string // 카드 배경(연한)
  text: string // 제목 텍스트
  ring: string // 선택 링/테두리
  line: string // 연결선
}

export const PALETTE: Palette[] = [
  { key: 'slate', dot: '#64748b', soft: '#f8fafc', text: '#334155', ring: '#cbd5e1', line: '#cbd5e1' },
  { key: 'indigo', dot: '#6366f1', soft: '#eef2ff', text: '#4338ca', ring: '#c7d2fe', line: '#c7d2fe' },
  { key: 'sky', dot: '#0ea5e9', soft: '#f0f9ff', text: '#0369a1', ring: '#bae6fd', line: '#bae6fd' },
  { key: 'emerald', dot: '#10b981', soft: '#ecfdf5', text: '#047857', ring: '#a7f3d0', line: '#a7f3d0' },
  { key: 'amber', dot: '#f59e0b', soft: '#fffbeb', text: '#b45309', ring: '#fde68a', line: '#fcd34d' },
  { key: 'rose', dot: '#f43f5e', soft: '#fff1f2', text: '#be123c', ring: '#fecdd3', line: '#fda4af' },
  { key: 'violet', dot: '#8b5cf6', soft: '#f5f3ff', text: '#6d28d9', ring: '#ddd6fe', line: '#ddd6fe' },
  { key: 'teal', dot: '#14b8a6', soft: '#f0fdfa', text: '#0f766e', ring: '#99f6e4', line: '#5eead4' },
]

export const DEFAULT_COLOR = PALETTE[1].dot // indigo

export function paletteFor(hex: string | null | undefined): Palette {
  return PALETTE.find((p) => p.dot === hex) ?? PALETTE[0]
}

// 상위 분기(루트 바로 아래 조상) 색을 자식이 물려받아 가지별 색을 통일.
export function branchColorOf(
  nodeId: string,
  rootId: string,
  parentOf: Map<string, string | null>,
  colorOf: Map<string, string>,
): string {
  let cur: string | null = nodeId
  let branchTop = nodeId
  let guard = 0
  while (cur && cur !== rootId && guard++ < 1000) {
    const p: string | null = parentOf.get(cur) ?? null
    if (p === rootId || p == null) { branchTop = cur; break }
    cur = p
  }
  return colorOf.get(branchTop) ?? DEFAULT_COLOR
}
