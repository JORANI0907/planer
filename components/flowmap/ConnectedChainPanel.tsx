'use client'

import { useState, useEffect } from 'react'
import type { PlanItem, PlanLevel } from '@/lib/types'
import { LEVEL_LABEL } from '@/lib/flowmap-layout'
import type { PlanConnection } from '@/lib/plan-connections'
import { supabase } from '@/lib/supabase'
import { X, Link2, ChevronRight } from 'lucide-react'

const LEVEL_ORDER: PlanLevel[] = ['annual', 'quarterly', 'monthly', 'weekly', 'daily']

const LEVEL_BADGE: Record<PlanLevel, { bg: string; color: string }> = {
  annual:    { bg: '#0f172a', color: '#fff' },
  quarterly: { bg: '#1d4ed8', color: '#fff' },
  monthly:   { bg: '#374151', color: '#fff' },
  weekly:    { bg: '#4b5563', color: '#fff' },
  daily:     { bg: '#6b7280', color: '#fff' },
}

const STATUS_DOT: Record<string, string> = {
  completed: '#22c55e', in_progress: '#3b82f6', on_hold: '#f97316', pending: '#9ca3af',
}
const STATUS_LABEL: Record<string, string> = {
  completed: '완료', in_progress: '진행중', on_hold: '보류', pending: '미시작',
}

interface ConnectedChainPanelProps {
  targetItem: PlanItem
  connections: PlanConnection[]
  onClose: () => void
}

async function fetchItemsByIds(ids: string[]): Promise<PlanItem[]> {
  if (ids.length === 0) return []
  const { data } = await supabase.from('plan_items').select('*').in('id', ids)
  return (data ?? []) as PlanItem[]
}

function collectConnectedIds(rootId: string, connections: PlanConnection[]): Set<string> {
  const visited = new Set<string>([rootId])
  const queue = [rootId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const conn of connections) {
      const other =
        conn.source_id === current ? conn.target_id :
        conn.target_id === current ? conn.source_id : null
      if (other && !visited.has(other)) {
        visited.add(other)
        queue.push(other)
      }
    }
  }
  visited.delete(rootId)
  return visited
}

export function ConnectedChainPanel({ targetItem, connections, onClose }: ConnectedChainPanelProps) {
  const [chainItems, setChainItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const relatedIds = collectConnectedIds(targetItem.id, connections)
    setLoading(true)
    fetchItemsByIds([...relatedIds])
      .then(items => { setChainItems(items); setLoading(false) })
      .catch(() => setLoading(false))
  }, [targetItem.id, connections])

  // 레벨별로 그룹화 (기준 항목 포함)
  const byLevel: Record<PlanLevel, { item: PlanItem; isRoot: boolean }[]> = {
    annual: [], quarterly: [], monthly: [], weekly: [], daily: [],
  }
  const rootLevel = targetItem.level as PlanLevel
  if (byLevel[rootLevel]) byLevel[rootLevel].push({ item: targetItem, isRoot: true })
  for (const item of chainItems) {
    const l = item.level as PlanLevel
    if (byLevel[l]) byLevel[l].push({ item, isRoot: false })
  }

  const hasChain = chainItems.length > 0

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        backgroundColor: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 360, backgroundColor: '#fff',
          boxShadow: '-4px 0 32px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column',
          animation: 'chainSlideIn 0.22s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Link2 size={16} color="#3b82f6" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', flex: 1 }}>연결된 계획 체인</span>
            <button
              onClick={onClose}
              style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center' }}
            >
              <X size={16} color="#6b7280" />
            </button>
          </div>
          {/* 기준 계획 표시 */}
          <div style={{
            padding: '8px 12px', borderRadius: 8,
            backgroundColor: '#eff6ff', border: '1.5px solid #3b82f6',
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
              backgroundColor: LEVEL_BADGE[rootLevel]?.bg ?? '#374151',
              color: LEVEL_BADGE[rootLevel]?.color ?? '#fff',
              flexShrink: 0,
            }}>
              {LEVEL_LABEL[rootLevel] ?? rootLevel}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {targetItem.title}
            </span>
          </div>
          <div style={{
            fontSize: 10, color: '#6b7280',
            padding: '6px 10px', backgroundColor: '#f0f9ff',
            borderRadius: 7, borderLeft: '3px solid #3b82f6', lineHeight: 1.5,
          }}>
            💡 이 계획과 연결된 모든 단계를 확인하세요
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 32px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, padding: 40, color: '#9ca3af' }}>
              <div style={{ width: 22, height: 22, border: '2px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'chainSpin 0.8s linear infinite' }} />
              <span style={{ fontSize: 12 }}>연결 체인 불러오는 중...</span>
            </div>
          ) : !hasChain ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#9ca3af' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔗</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>연결된 계획이 없습니다</div>
              <div style={{ fontSize: 11, lineHeight: 1.6 }}>
                계획 항목 왼쪽의 <strong>원형 점(●)</strong>을 클릭해<br />
                다른 단계 계획과 연결해보세요
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {LEVEL_ORDER.map(level => {
                const entries = byLevel[level]
                if (entries.length === 0) return null
                const badge = LEVEL_BADGE[level]
                return (
                  <div key={level}>
                    {/* Level header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 10px',
                        borderRadius: 12, backgroundColor: badge.bg, color: badge.color,
                        letterSpacing: '0.03em',
                      }}>
                        {LEVEL_LABEL[level]}
                      </span>
                      <div style={{ flex: 1, height: 1, backgroundColor: '#f1f5f9' }} />
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{entries.length}개</span>
                    </div>

                    {/* Items */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 4 }}>
                      {entries.map(({ item, isRoot }) => (
                        <div key={item.id} style={{
                          padding: '8px 10px', borderRadius: 8,
                          border: `1.5px solid ${isRoot ? '#3b82f6' : '#e5e7eb'}`,
                          backgroundColor: isRoot ? '#eff6ff' : '#fafafa',
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          {isRoot ? (
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: '1px 6px',
                              borderRadius: 4, backgroundColor: '#dbeafe', color: '#1d4ed8',
                              flexShrink: 0, whiteSpace: 'nowrap',
                            }}>기준</span>
                          ) : (
                            <ChevronRight size={11} color="#9ca3af" style={{ flexShrink: 0 }} />
                          )}
                          <span style={{
                            fontSize: 12, fontWeight: isRoot ? 700 : 500, color: '#111827',
                            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {item.title}
                          </span>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                            backgroundColor: STATUS_DOT[item.status] ?? '#9ca3af',
                          }} />
                          <span style={{ fontSize: 9, color: '#9ca3af', flexShrink: 0 }}>
                            {STATUS_LABEL[item.status] ?? item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes chainSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes chainSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}
