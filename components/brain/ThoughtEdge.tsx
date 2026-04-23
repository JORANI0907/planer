'use client'

import { memo, useContext, useState, useRef, useEffect } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useInternalNode, Position, type EdgeProps } from '@xyflow/react'
import { EDGE_COLORS, getEdgeColor } from '@/lib/brain-types'
import { getEdgeParams } from '@/lib/floating-edge-utils'
import { BrainCtx } from './BrainContext'

export type ThoughtEdgeData = {
  label?: string
  relationType?: string
  isWingEdge?: boolean
}

function ThoughtEdgeInner({
  id, source, target,
  sourceX, sourceY, targetX, targetY,
  data, selected, markerEnd,
}: EdgeProps) {
  const { onEdgeChangeType, onEdgeChangeLabel, onEdgeDelete } = useContext(BrainCtx)
  const edgeData = (data ?? {}) as ThoughtEdgeData
  const isWing = edgeData.isWingEdge
  const relType = edgeData.relationType ?? '#94a3b8'
  const activeColor = getEdgeColor(relType)

  const [labelEdit, setLabelEdit] = useState(false)
  const [labelVal, setLabelVal] = useState(edgeData.label ?? '')
  const labelInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLabelVal(edgeData.label ?? '') }, [edgeData.label])
  useEffect(() => { if (labelEdit && labelInputRef.current) labelInputRef.current.focus() }, [labelEdit])

  // 360° 자동 방향: 두 노드의 실제 경계 교차점을 계산
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
    curvature: isWing ? 0 : 0.25,  // 날개 연결선은 직선으로
  })

  const strokeColor = isWing ? '#94a3b8' : (selected ? '#6366f1' : activeColor)
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
                gap: 8,
                minWidth: 168,
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* 8색상 picker */}
              <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
                {EDGE_COLORS.map(color => {
                  const isActive = activeColor === color
                  return (
                    <button
                      key={color}
                      onClick={() => onEdgeChangeType(id, color)}
                      title={color}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: color,
                        border: isActive ? `3px solid #1e293b` : '2px solid transparent',
                        outline: isActive ? `2px solid ${color}` : 'none',
                        outlineOffset: 1,
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'transform 0.1s',
                        transform: isActive ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
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
                  border: `1.5px solid ${activeColor}`,
                  borderRadius: 20,
                  padding: '1px 8px',
                  fontSize: 10,
                  fontWeight: 600,
                  color: activeColor,
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
