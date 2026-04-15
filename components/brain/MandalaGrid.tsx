'use client'

import type { ThoughtNode } from '@/lib/brain-types'
import { MandalaCell } from './MandalaCell'

interface Props {
  centerNode: ThoughtNode
  children: (ThoughtNode | null)[] // index 0~8, index 4 = center (always centerNode)
  childrenMap: Record<string, boolean> // nodeId → has children
  selectedId: string | null
  onSelect: (node: ThoughtNode) => void
  onDrillDown: (node: ThoughtNode) => void
  onAddNode: (position: number) => void
}

export function MandalaGrid({ centerNode, children, childrenMap, selectedId, onSelect, onDrillDown, onAddNode }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2 md:gap-3 w-full max-w-lg mx-auto">
      {Array.from({ length: 9 }, (_, pos) => {
        const isCenter = pos === 4
        const node = isCenter ? centerNode : children[pos] ?? null
        return (
          <MandalaCell
            key={pos}
            node={node}
            position={pos}
            isCenter={isCenter}
            hasChildren={node ? !!childrenMap[node.id] : false}
            isSelected={node?.id === selectedId}
            onClick={() => node && onSelect(node)}
            onDrillDown={() => node && onDrillDown(node)}
            onAddNode={onAddNode}
          />
        )
      })}
    </div>
  )
}
