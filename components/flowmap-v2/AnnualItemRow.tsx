'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { PlanItem } from '@/lib/types'
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/types'
import { DrillDownLevel } from './DrillDownLevel'

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

const QUARTER_KEYS = (year: number) =>
  [1, 2, 3, 4].map(q => `${year}-Q${q}`)

export function AnnualItemRow({ item, year, onChanged }: AnnualItemRowProps) {
  const [expanded, setExpanded] = useState(false)

  const sc = STATUS_BG[item.status] ?? STATUS_BG.pending
  const dot = STATUS_DOT[item.status] ?? STATUS_DOT.pending
  const statusLabel = STATUS_CONFIG[item.status]?.label ?? item.status
  const priorityColor = PRIORITY_CONFIG[item.priority]?.color ?? 'text-gray-400'

  return (
    <div
      style={{
        border: `1.5px solid ${expanded ? '#93c5fd' : sc.border}`,
        borderRadius: 10,
        backgroundColor: expanded ? 'rgba(219,234,254,0.12)' : sc.bg,
        overflow: 'hidden',
        transition: 'all 0.15s',
      }}
    >
      {/* 헤더 행 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded(prev => !prev)}
      >
        {/* 펼침/접힘 아이콘 */}
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {expanded ? (
            <ChevronDown size={15} color="#3b82f6" />
          ) : (
            <ChevronRight size={15} color="#9ca3af" />
          )}
        </span>

        {/* 상태 점 */}
        <span
          style={{
            width: 8,
            height: 8,
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
            fontWeight: 600,
            color: '#111827',
            lineHeight: 1.4,
            minWidth: 0,
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
      </div>

      {/* 드릴다운 영역 */}
      {expanded && (
        <div
          style={{
            borderTop: '1px solid #e5e7eb',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {/* 설명 */}
          {item.description && (
            <p
              style={{
                fontSize: 12,
                color: '#6b7280',
                marginBottom: 8,
                lineHeight: 1.5,
              }}
            >
              {item.description}
            </p>
          )}

          {/* 4개 분기 드릴다운 */}
          {QUARTER_KEYS(year).map(qKey => (
            <DrillDownLevel
              key={qKey}
              parentId={item.id}
              periodKey={qKey}
              level="quarterly"
              depth={0}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  )
}
