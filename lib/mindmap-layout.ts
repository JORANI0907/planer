import type { ThoughtNode } from './brain-types'

// 노드 크기·간격 (자동 배치용)
export const NODE_W = 200
export const NODE_H = 52
export const H_GAP = 56 // 열(깊이) 간격
export const V_GAP = 16 // 형제 간격

export type XY = { x: number; y: number }

/**
 * 좌→우 정돈 트리 레이아웃.
 * 리프는 세로로 차례대로 쌓고, 부모는 자식들의 중앙에 둔다(Reingold–Tilford 단순화).
 * 반환: 노드 id → 좌상단 좌표(React Flow position).
 */
export function layoutTree(
  rootId: string,
  nodes: ThoughtNode[],
): Record<string, XY> {
  const childrenOf = new Map<string, ThoughtNode[]>()
  for (const n of nodes) {
    if (!n.parent_id) continue
    const arr = childrenOf.get(n.parent_id) ?? []
    arr.push(n)
    childrenOf.set(n.parent_id, arr)
  }
  for (const arr of childrenOf.values()) {
    arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at.localeCompare(b.created_at))
  }

  const pos: Record<string, XY> = {}
  let nextLeafY = 0
  const visited = new Set<string>()

  function walk(id: string, depth: number): number {
    if (visited.has(id)) return nextLeafY // 사이클 방어
    visited.add(id)
    const kids = childrenOf.get(id) ?? []
    const x = depth * (NODE_W + H_GAP)
    if (kids.length === 0) {
      const y = nextLeafY
      nextLeafY += NODE_H + V_GAP
      pos[id] = { x, y }
      return y
    }
    const kidYs = kids.map((k) => walk(k.id, depth + 1))
    const y = (kidYs[0] + kidYs[kidYs.length - 1]) / 2
    pos[id] = { x, y }
    return y
  }

  walk(rootId, 0)
  return pos
}
