'use client'

import { memo, useContext, useState, useRef, useEffect } from 'react'
import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react'
import { EDGE_RELATION_CONFIG } from '@/lib/brain-types'
import type { EdgeRelationType } from '@/lib/brain-types'
import { BrainCtx } from './BrainContext'

export type ThoughtEdgeData = {
  label?: string
  relationType?: EdgeRelationType
  isWingEdge?: boolean
}

// 자연스러운 360° 베지어 곡선 (방향에 구애받지 않음)
function getFlowingPath(
  sx: number, sy: number,
  tx: number, ty: number
): [string, number, number] {
  const dx = tx - sx
  const dy = ty - sy
  const dist = Math.sqrt(dx * dx + dy * dy)
  const midX = sx + dx * 0.5
  const midY = sy + dy * 0.5

  if (dist < 1) return [`M ${sx} ${sy}`, midX, midY]

  // 수직 방향 오프셋으로 자연스러운 곡률 생성
  const curve = Math.min(dist * 0.3, 60)
  const px = (-dy / dist) * curve
  const py = (dx / dist) * curve

  const cx1 = sx + dx / 3 + px
  const cy1 = sy + dy / 3 + py
  const cx2 = tx - dx / 3 + px
  const cy2 = ty - dy / 3 + py

  return [
    `M ${sx} ${sy} C ${cx1} ${cy1} ${cx2} ${cy2} ${tx} ${ty}`,
    midX + px * 0.4,
    midY + py * 0.4,
  ]
}

const RELATION_TYPES: EdgeRelationType[] = ['center', 'assist', 'negative']

function ThoughtEdgeInner({
  id, sourceX, sourceY, targetX, targetY,
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

  const [edgePath, labelX, labelY] = getFlowingPath(sourceX, sourceY, targetX, targetY)

  const strokeColor = isWing ? '#94a3b8' : (selected ? '#6366f1' : cfg.color)
  const strokeWidth = isWing ? 1.5 : (selected ? 2.5 : 2)

  function saveLabel() {
    setLabelEdit(false)
    onEdgeChangeLabel(id, labelVal)
  }

  if (isWing) {
    return (
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '5 4' }}
      />
    )
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: '6 4',
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
          {/* 선택된 엣지: 타입 선택 + 라벨 편집 패널 */}
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
                minWidth: 140,
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* 축 종류 선택 */}
              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                {RELATION_TYPES.map(rt => {
                  const c = EDGE_RELATION_CONFIG[rt]
                  return (
                    <button
                      key={rt}
                      onClick={() => onEdgeChangeType(id, rt)}
                      title={c.label}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: `2px solid ${relType === rt ? c.color : '#e2e8f0'}`,
                        background: relType === rt ? c.color : '#f8fafc',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        fontWeight: 700,
                        color: relType === rt ? '#ffffff' : c.color,
                      }}
                    >
                      {c.label.replace('축', '')}
                    </button>
                  )
                })}
              </div>

              {/* 라벨 편집 */}
              {labelEdit ? (
                <input
                  ref={labelInputRef}
                  value={labelVal}
                  onChange={e => setLabelVal(e.target.value)}
                  onBlur={saveLabel}
                  onKeyDown={e => { if (e.key === 'Enter') saveLabel(); if (e.key === 'Escape') { setLabelVal(edgeData.label ?? ''); setLabelEdit(false) } }}
                  placeholder="축 내용..."
                  style={{
                    width: '100%',
                    fontSize: 11,
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    padding: '3px 6px',
                    outline: 'none',
                    color: '#374151',
                  }}
                />
              ) : (
                <button
                  onClick={() => setLabelEdit(true)}
                  style={{
                    fontSize: 10,
                    color: edgeData.label ? '#374151' : '#94a3b8',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    padding: '3px 8px',
                    cursor: 'text',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 120,
                  }}
                >
                  {edgeData.label || '내용 입력...'}
                </button>
              )}

              {/* 연결 끊기 */}
              <button
                onClick={() => onEdgeDelete(id)}
                style={{
                  fontSize: 10,
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
            /* 미선택: 축 이름 + 라벨 배지 */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  background: '#fff',
                  border: `1.5px solid ${cfg.color}`,
                  borderRadius: 20,
                  padding: '1px 7px',
                  fontSize: 9,
                  fontWeight: 600,
                  color: cfg.color,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  whiteSpace: 'nowrap',
                }}
              >
                {edgeData.label || cfg.label}
              </div>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const ThoughtEdge = memo(ThoughtEdgeInner)
