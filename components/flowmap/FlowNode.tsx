'use client'

import type { PlanItem, PlanLevel } from '@/lib/types'
import { CATEGORIES, STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/types'
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  LEVEL_LABEL,
  formatPeriodKey,
  isTodayPeriod,
  getStatusProgress,
  getCategoryColor,
  getStatusBorderColor,
  getStatusBgColor,
} from '@/lib/flowmap-layout'
import { ChevronRight, ChevronDown, Plus, Loader2 } from 'lucide-react'

interface FlowNodeProps {
  item: PlanItem
  level: PlanLevel
  x: number
  y: number
  isExpanded: boolean
  isSelected: boolean
  isLoading: boolean
  childCount?: number
  dimmed?: boolean
  highlighted?: boolean
  onToggleExpand: (e: React.MouseEvent) => void
  onSelect: (e: React.MouseEvent) => void
}

export function FlowNode({
  item,
  level,
  x,
  y,
  isExpanded,
  isSelected,
  isLoading,
  childCount,
  dimmed,
  highlighted,
  onToggleExpand,
  onSelect,
}: FlowNodeProps) {
  const width = NODE_WIDTH[level]
  const height = NODE_HEIGHT[level]
  const isToday = isTodayPeriod(item.period_key, level)
  const isLeaf = level === 'daily'
  const progress = getStatusProgress(item.status)
  const borderColor = getStatusBorderColor(item.status)
  const bgColor = getStatusBgColor(item.status)
  const primaryCat = item.categories[0]
  const catColor = primaryCat ? getCategoryColor(primaryCat) : '#6b7280'
  const catInfo = CATEGORIES.find((c) => c.value === primaryCat)
  const statusInfo = STATUS_CONFIG[item.status]
  const priorityInfo = PRIORITY_CONFIG[item.priority]

  const opacity = dimmed ? 0.25 : 1
  const ringStyle = isSelected
    ? '0 0 0 2px #3b82f6, 0 4px 16px rgba(59,130,246,0.25)'
    : highlighted
    ? '0 0 0 2px #f59e0b, 0 4px 16px rgba(245,158,11,0.25)'
    : isToday
    ? '0 0 0 2px #f59e0b'
    : '0 1px 4px rgba(0,0,0,0.10)'

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        opacity,
        transition: 'opacity 0.2s',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={onSelect}
    >
      {/* Main card */}
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: bgColor,
          borderRadius: 10,
          border: `1px solid ${borderColor}`,
          borderLeft: `4px solid ${borderColor}`,
          boxShadow: ringStyle,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'box-shadow 0.15s',
        }}
      >
        {/* Category color top bar */}
        <div
          style={{
            height: 3,
            backgroundColor: catColor,
            flexShrink: 0,
          }}
        />

        {/* Content */}
        <div style={{ flex: 1, padding: '6px 8px 4px', display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0 }}>
          {/* Category + Today badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {catInfo && (
              <span
                style={{
                  fontSize: 9,
                  padding: '1px 5px',
                  borderRadius: 4,
                  backgroundColor: catColor + '20',
                  color: catColor,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  lineHeight: '16px',
                }}
              >
                {catInfo.label}
              </span>
            )}
            {!catInfo && (
              <span
                style={{
                  fontSize: 9,
                  padding: '1px 5px',
                  borderRadius: 4,
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                  lineHeight: '16px',
                }}
              >
                {LEVEL_LABEL[level]}
              </span>
            )}
            {isToday && (
              <span
                style={{
                  fontSize: 9,
                  padding: '1px 5px',
                  borderRadius: 4,
                  backgroundColor: '#fef3c7',
                  color: '#d97706',
                  fontWeight: 700,
                  lineHeight: '16px',
                }}
              >
                TODAY
              </span>
            )}
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: level === 'annual' ? 12 : 11,
              fontWeight: 600,
              color: '#111827',
              lineHeight: '1.35',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              flex: 1,
            }}
          >
            {item.title}
          </div>

          {/* Progress bar */}
          {level !== 'daily' && (
            <div style={{ marginTop: 2 }}>
              <div
                style={{
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: '#e5e7eb',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress}%`,
                    backgroundColor: borderColor,
                    borderRadius: 2,
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>
          )}

          {/* Status + Priority */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: 9,
                color: item.status === 'completed' ? '#16a34a' : item.status === 'in_progress' ? '#2563eb' : item.status === 'on_hold' ? '#ea580c' : '#6b7280',
                fontWeight: 500,
              }}
            >
              ● {statusInfo.label}
            </span>
            <span
              style={{
                fontSize: 9,
                color: item.priority === 'high' ? '#dc2626' : item.priority === 'medium' ? '#ca8a04' : '#9ca3af',
              }}
            >
              {item.priority === 'high' ? '↑' : item.priority === 'medium' ? '→' : '↓'} {priorityInfo.label}
            </span>
          </div>
        </div>

        {/* Period label */}
        <div
          style={{
            padding: '2px 8px 4px',
            fontSize: 9,
            color: '#9ca3af',
            lineHeight: '14px',
            flexShrink: 0,
          }}
        >
          {formatPeriodKey(item.period_key, level)}
        </div>
      </div>

      {/* Expand button (right side, vertically centered) */}
      {!isLeaf && (
        <div
          style={{
            position: 'absolute',
            right: -14,
            top: height / 2 - 14,
            width: 28,
            height: 28,
            borderRadius: '50%',
            backgroundColor: isExpanded ? '#3b82f6' : '#ffffff',
            border: `2px solid ${isExpanded ? '#3b82f6' : '#d1d5db'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            transition: 'all 0.15s',
          }}
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand(e)
          }}
        >
          {isLoading ? (
            <Loader2
              size={12}
              color={isExpanded ? '#fff' : '#6b7280'}
              style={{ animation: 'spin 1s linear infinite' }}
            />
          ) : childCount !== undefined && childCount === 0 && !isExpanded ? (
            <Plus size={12} color="#6b7280" />
          ) : isExpanded ? (
            <ChevronDown size={12} color="#fff" />
          ) : (
            <ChevronRight size={12} color="#6b7280" />
          )}
        </div>
      )}

      {/* Child count badge */}
      {!isLeaf && childCount !== undefined && childCount > 0 && !isExpanded && (
        <div
          style={{
            position: 'absolute',
            right: -6,
            top: -6,
            width: 18,
            height: 18,
            borderRadius: '50%',
            backgroundColor: '#3b82f6',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 11,
          }}
        >
          {childCount > 9 ? '9+' : childCount}
        </div>
      )}
    </div>
  )
}
