'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

export type ViewMode = 'basic' | 'quarterly' | 'monthly' | 'weekly' | 'daily'

const VIEW_MODES: { key: ViewMode; label: string }[] = [
  { key: 'basic', label: '기본보기' },
  { key: 'quarterly', label: '분기보기' },
  { key: 'monthly', label: '월간보기' },
  { key: 'weekly', label: '주간보기' },
  { key: 'daily', label: '일간보기' },
]

interface FlowMapV2ToolbarProps {
  year: number
  viewMode: ViewMode
  onYearChange: (year: number) => void
  onViewModeChange: (mode: ViewMode) => void
}

export function FlowMapV2Toolbar({
  year,
  viewMode,
  onYearChange,
  onViewModeChange,
}: FlowMapV2ToolbarProps) {
  return (
    <div
      style={{
        height: 52,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        flexShrink: 0,
        zIndex: 20,
        overflowX: 'auto',
      }}
    >
      {/* 연도 네비게이션 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <button
          onClick={() => onYearChange(year - 1)}
          style={{
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronLeft size={14} color="#6b7280" />
        </button>
        <span
          style={{
            fontWeight: 700,
            fontSize: 15,
            padding: '0 8px',
            color: '#111827',
            whiteSpace: 'nowrap',
          }}
        >
          {year}년
        </span>
        <button
          onClick={() => onYearChange(year + 1)}
          style={{
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid #e5e7eb',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronRight size={14} color="#6b7280" />
        </button>
      </div>

      <div style={{ width: 1, height: 22, backgroundColor: '#e5e7eb', flexShrink: 0 }} />

      {/* 뷰모드 토글 */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          backgroundColor: '#f3f4f6',
          borderRadius: 8,
          padding: 3,
          flexShrink: 0,
        }}
      >
        {VIEW_MODES.map(({ key, label }) => {
          const active = viewMode === key
          return (
            <button
              key={key}
              onClick={() => onViewModeChange(key)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                backgroundColor: active ? '#ffffff' : 'transparent',
                color: active ? '#1d4ed8' : '#6b7280',
                border: active ? '1px solid #dbeafe' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.07)' : 'none',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
