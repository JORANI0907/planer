'use client'

import { CATEGORIES, STATUS_CONFIG } from '@/lib/types'
import {
  Home,
  ChevronsLeft,
  Minus,
  Plus,
  Maximize2,
  Search,
  X,
} from 'lucide-react'

interface FlowMapToolbarProps {
  year: number
  scale: number
  filterCategory: string | null
  filterStatus: string | null
  searchQuery: string
  onYearChange: (year: number) => void
  onGoToday: () => void
  onCollapseAll: () => void
  onFilterCategory: (cat: string | null) => void
  onFilterStatus: (status: string | null) => void
  onSearchChange: (q: string) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFitView: () => void
}

export function FlowMapToolbar({
  year,
  scale,
  filterCategory,
  filterStatus,
  searchQuery,
  onYearChange,
  onGoToday,
  onCollapseAll,
  onFilterCategory,
  onFilterStatus,
  onSearchChange,
  onZoomIn,
  onZoomOut,
  onFitView,
}: FlowMapToolbarProps) {
  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i)

  return (
    <div
      style={{
        height: 52,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 8,
        flexShrink: 0,
        zIndex: 20,
        overflowX: 'auto',
      }}
    >
      {/* Year selector */}
      <select
        value={year}
        onChange={(e) => onYearChange(Number(e.target.value))}
        style={{
          padding: '5px 10px',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          fontSize: 13,
          fontWeight: 600,
          color: '#374151',
          backgroundColor: '#f9fafb',
          cursor: 'pointer',
          outline: 'none',
          flexShrink: 0,
        }}
      >
        {yearOptions.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>

      {/* Divider */}
      <div style={{ width: 1, height: 24, backgroundColor: '#e5e7eb', flexShrink: 0 }} />

      {/* Go to today */}
      <ToolbarButton onClick={onGoToday} title="오늘로 이동">
        <Home size={14} />
        <span>오늘</span>
      </ToolbarButton>

      {/* Collapse all */}
      <ToolbarButton onClick={onCollapseAll} title="전체 접기">
        <ChevronsLeft size={14} />
        <span>접기</span>
      </ToolbarButton>

      {/* Divider */}
      <div style={{ width: 1, height: 24, backgroundColor: '#e5e7eb', flexShrink: 0 }} />

      {/* Category filter */}
      <select
        value={filterCategory ?? ''}
        onChange={(e) => onFilterCategory(e.target.value || null)}
        style={{
          padding: '5px 10px',
          borderRadius: 8,
          border: `1px solid ${filterCategory ? '#3b82f6' : '#e5e7eb'}`,
          fontSize: 12,
          color: filterCategory ? '#2563eb' : '#6b7280',
          backgroundColor: filterCategory ? '#eff6ff' : '#f9fafb',
          cursor: 'pointer',
          outline: 'none',
          flexShrink: 0,
          fontWeight: filterCategory ? 600 : 400,
        }}
      >
        <option value="">카테고리 전체</option>
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      {/* Status filter */}
      <select
        value={filterStatus ?? ''}
        onChange={(e) => onFilterStatus(e.target.value || null)}
        style={{
          padding: '5px 10px',
          borderRadius: 8,
          border: `1px solid ${filterStatus ? '#8b5cf6' : '#e5e7eb'}`,
          fontSize: 12,
          color: filterStatus ? '#7c3aed' : '#6b7280',
          backgroundColor: filterStatus ? '#f5f3ff' : '#f9fafb',
          cursor: 'pointer',
          outline: 'none',
          flexShrink: 0,
          fontWeight: filterStatus ? 600 : 400,
        }}
      >
        <option value="">상태 전체</option>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <option key={key} value={key}>
            {cfg.label}
          </option>
        ))}
      </select>

      {/* Divider */}
      <div style={{ width: 1, height: 24, backgroundColor: '#e5e7eb', flexShrink: 0 }} />

      {/* Search */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Search
          size={13}
          color="#9ca3af"
          style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}
        />
        <input
          type="text"
          placeholder="계획 검색..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            padding: '5px 28px 5px 26px',
            borderRadius: 8,
            border: `1px solid ${searchQuery ? '#3b82f6' : '#e5e7eb'}`,
            fontSize: 12,
            color: '#374151',
            backgroundColor: searchQuery ? '#eff6ff' : '#f9fafb',
            outline: 'none',
            width: 140,
          }}
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            style={{
              position: 'absolute',
              right: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              padding: 2,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#9ca3af',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Zoom controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '2px 4px',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onZoomOut}
          style={{
            padding: '3px 6px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            borderRadius: 4,
          }}
        >
          <Minus size={12} />
        </button>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#374151',
            minWidth: 40,
            textAlign: 'center',
          }}
        >
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={onZoomIn}
          style={{
            padding: '3px 6px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            borderRadius: 4,
          }}
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Fit view */}
      <ToolbarButton onClick={onFitView} title="화면 맞춤">
        <Maximize2 size={14} />
      </ToolbarButton>
    </div>
  )
}

function ToolbarButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '5px 10px',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        color: '#374151',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}
