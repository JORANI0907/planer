'use client'

import { useRef, useState, useCallback } from 'react'
import type { PlanItem } from '@/lib/types'
import { PlanCard } from './PlanCard'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'

const QUARTER_CONFIG: Record<string, {
  label: string; months: string
  headerBg: string; colBg: string; colBorder: string; dragBg: string
}> = {
  'Q1': { label: '1분기', months: '1 · 2 · 3월', headerBg: '#1d4ed8', colBg: '#eff6ff', colBorder: '#bfdbfe', dragBg: '#dbeafe' },
  'Q2': { label: '2분기', months: '4 · 5 · 6월', headerBg: '#15803d', colBg: '#f0fdf4', colBorder: '#bbf7d0', dragBg: '#dcfce7' },
  'Q3': { label: '3분기', months: '7 · 8 · 9월', headerBg: '#b45309', colBg: '#fffbeb', colBorder: '#fde68a', dragBg: '#fef9c3' },
  'Q4': { label: '4분기', months: '10 · 11 · 12월', headerBg: '#6d28d9', colBg: '#faf5ff', colBorder: '#ddd6fe', dragBg: '#ede9fe' },
}

interface KanbanBoardProps {
  year: number
  itemsByQuarter: Map<string, PlanItem[]>
  searchQuery: string
  filterStatus: string | null
  onCardClick: (item: PlanItem) => void
  onAddItem: (quarterKey: string) => void
  onMoveItem: (item: PlanItem, targetKey: string) => void
}

