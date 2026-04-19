'use client'

import { useRouter } from 'next/navigation'
import type { PlanItem, PlanLevel } from '@/lib/types'
import { CATEGORIES, STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/types'
import {
  LEVEL_LABEL,
  formatPeriodKey,
  getCategoryColor,
  getStatusBorderColor,
  getStatusProgress,
  isTodayPeriod,
  NEXT_LEVEL,
} from '@/lib/flowmap-layout'
import { X, ExternalLink, ChevronRight } from 'lucide-react'

interface NodeDetailPanelProps {
  item: PlanItem
  level: PlanLevel
  children: PlanItem[]
  isExpanded: boolean
  onClose: () => void
  onExpandChild: (child: PlanItem) => void
}

export function NodeDetailPanel({
  item,
  level,
  children,
  isExpanded,
  onClose,
  onExpandChild,
}: NodeDetailPanelProps) {
  const router = useRouter()
  const borderColor = getStatusBorderColor(item.status)
  const progress = getStatusProgress(item.status)
  const isToday = isTodayPeriod(item.period_key, level)
  const nextLevel = NEXT_LEVEL[level]

  const editHref =
    level === 'daily' ? '/daily' :
    '/flowmap'

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: 300,
        backgroundColor: '#ffffff',
        borderLeft: '1px solid #e5e7eb',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #f3f4f6',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Level badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span
              style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 12,
                backgroundColor: '#f3f4f6',
                color: '#6b7280',
                fontWeight: 600,
              }}
            >
              {LEVEL_LABEL[level]} 계획
            </span>
            {isToday && (
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 12,
                  backgroundColor: '#fef3c7',
                  color: '#d97706',
                  fontWeight: 700,
                }}
              >
                TODAY
              </span>
            )}
          </div>

          {/* Title */}
          <h3
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: '#111827',
              lineHeight: 1.4,
              marginBottom: 4,
            }}
          >
            {item.title}
          </h3>

          {/* Period */}
          <p style={{ fontSize: 12, color: '#9ca3af' }}>
            {formatPeriodKey(item.period_key, level)}
          </p>
        </div>

        <button
          onClick={onClose}
          style={{
            padding: 6,
            borderRadius: 6,
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>진행률</span>
          <span style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{progress}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              backgroundColor: borderColor,
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {/* Status & Priority */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f3f4f6',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            padding: '8px 10px',
            borderRadius: 8,
            backgroundColor: '#f9fafb',
          }}
        >
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3 }}>상태</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
            {STATUS_CONFIG[item.status].label}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            padding: '8px 10px',
            borderRadius: 8,
            backgroundColor: '#f9fafb',
          }}
        >
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3 }}>우선순위</div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color:
                item.priority === 'high'
                  ? '#dc2626'
                  : item.priority === 'medium'
                  ? '#ca8a04'
                  : '#9ca3af',
            }}
          >
            {PRIORITY_CONFIG[item.priority].label}
          </div>
        </div>
      </div>

      {/* Categories */}
      {item.categories.length > 0 && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 8 }}>
            카테고리
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {item.categories.map((cat) => {
              const catInfo = CATEGORIES.find((c) => c.value === cat)
              const color = getCategoryColor(cat)
              return (
                <span
                  key={cat}
                  style={{
                    fontSize: 11,
                    padding: '3px 10px',
                    borderRadius: 12,
                    backgroundColor: color + '18',
                    color,
                    fontWeight: 600,
                  }}
                >
                  {catInfo?.label ?? cat}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Description */}
      {item.description && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 6 }}>
            설명
          </div>
          <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {item.description}
          </p>
        </div>
      )}

      {/* Connected children */}
      {isExpanded && nextLevel && (
        <div style={{ padding: '12px 16px', flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              color: '#6b7280',
              fontWeight: 500,
              marginBottom: 8,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>연결된 {LEVEL_LABEL[nextLevel]} 계획</span>
            <span style={{ color: '#9ca3af' }}>{children.length}개</span>
          </div>

          {children.length === 0 ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: 12,
                backgroundColor: '#f9fafb',
                borderRadius: 8,
              }}
            >
              연결된 하위 계획이 없습니다
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {children.map((child) => {
                const childBorder = getStatusBorderColor(child.status)
                return (
                  <div
                    key={child.id}
                    onClick={() => onExpandChild(child)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid #f3f4f6`,
                      borderLeft: `3px solid ${childBorder}`,
                      backgroundColor: '#fafafa',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#111827',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {child.title}
                      </div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                        {formatPeriodKey(child.period_key, nextLevel)}
                      </div>
                    </div>
                    <ChevronRight size={12} color="#9ca3af" />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #f3f4f6',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => router.push(editHref)}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            color: '#374151',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <ExternalLink size={12} />
          편집 페이지
        </button>
      </div>
    </div>
  )
}
