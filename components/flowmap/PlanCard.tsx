'use client'

import type { PlanItem } from '@/lib/types'
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/types'
import { formatPeriodKey } from '@/lib/flowmap-layout'

interface PlanCardProps {
  item: PlanItem
  onDragStart?: () => void
  compact?: boolean
}

const STATUS_COLORS: Record<string, { dot: string; bg: string; border: string }> = {
  completed: { dot: '#22c55e', bg: 'rgba(34,197,94,0.07)', border: '#86efac' },
  in_progress: { dot: '#3b82f6', bg: 'rgba(59,130,246,0.07)', border: '#93c5fd' },
  on_hold: { dot: '#f97316', bg: 'rgba(249,115,22,0.07)', border: '#fdba74' },
  pending: { dot: '#9ca3af', bg: '#fff', border: '#e5e7eb' },
}

const PRIORITY_ICONS: Record<string, string> = { high: '↑', medium: '→', low: '↓' }
const PRIORITY_COLORS: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#9ca3af' }

const PROGRESS_MAP: Record<string, number> = { completed: 100, in_progress: 50, on_hold: 20, pending: 0 }

export function PlanCard({ item, onDragStart, compact = false }: PlanCardProps) {
  const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.pending
  const si = STATUS_CONFIG[item.status]
  const pi = PRIORITY_CONFIG[item.priority]
  const progress = PROGRESS_MAP[item.status] ?? 0
  const periodLabel = formatPeriodKey(item.period_key, item.level)

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.()
      }}
      style={{
        backgroundColor: sc.bg,
        border: `1.5px solid ${sc.border}`,
        borderRadius: 10,
        padding: compact ? '8px 10px' : '10px 12px',
        cursor: 'grab',
        userSelect: 'none',
        transition: 'box-shadow 0.15s',
        WebkitUserSelect: 'none',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 3px 12px rgba(0,0,0,0.1)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Period + Status dot */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: '#6b7280', backgroundColor: '#f3f4f6', padding: '1px 7px', borderRadius: 4, fontWeight: 500 }}>
          {periodLabel}
        </span>
        <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: sc.dot, flexShrink: 0 }} />
      </div>

      {/* Title */}
      <div style={{
        fontSize: compact ? 12 : 13,
        fontWeight: 600,
        color: '#111827',
        lineHeight: '1.4',
        marginBottom: compact ? 5 : 8,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      }}>
        {item.title}
      </div>

      {/* Progress bar */}
      {!compact && (
        <div style={{ height: 3, borderRadius: 2, backgroundColor: '#e5e7eb', marginBottom: 7, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, backgroundColor: sc.dot, borderRadius: 2 }} />
        </div>
      )}

      {/* Status + Priority */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: sc.dot, fontWeight: 600 }}>● {si.label}</span>
        <span style={{ fontSize: 10, color: PRIORITY_COLORS[item.priority], fontWeight: 600 }}>
          {PRIORITY_ICONS[item.priority]} {pi.label}
        </span>
      </div>
    </div>
  )
}
