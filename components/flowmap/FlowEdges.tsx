'use client'

import type { PlanItem, PlanLevel } from '@/lib/types'
import { NodePosition, COLUMN_GAP, getStatusBorderColor, NEXT_LEVEL } from '@/lib/flowmap-layout'

interface FlowEdgesProps {
  annualItems: PlanItem[]
  childrenByParentId: Map<string, PlanItem[]>
  expandedIds: Set<string>
  positions: Map<string, NodePosition>
  canvasWidth: number
  canvasHeight: number
}

export function FlowEdges({
  annualItems,
  childrenByParentId,
  expandedIds,
  positions,
  canvasWidth,
  canvasHeight,
}: FlowEdgesProps) {
  const edges: React.ReactNode[] = []

  function collectEdges(items: PlanItem[], level: PlanLevel) {
    for (const item of items) {
      if (!expandedIds.has(item.id)) continue
      const children = childrenByParentId.get(item.id) ?? []
      if (children.length === 0) continue

      const parentPos = positions.get(item.id)
      if (!parentPos) continue

      const nextLevel = NEXT_LEVEL[level]
      if (!nextLevel) continue

      const parentRight = parentPos.x + parentPos.width
      const parentMidY = parentPos.y + parentPos.height / 2

      for (const child of children) {
        const childPos = positions.get(child.id)
        if (!childPos) continue

        const childLeft = childPos.x
        const childMidY = childPos.y + childPos.height / 2

        const cpOffset = (childLeft - parentRight) * 0.5
        const d = `M ${parentRight} ${parentMidY} C ${parentRight + cpOffset} ${parentMidY}, ${childLeft - cpOffset} ${childMidY}, ${childLeft} ${childMidY}`

        const color = getStatusBorderColor(child.status)
        const isDone = child.status === 'completed'

        edges.push(
          <path
            key={`${item.id}-${child.id}`}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={isDone ? 2 : 1.5}
            strokeDasharray={child.status === 'on_hold' ? '4 3' : undefined}
            opacity={0.6}
          />
        )
      }

      // Recurse into children
      collectEdges(children, nextLevel)
    }
  }

  collectEdges(annualItems, 'annual')

  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: canvasWidth,
        height: canvasHeight,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {edges}
    </svg>
  )
}
