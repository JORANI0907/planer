'use client'

import { memo, useContext, useState, useRef, useEffect } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useInternalNode, Position, type EdgeProps } from '@xyflow/react'
import { EDGE_RELATION_CONFIG } from '@/lib/brain-types'
import type { EdgeRelationType } from '@/lib/brain-types'
import { getEdgeParams } from '@/lib/floating-edge-utils'
import { BrainCtx } from './BrainContext'

export type ThoughtEdgeData = {
  label?: string
  relationType?: EdgeRelationType
  isWingEdge?: boolean
}

const RELATION_TYPES: EdgeRelationType[] = ['center', 'assist', 'negative']

function ThoughtEdgeInner({
  id, source, target,
  sourceX, sourceY, targetX, targetY,
  data, selected, markerEnd,
}: EdgeProps) {
  const { onEdgeChangeType, onEdgeChangeLabel, onEdgeDelete } = useContext(BrainCtx)
  const edgeData = (data ?? {}) as ThoughtEdgeData
  const isWing = edgeData.isWingEdge
  const relType: EdgeRelationType = edgeData.relationType ?? 'center'
  const cfg = EDGE_RELATION_CONFIG[relType] ?? EDGE_RELATION_CONFIG.center

  const [labelEdit, setLabelEdit] = useState(false)
  const [labelVal, setLabelVal] = useState(edgeData.label ?? '')
  const labelInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLabelVal(edgeData.label ?? '') }, [edgeData.label])
  useEffect(() => { if (labelEdit && labelInputRef.current) labelInputRef.current.focus() }, [labelEdit])

  // 360° 자동 방향: 두 노드의 실제 경계 교차점을 계산 (측정 전에는 ReactFlow 기본값 사용)
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)

  let sx = sourceX, sy = sourceY, tx = targetX, ty = targetY
  let sourcePos: Position = Position.Right, targetPos: Position = Position.Left
  if (sourceNode?.measured?.width && targetNode?.measured?.width) {
    const p = getEdgeParams(sourceNode, targetNode)
    sx = p.sx; sy = p.sy; tx = p.tx; ty = p.ty
    sourcePos = p.sourcePos; targetPos = p.targetPos
  }

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetX: tx,
    targetY: ty,
    targetPosition: targetPos,
    curvature: 0.25,
  })

  const strokeColor = isWing ? '#94a3b8' : (selected ? '#6366f1' : cfg.color)
  const strokeWidth = isWing ? 1.5 : (selected ? 3 : 2)

  function saveLabel() {
    setLabelEdit(false)
    onEdgeChangeLabel(id, labelVal)
  }

  if (isWing) {
    return (
      <>
        {/* 우클릭 감지용 투명 히트박스 */}
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={20}
          style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
        />
        <BaseEdge
          id={id}
          path={edgePath}
          style={{ stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '5 4' }}
        />
      </>
    )
  }

  return (
    <>
      {/* 클릭 영역 확장용 투명 히트박스 */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: selected ? undefined : '6 4',
        }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 10,
          }}
        >
          {selected ? (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                minWidth: 160,
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                {RELATION_TYPES.map(rt => {
                  const c = EDGE_RELATION_CONFIG[rt]
                  const active = relType === rt
                  return (
                    <button
                      key={rt}
                      onClick={() => onEdgeChangeType(id, rt)}
                      title={c.label}
                      style={{
                        width: 30, height: 30,
                        borderRadius: '50%',
                        border: `2px solid ${active ? c.color : '#e2e8f0'}`,
                        background: active ? c.color : '#ffffff',
                        cursor: 'pointer',
                        fontSize: 9, fontWeight: 700,
                        color: active ? '#ffffff' : c.color,
                        transition: 'all 0.12s',
                      }}
                    >
                      {c.label.replace('축', '')}
                    </button>
                  )
                })}
              </div>

              {labelEdit ? (
                <input
                  ref={labelInputRef}
                  value={labelVal}
                  onChange={e => setLabelVal(e.target.value)}
                  onBlur={saveLabel}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveLabel()
                    if (e.key === 'Escape') { setLabelVal(edgeData.label ?? ''); setLabelEdit(false) }
                  }}
                  placeholder="선 내용..."
                  style={{
                    width: '100%',
                    fontSize: 11,
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    padding: '4px 6px',
                    outline: 'none',
                    color: '#374151',
                  }}
                />
              ) : (
                <button
                  onClick={() => setLabelEdit(true)}
                  style={{
                    fontSize: 11,
                    color: edgeData.label ? '#374151' : '#94a3b8',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    padding: '4px 8px',
                    cursor: 'text',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 160,
                  }}
                >
                  {edgeData.label || '내용 입력...'}
                </button>
              )}

              <button
                onClick={() => onEdgeDelete(id)}
                style={{
                  fontSize: 11,
                  color: '#ef4444',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'center',
                  padding: '2px 0',
                }}
              >
                연결 끊기
              </button>
            </div>
          ) : (
            edgeData.label && (
              <div
                style={{
                  background: '#fff',
                  border: `1.5px solid ${cfg.color}`,
                  borderRadius: 20,
                  padding: '1px 8px',
                  fontSize: 10,
                  fontWeight: 600,
                  color: cfg.color,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {edgeData.label}
              </div>
            )
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const ThoughtEdge = memo(ThoughtEdgeInner)
