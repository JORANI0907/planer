'use client'

import type { PlanItem } from '@/lib/types'
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/types'
import { formatPeriodKey } from '@/lib/flowmap-layout'
import { ChevronRight } from 'lucide-react'

interface PlanCardProps {
  item: PlanItem
  onDragStart?: () => void
  onClick?: (item: PlanItem) => void
  compact?: boolean
  showDrillDown?: boolean
}

const SC: Record<string, { dot: string; bg: string; border: string }> = {
  completed: { dot: '#22c55e', bg: 'rgba(34,197,94,0.07)', border: '#86efac' },
  in_progress: { dot: '#3b82f6', bg: 'rgba(59,130,246,0.07)', border: '#93c5fd' },
  on_hold: { dot: '#f97316', bg: 'rgba(249,115,22,0.07)', border: '#fdba74' },
  pending: { dot: '#9ca3af', bg: '#fff', border: '#e5e7eb' },
}
const PI: Record<string, string> = { high: '↑', medium: '→', low: '↓' }
const PC: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#9ca3af' }
const PROG: Record<string, number> = { completed: 100, in_progress: 50, on_hold: 20, pending: 0 }

export function PlanCard({ item, onDragStart, onClick, compact = false, showDrillDown }: PlanCardProps) {
  const sc = SC[item.status] ?? SC.pending
  const si = STATUS_CONFIG[item.status]
  const pi = PRIORITY_CONFIG[item.priority]
  const progress = PROG[item.status] ?? 0
  const periodLabel = formatPeriodKey(item.period_key, item.level)
  const isDrillable = showDrillDown ?? item.level !== 'daily'
  const isClickable = !!onClick

  // 드래그 vs 클릭 구분을 위한 mousedown 좌표 추적
  let mouseDownPos = { x: 0, y: 0 }

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.()
      }}
      onMouseDown={e => { mouseDownPos = { x: e.clientX, y: e.clientY } }}
      onMouseUp={e => {
        if (!onClick) return
        const dx = Math.abs(e.clientX - mouseDownPos.x)
        const dy = Math.abs(e.clientY - mouseDownPos.y)
        if (dx < 5 && dy < 5) onClick(item)
      }}
      style={{
        backgroundColor: sc.bg,
        border: `1.5px solid ${sc.border}`,
        borderRadius: 10,
        padding: compact ? '8px 10px' : '10px 12px',
        cursor: isClickable ? 'pointer' : (onDragStart ? 'grab' : 'default'),
        userSelect: 'none',
        WebkitUserSelect: 'none',
        transition: 'box-shadow 0.15s, transform 0.1s',
        position: 'relative',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 3px 12px rgba(0,0,0,0.1)'
        if (isClickable) e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'none'
      }}
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
        marginBottom: compact ? 5 : 7,
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

      {/* Status + Priority + Drill indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: sc.dot, fontWeight: 600 }}>● {si.label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: PC[item.priority], fontWeight: 600 }}>{PI[item.priority]} {pi.label}</span>
          {isDrillable && isClickable && <ChevronRight size={11} color="#d1d5db" />}
        </div>
      </div>
    </div>
  )
}
