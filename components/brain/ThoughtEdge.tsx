'use client'

import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { EDGE_RELATION_CONFIG } from '@/lib/brain-types'
import type { EdgeRelationType } from '@/lib/brain-types'

export type ThoughtEdgeData = {
  label?: string
  relationType?: EdgeRelationType
  isWingEdge?: boolean
}

function ThoughtEdgeInner({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, selected, markerEnd,
}: EdgeProps) {
  const edgeData = (data ?? {}) as ThoughtEdgeData
  const relType = edgeData.relationType ?? 'related'
  const cfg = EDGE_RELATION_CONFIG[relType]
  const isWing = edgeData.isWingEdge

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const strokeColor = isWing ? '#94a3b8' : (selected ? '#6366f1' : cfg.color)
  const strokeDash = isWing ? '4 4' : undefined

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth: isWing ? 1.5 : 2,
          strokeDasharray: strokeDash,
        }}
      />
      {!isWing && edgeData.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
          >
            <div
              className="px-2 py-0.5 rounded-full text-xs font-medium border shadow-sm cursor-pointer"
              style={{
                backgroundColor: '#fff',
                borderColor: strokeColor,
                color: strokeColor,
                fontSize: 10,
              }}
            >
              {edgeData.label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
      {!isWing && !edgeData.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
          >
            <div
              className="px-1.5 py-0.5 rounded-full text-xs border shadow-sm"
              style={{ backgroundColor: '#fff', borderColor: strokeColor, color: strokeColor, fontSize: 9 }}
            >
              {cfg.label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const ThoughtEdge = memo(ThoughtEdgeInner)
