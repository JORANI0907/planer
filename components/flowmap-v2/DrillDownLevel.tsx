'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, ChevronDown, Plus, Trash2 } from 'lucide-react'
import type { PlanItem, PlanLevel } from '@/lib/types'
import { STATUS_CONFIG } from '@/lib/types'
import { getPlanItems, createPlanItem, deletePlanItem } from '@/lib/api'
import {
  formatPeriodLabel,
  getChildPeriodKeys,
  getChildLevel,
} from '@/lib/flowmap-v2-utils'

interface DrillDownLevelProps {
  parentId: string
  periodKey: string      // e.g. '2026-Q1'
  level: PlanLevel       // 'quarterly' | 'monthly' | 'weekly'
  depth: number          // 들여쓰기 레벨 (0-base)
  onChanged?: () => void
}

const STATUS_DOT: Record<string, string> = {
  completed: '#22c55e',
  in_progress: '#3b82f6',
  on_hold: '#f97316',
  pending: '#9ca3af',
}

const LEVEL_ADD_LABEL: Partial<Record<PlanLevel, string>> = {
  quarterly: '+ 분기 추가',
  monthly: '+ 월 추가',
  weekly: '+ 주 추가',
}

// 레벨별 시각적 구분 색상 (삼각 배색: 바이올렛 / 주황 / 청록)
const LEVEL_STYLE: Record<string, { bg: string; border: string; headerBg: string; chevron: string }> = {
  quarterly: { bg: 'rgba(124,58,237,0.08)',  border: '#7c3aed', headerBg: '#ede9fe', chevron: '#7c3aed' },
  monthly:   { bg: 'rgba(234,88,12,0.08)',   border: '#ea580c', headerBg: '#ffedd5', chevron: '#ea580c' },
  weekly:    { bg: 'rgba(8,145,178,0.08)',   border: '#0891b2', headerBg: '#cffafe', chevron: '#0891b2' },
}

export function DrillDownLevel({
  parentId,
  periodKey,
  level,
  depth,
  onChanged,
}: DrillDownLevelProps) {
  const [expanded, setExpanded] = useState(false)
  const [items, setItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const childPeriodKeys = getChildPeriodKeys(periodKey)
  const childLevel = getChildLevel(level)
  const indent = depth * 16

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const results = await getPlanItems(level, periodKey)
      setItems(results)
    } catch {
      // 조용히 실패 처리
    } finally {
      setLoading(false)
    }
  }, [level, periodKey])

  useEffect(() => {
    if (expanded) {
      loadItems()
    }
  }, [expanded, loadItems])

  const handleAdd = async () => {
    const title = newTitle.trim()
    if (!title) return
    try {
      await createPlanItem({
        level,
        period_key: periodKey,
        title,
        description: null,
        categories: [],
        status: 'pending',
        priority: 'medium',
        sort_order: items.length,
        parent_plan_item_id: parentId,
        section_id: null,
      })
      setNewTitle('')
      setAdding(false)
      await loadItems()
      onChanged?.()
    } catch {
      // 조용히 실패 처리
    }
  }

  const headerLabel = formatPeriodLabel(periodKey)
  const ls = LEVEL_STYLE[level] ?? { bg: '#fafafa', border: '#e5e7eb', headerBg: '#f9fafb', chevron: '#9ca3af' }

  return (
    <div
      style={{
        marginLeft: indent,
        borderLeft: `2px solid ${ls.border}`,
        borderRadius: 6,
        marginBottom: 4,
        overflow: 'hidden',
      }}
    >
      {/* 헤더 행: 분기/월/주 레이블 + 펼침/접힘 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          backgroundColor: expanded ? ls.headerBg : 'transparent',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background-color 0.1s',
        }}
        onClick={() => setExpanded(prev => !prev)}
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = ls.headerBg
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = expanded ? ls.headerBg : 'transparent'
        }}
      >
        {expanded ? (
          <ChevronDown size={13} color={ls.chevron} />
        ) : (
          <ChevronRight size={13} color={ls.chevron} />
        )}
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: expanded ? '#1f2937' : '#374151',
            minWidth: 40,
          }}
        >
          {headerLabel}
        </span>
        {!expanded && (
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            클릭하여 펼치기
          </span>
        )}
      </div>

      {expanded && (
        <div style={{ marginLeft: 12, backgroundColor: ls.bg, paddingRight: 4 }}>
          {loading && (
            <div style={{ fontSize: 11, color: '#9ca3af', padding: '4px 8px' }}>
              불러오는 중...
            </div>
          )}

          {/* 아이템 목록 */}
          {!loading && items.map(item => (
            <ItemRow key={item.id} item={item} onDeleted={() => { loadItems(); onChanged?.() }} />
          ))}

          {/* 하위 레벨 드릴다운 (월 아래 주, 분기 아래 월) */}
          {!loading && childLevel && childPeriodKeys.map(childKey => (
            <DrillDownLevel
              key={childKey}
              parentId={parentId}
              periodKey={childKey}
              level={childLevel}
              depth={0}
              onChanged={() => {
                loadItems()
                onChanged?.()
              }}
            />
          ))}

          {/* 항목 추가 폼 */}
          {adding ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
              <input
                autoFocus
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAdd()
                  if (e.key === 'Escape') { setAdding(false); setNewTitle('') }
                }}
                placeholder="제목 입력 후 Enter"
                style={{
                  flex: 1,
                  fontSize: 12,
                  padding: '4px 8px',
                  border: '1px solid #93c5fd',
                  borderRadius: 6,
                  outline: 'none',
                  color: '#111827',
                }}
              />
              <button
                onClick={handleAdd}
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                추가
              </button>
              <button
                onClick={() => { setAdding(false); setNewTitle('') }}
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  color: '#6b7280',
                }}
              >
                취소
              </button>
            </div>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); setAdding(true) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                color: '#9ca3af',
                padding: '3px 6px',
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                marginTop: 2,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#3b82f6' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af' }}
            >
              <Plus size={11} />
              {LEVEL_ADD_LABEL[level] ?? '+ 추가'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 개별 아이템 행 ──────────────────────────────────────────

function ItemRow({ item, onDeleted }: { item: PlanItem; onDeleted: () => void }) {
  const [hovered, setHovered] = useState(false)
  const dot = STATUS_DOT[item.status] ?? STATUS_DOT.pending
  const statusLabel = STATUS_CONFIG[item.status]?.label ?? item.status

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`"${item.title}" 항목을 삭제하시겠습니까?`)) return
    try {
      await deletePlanItem(item.id)
      onDeleted()
    } catch {
      // 조용히 실패
    }
  }

  return (
    <div
      style={{ padding: '5px 8px', borderRadius: 6, marginBottom: 2 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 제목 + 상태 + 삭제 버튼 인라인 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: dot,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 500,
            color: '#111827',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title}
        </span>
        <span style={{ fontSize: 10, color: dot, fontWeight: 600, flexShrink: 0 }}>
          {statusLabel}
        </span>
        {hovered && (
          <button
            onClick={handleDelete}
            title="삭제"
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 2,
              borderRadius: 4,
              color: '#f87171',
            }}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      {/* 설명 (있을 경우에만 아래에 표시) */}
      {item.description && (
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, paddingLeft: 14 }}>
          {item.description}
        </div>
      )}
    </div>
  )
}
