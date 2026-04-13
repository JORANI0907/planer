'use client'

import { useRef, useState, useCallback } from 'react'
import type { PlanItem } from '@/lib/types'
import { PlanCard } from './PlanCard'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'

const QUARTER_CONFIG: Record<string, { label: string; months: string; headerBg: string; colBg: string; colBorder: string }> = {
  'Q1': { label: '1분기', months: '1 · 2 · 3월', headerBg: '#1d4ed8', colBg: '#eff6ff', colBorder: '#bfdbfe' },
  'Q2': { label: '2분기', months: '4 · 5 · 6월', headerBg: '#15803d', colBg: '#f0fdf4', colBorder: '#bbf7d0' },
  'Q3': { label: '3분기', months: '7 · 8 · 9월', headerBg: '#b45309', colBg: '#fffbeb', colBorder: '#fde68a' },
  'Q4': { label: '4분기', months: '10 · 11 · 12월', headerBg: '#6d28d9', colBg: '#faf5ff', colBorder: '#ddd6fe' },
}

interface KanbanBoardProps {
  year: number
  itemsByQuarter: Map<string, PlanItem[]>
  searchQuery: string
  filterStatus: string | null
  onDrillDown: (quarterKey: string) => void
  onMoveItem: (item: PlanItem, targetKey: string) => void
}

export function KanbanBoard({ year, itemsByQuarter, searchQuery, filterStatus, onDrillDown, onMoveItem }: KanbanBoardProps) {
  const draggingItem = useRef<PlanItem | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const quarterKeys = [1, 2, 3, 4].map(q => `${year}-Q${q}`)

  const handleDragStart = useCallback((item: PlanItem) => {
    draggingItem.current = item
  }, [])

  const handleDrop = useCallback((targetKey: string) => {
    if (draggingItem.current) {
      onMoveItem(draggingItem.current, targetKey)
      draggingItem.current = null
    }
    setDragOverKey(null)
  }, [onMoveItem])

  const totalItems = [...itemsByQuarter.values()].reduce((s, arr) => s + arr.length, 0)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Board header summary */}
      <div style={{ padding: '8px 20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{year}년 분기별 계획</span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>총 {totalItems}개 계획</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>• 카드를 드래그하여 분기 간 이동 • 📋 아이콘으로 월간 상세 확인</span>
      </div>

      {/* Kanban columns */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: '20px',
        gap: 16,
        alignItems: 'flex-start',
      }}>
        {/* Annual node */}
        <div style={{ flexShrink: 0, paddingTop: 2 }}>
          <div style={{
            width: 110,
            padding: '20px 14px',
            backgroundColor: '#0f172a',
            borderRadius: 14,
            color: '#fff',
            textAlign: 'center',
            boxShadow: '0 6px 24px rgba(15,23,42,0.25)',
            userSelect: 'none',
          }}>
            <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.08em', marginBottom: 6, textTransform: 'uppercase' }}>Annual</div>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{year}</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, opacity: 0.8 }}>년 계획</div>
            <div style={{ marginTop: 10, height: 1, backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.5 }}>4개 분기</div>
          </div>
          {/* Arrow line */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 0, marginTop: 8 }}>
            <div style={{ width: '100%', height: 2, backgroundColor: '#e2e8f0', borderRadius: 1 }} />
          </div>
        </div>

        {/* Quarter columns */}
        {quarterKeys.map((key) => {
          const q = key.split('-')[1]
          const cfg = QUARTER_CONFIG[q]
          const allItems = itemsByQuarter.get(key) ?? []
          const filteredItems = allItems.filter(item => {
            if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
            if (filterStatus && item.status !== filterStatus) return false
            return true
          })
          const dimmed = (searchQuery || filterStatus) && filteredItems.length === 0

          return (
            <QuarterColumn
              key={key}
              quarterKey={key}
              config={cfg}
              items={filteredItems}
              allCount={allItems.length}
              isDragOver={dragOverKey === key}
              dimmed={!!dimmed}
              onDrillDown={() => onDrillDown(key)}
              onDragStart={handleDragStart}
              onDragOver={() => setDragOverKey(key)}
              onDragLeave={() => { if (dragOverKey === key) setDragOverKey(null) }}
              onDrop={() => handleDrop(key)}
            />
          )
        })}

        <div style={{ width: 20, flexShrink: 0 }} />
      </div>
    </div>
  )
}

interface QuarterColumnProps {
  quarterKey: string
  config: typeof QUARTER_CONFIG[string]
  items: PlanItem[]
  allCount: number
  isDragOver: boolean
  dimmed: boolean
  onDrillDown: () => void
  onDragStart: (item: PlanItem) => void
  onDragOver: () => void
  onDragLeave: () => void
  onDrop: () => void
}

function QuarterColumn({ config, items, allCount, isDragOver, dimmed, onDrillDown, onDragStart, onDragOver, onDragLeave, onDrop }: QuarterColumnProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      style={{
        width: 250,
        flexShrink: 0,
        borderRadius: 14,
        border: `2px solid ${isDragOver ? config.headerBg : config.colBorder}`,
        backgroundColor: isDragOver ? config.colBorder + '80' : config.colBg,
        transition: 'border-color 0.15s, background-color 0.15s',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        opacity: dimmed ? 0.4 : 1,
      }}
      onDragOver={e => { e.preventDefault(); onDragOver() }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop() }}
    >
      {/* Header */}
      <div style={{ padding: '12px 14px', backgroundColor: config.headerBg, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#fff', display: 'flex' }}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{config.label}</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 }}>{config.months}</div>
        </div>
        <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 20, padding: '2px 8px', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
          {allCount}
        </span>
        <button onClick={onDrillDown} title="월간 상세 보기" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'rgba(255,255,255,0.8)', display: 'flex', flexShrink: 0 }}>
          <ExternalLink size={14} />
        </button>
      </div>

      {/* Cards */}
      {!collapsed && (
        <div style={{
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxHeight: 'calc(100vh - 220px)',
          overflowY: 'auto',
          minHeight: 100,
        }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: '24px 0', border: '1.5px dashed #d1d5db', borderRadius: 8 }}>
              <div>계획 없음</div>
              <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>드래그하여 이동</div>
            </div>
          ) : (
            items.map(item => (
              <PlanCard key={item.id} item={item} onDragStart={() => onDragStart(item)} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
