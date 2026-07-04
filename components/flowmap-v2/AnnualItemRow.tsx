'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, Trash2, Check } from 'lucide-react'
import type { PlanItem } from '@/lib/types'
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/types'
import { updatePlanItem, deletePlanItem } from '@/lib/api'
import { AnnualDescendantsTree } from './AnnualDescendantsTree'
import { AnnualDescriptionEditor } from './AnnualDescriptionEditor'

interface AnnualItemRowProps {
  item: PlanItem
  year: number
  onChanged: () => void
}

const STATUS_DOT: Record<string, string> = {
  completed: '#22c55e',
  in_progress: '#3b82f6',
  on_hold: '#f97316',
  pending: '#9ca3af',
}

const STATUS_BG: Record<string, { bg: string; border: string }> = {
  completed: { bg: 'rgba(34,197,94,0.06)', border: '#86efac' },
  in_progress: { bg: 'rgba(59,130,246,0.06)', border: '#93c5fd' },
  on_hold: { bg: 'rgba(249,115,22,0.06)', border: '#fdba74' },
  pending: { bg: '#fff', border: '#e5e7eb' },
}

export function AnnualItemRow({ item, year, onChanged }: AnnualItemRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)

  const sc = STATUS_BG[item.status] ?? STATUS_BG.pending
  const dot = STATUS_DOT[item.status] ?? STATUS_DOT.pending
  const statusLabel = STATUS_CONFIG[item.status]?.label ?? item.status
  const priorityColor = PRIORITY_CONFIG[item.priority]?.color ?? 'text-gray-400'
  const isDone = item.status === 'completed'

  const handleToggleDone = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await updatePlanItem(item.id, { status: isDone ? 'pending' : 'completed' })
      onChanged()
    } catch {
      // 조용히 실패
    }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`"${item.title}" 항목을 삭제하시겠습니까?\n\n(관련된 하위 계획도 삭제될 수 있습니다)`)) return
    try {
      await deletePlanItem(item.id)
      onChanged()
    } catch {
      // 조용히 실패
    }
  }

  return (
    <div
      style={{
        border: `1.5px solid ${expanded ? '#a78bfa' : sc.border}`,
        borderRadius: 10,
        backgroundColor: expanded ? 'rgba(245,243,255,0.6)' : sc.bg,
        overflow: 'hidden',
        transition: 'all 0.15s',
        boxShadow: expanded ? '0 1px 3px rgba(124,58,237,0.08)' : 'none',
      }}
    >
      {/* 헤더 행 */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded(prev => !prev)}
      >
        {/* 펼침/접힘 아이콘 */}
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {expanded ? (
            <ChevronDown size={15} color="#7c3aed" />
          ) : (
            <ChevronRight size={15} color="#9ca3af" />
          )}
        </span>

        {/* 완료 체크 */}
        <button
          onClick={handleToggleDone}
          title={isDone ? '미완료로 변경' : '완료 처리'}
          style={{
            flexShrink: 0,
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: `1.5px solid ${isDone ? '#22c55e' : '#d1d5db'}`,
            backgroundColor: isDone ? '#22c55e' : '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          {isDone && <Check size={10} color="#fff" strokeWidth={3} />}
        </button>

        {/* 상태 점 */}
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: dot,
            flexShrink: 0,
          }}
        />

        {/* 제목 */}
        <span
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: 700,
            color: isDone ? '#9ca3af' : '#111827',
            textDecoration: isDone ? 'line-through' : 'none',
            lineHeight: 1.4,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title}
        </span>

        {/* 우선순위 */}
        <span
          className={priorityColor}
          style={{ fontSize: 11, flexShrink: 0, fontWeight: 500 }}
        >
          {PRIORITY_CONFIG[item.priority]?.label}
        </span>

        {/* 상태 배지 */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: dot,
            backgroundColor: sc.bg,
            border: `1px solid ${sc.border}`,
            borderRadius: 20,
            padding: '2px 8px',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {statusLabel}
        </span>

        {/* 삭제 (hover 시만) */}
        <button
          onClick={handleDelete}
          title="삭제"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderRadius: 5,
            color: '#f87171',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.12s',
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* 드릴다운 영역 (연간 항목 전용 후손 트리) */}
      {expanded && (
        <div
          style={{
            borderTop: '1px solid #e9d5ff',
            padding: '8px 10px 10px',
            backgroundColor: '#fefeff',
          }}
        >
          {/* 설명 (연간 항목 전용, 인라인 편집 가능, 줄바꿈 유지) */}
          <AnnualDescriptionEditor item={item} onChanged={onChanged} />

          {/* 후손 트리 (분기 → 월 → 주 → 일, 오늘 경로 자동 펼침) */}
          <AnnualDescendantsTree
            annualItemId={item.id}
            year={year}
            onChanged={onChanged}
          />
        </div>
      )}
    </div>
  )
}
