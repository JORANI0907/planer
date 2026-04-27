'use client'

import { STATUS_CONFIG } from '@/lib/types'
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react'

interface FlowMapToolbarProps {
  year: number
  searchQuery: string
  filterStatus: string | null
  onYearChange: (year: number) => void
  onSearchChange: (q: string) => void
  onFilterStatus: (s: string | null) => void
}

export function FlowMapToolbar({ year, searchQuery, filterStatus, onYearChange, onSearchChange, onFilterStatus }: FlowMapToolbarProps) {
  return (
    <div style={{
      height: 52,
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 10,
      flexShrink: 0,
      zIndex: 20,
      overflowX: 'auto',
    }}>
      {/* Year nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <button onClick={() => onYearChange(year - 1)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={14} color="#6b7280" />
        </button>
        <span style={{ fontWeight: 700, fontSize: 15, padding: '0 8px', color: '#111827' }}>{year}년</span>
        <button onClick={() => onYearChange(year + 1)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ChevronRight size={14} color="#6b7280" />
        </button>
      </div>

      <div style={{ width: 1, height: 22, backgroundColor: '#e5e7eb', flexShrink: 0 }} />

      {/* Status filter chips */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const active = filterStatus === key
          const colors: Record<string, { bg: string; border: string; text: string }> = {
            pending: { bg: '#f3f4f6', border: '#d1d5db', text: '#374151' },
            in_progress: { bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8' },
            completed: { bg: '#dcfce7', border: '#86efac', text: '#15803d' },
            on_hold: { bg: '#ffedd5', border: '#fdba74', text: '#c2410c' },
          }
          const SHORT: Record<string, string> = { pending: '대기', in_progress: '진행', completed: '완료', on_hold: '보류' }
          const c = colors[key] ?? colors.pending
          return (
            <button
              key={key}
              onClick={() => onFilterStatus(active ? null : key)}
              style={{
                padding: '4px 8px',
                borderRadius: 20,
                fontSize: 11,
                border: `1.5px solid ${active ? c.border : '#e5e7eb'}`,
                cursor: 'pointer',
                fontWeight: active ? 700 : 400,
                backgroundColor: active ? c.bg : '#fff',
                color: active ? c.text : '#6b7280',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              <span className="hidden md:inline">{cfg.label}</span>
              <span className="md:hidden">{SHORT[key] ?? cfg.label}</span>
            </button>
          )
        })}
      </div>

      <div style={{ width: 1, height: 22, backgroundColor: '#e5e7eb', flexShrink: 0 }} />

      {/* Search */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Search size={13} color="#9ca3af" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="text"
          placeholder="검색..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="w-24 md:w-36"
          style={{
            paddingLeft: 26,
            paddingRight: searchQuery ? 26 : 10,
            height: 32,
            borderRadius: 8,
            border: `1px solid ${searchQuery ? '#3b82f6' : '#e5e7eb'}`,
            fontSize: 12,
            backgroundColor: searchQuery ? '#eff6ff' : '#f9fafb',
            outline: 'none',
            color: '#374151',
          }}
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <X size={12} color="#9ca3af" />
          </button>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <span className="hidden md:block" style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>카드를 드래그하여 분기 이동 가능</span>
    </div>
  )
}