export function KanbanBoard({
  year, itemsByQuarter, searchQuery, filterStatus,
  onCardClick, onAddItem, onMoveItem,
}: KanbanBoardProps) {
  // 현재 드래그 중인 아이템을 ref로 관리 (리렌더 없이 안전하게 유지)
  const draggingItem = useRef<PlanItem | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const quarterKeys = [1, 2, 3, 4].map(q => `${year}-Q${q}`)

  const handleDragStart = useCallback((item: PlanItem) => {
    draggingItem.current = item
    setDraggingId(item.id)
  }, [])

  const handleDragEnd = useCallback(() => {
    // 드래그가 어디서 끝나든 상태 초기화
    draggingItem.current = null
    setDraggingId(null)
    setDragOverKey(null)
  }, [])

  const handleDrop = useCallback((targetKey: string) => {
    const item = draggingItem.current
    if (item) {
      onMoveItem(item, targetKey)
    }
    draggingItem.current = null
    setDraggingId(null)
    setDragOverKey(null)
  }, [onMoveItem])

  const totalItems = [...itemsByQuarter.values()].reduce((s, arr) => s + arr.length, 0)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Board header */}
      <div style={{
        padding: '8px 20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff',
        display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{year}년 분기별 계획</span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>총 {totalItems}개</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>
          • 카드 드래그 → 분기 이동 &nbsp;• 카드 클릭 → 월간 상세
        </span>
      </div>

      {/* Columns */}
      <div style={{
        flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden',
        padding: '20px', gap: 16, alignItems: 'flex-start',
      }}>
        {/* Annual node */}
        <div style={{ flexShrink: 0, paddingTop: 2 }}>
          <div style={{
            width: 110, padding: '20px 14px', backgroundColor: '#0f172a',
            borderRadius: 14, color: '#fff', textAlign: 'center',
            boxShadow: '0 6px 24px rgba(15,23,42,0.25)', userSelect: 'none',
          }}>
            <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.08em', marginBottom: 6, textTransform: 'uppercase' }}>Annual</div>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{year}</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, opacity: 0.8 }}>년 계획</div>
            <div style={{ marginTop: 10, height: 1, backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <div style={{ marginTop: 8, fontSize: 11, opacity: 0.5 }}>4개 분기</div>
          </div>
          <div style={{ width: '100%', height: 2, backgroundColor: '#e2e8f0', borderRadius: 1, marginTop: 8 }} />
        </div>

        {/* Quarter columns */}
        {quarterKeys.map(key => {
          const q = key.split('-')[1]
          const cfg = QUARTER_CONFIG[q]
          const allItems = itemsByQuarter.get(key) ?? []
          const filteredItems = allItems.filter(item => {
            if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
            if (filterStatus && item.status !== filterStatus) return false
            return true
          })
          const dimmed = !!(searchQuery || filterStatus) && filteredItems.length === 0

          return (
            <QuarterColumn
              key={key}
              quarterKey={key}
              config={cfg}
              items={filteredItems}
              allCount={allItems.length}
              isDragOver={dragOverKey === key}
              draggingId={draggingId}
              dimmed={dimmed}
              onCardClick={onCardClick}
              onAddItem={() => onAddItem(key)}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragEnter={() => setDragOverKey(key)}
              onDragLeave={(e) => {
                // 자식 요소로 진입 시 오발동 방지: 컬럼 바깥으로 나갈 때만 해제
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverKey(null)
                }
              }}
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
  draggingId: string | null
  dimmed: boolean
  onCardClick: (item: PlanItem) => void
  onAddItem: () => void
  onDragStart: (item: PlanItem) => void
  onDragEnd: () => void
  onDragEnter: () => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: () => void
}

function QuarterColumn({
  config, items, allCount, isDragOver, draggingId, dimmed,
  onCardClick, onAddItem, onDragStart, onDragEnd,
  onDragEnter, onDragLeave, onDrop,
}: QuarterColumnProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      style={{
        width: 250,
        flexShrink: 0,
        borderRadius: 14,
        border: `2px solid ${isDragOver ? config.headerBg : config.colBorder}`,
        backgroundColor: isDragOver ? config.dragBg : config.colBg,
        transition: 'border-color 0.12s, background-color 0.12s',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        opacity: dimmed ? 0.35 : 1,
        // 드래그 오버 시 살짝 스케일업
        transform: isDragOver ? 'scale(1.01)' : 'scale(1)',
      }}
      onDragEnter={e => { e.preventDefault(); onDragEnter() }}
      onDragOver={e => { e.preventDefault() }} // drop 허용에 필수
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop() }}
    >
      {/* Header */}
      <div style={{ padding: '12px 14px', backgroundColor: config.headerBg, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#fff', display: 'flex' }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{config.label}</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 }}>{config.months}</div>
        </div>
        <span style={{
          backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff',
          borderRadius: 20, padding: '2px 8px', fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>
          {allCount}
        </span>
        <button
          onClick={onAddItem}
          title="계획 추가"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'rgba(255,255,255,0.8)', display: 'flex', flexShrink: 0 }}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Cards area — 접힌 상태에서도 드롭 가능하도록 최소 높이 유지 */}
      {!collapsed ? (
        <div style={{
          padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
          maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', minHeight: 80,
        }}>
          {items.length === 0 ? (
            <div style={{
              textAlign: 'center', color: isDragOver ? config.headerBg : '#9ca3af',
              fontSize: 12, padding: '24px 8px',
              border: `1.5px dashed ${isDragOver ? config.headerBg : '#d1d5db'}`,
              borderRadius: 8,
              transition: 'all 0.12s',
            }}>
              {isDragOver ? '여기에 놓기 ↓' : '계획 없음'}
            </div>
          ) : (
            items.map(item => (
              <PlanCard
                key={item.id}
                item={item}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onClick={onCardClick}
                isDragging={draggingId === item.id}
              />
            ))
          )}
        </div>
      ) : (
        // 접힌 상태: 드래그 힌트 표시
        <div style={{
          padding: '8px 10px', textAlign: 'center', fontSize: 11,
          color: isDragOver ? config.headerBg : '#9ca3af',
          backgroundColor: isDragOver ? config.dragBg : 'transparent',
          transition: 'all 0.12s',
        }}>
          {isDragOver ? '여기에 놓기 ↓' : `${allCount}개 (접힘)`}
        </div>
      )}
    </div>
  )
}
