'use client'

import { useRef, useState, useCallback } from 'react'
import type { PlanItem } from '@/lib/types'
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/types'
import { formatPeriodKey } from '@/lib/flowmap-layout'
import { ChevronDown, ChevronRight, Plus, Pencil, Loader2 } from 'lucide-react'

const QUARTER_CONFIG: Record<string, {
  label: string; months: string
  headerBg: string; colBg: string; colBorder: string; dragBg: string
}> = {
  'Q1': { label: '1분기', months: '1 · 2 · 3월', headerBg: '#1d4ed8', colBg: '#eff6ff', colBorder: '#bfdbfe', dragBg: '#dbeafe' },
  'Q2': { label: '2분기', months: '4 · 5 · 6월', headerBg: '#15803d', colBg: '#f0fdf4', colBorder: '#bbf7d0', dragBg: '#dcfce7' },
  'Q3': { label: '3분기', months: '7 · 8 · 9월', headerBg: '#b45309', colBg: '#fffbeb', colBorder: '#fde68a', dragBg: '#fef9c3' },
  'Q4': { label: '4분기', months: '10 · 11 · 12월', headerBg: '#6d28d9', colBg: '#faf5ff', colBorder: '#ddd6fe', dragBg: '#ede9fe' },
}

const STATUS_DOT: Record<string, string> = {
  completed: '#22c55e', in_progress: '#3b82f6', on_hold: '#f97316', pending: '#9ca3af',
}

interface KanbanBoardProps {
  year: number
  annualItems: PlanItem[]
  itemsByQuarter: Map<string, PlanItem[]>
  searchQuery: string
  filterStatus: string | null
  onCardClick: (item: PlanItem) => void
  onAddAnnual: () => void
  onAddItem: (quarterKey: string) => void
  onMoveItem: (item: PlanItem, targetKey: string) => void
  onEditItem: (item: PlanItem) => void
  onDeleteItems: (ids: string[]) => void
}

export function KanbanBoard({
  year, annualItems, itemsByQuarter, searchQuery, filterStatus,
  onCardClick, onAddAnnual, onAddItem, onMoveItem, onEditItem, onDeleteItems,
}: KanbanBoardProps) {
  const draggingItem = useRef<PlanItem | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const quarterKeys = [1, 2, 3, 4].map(q => `${year}-Q${q}`)

  const handleDragStart = useCallback((item: PlanItem) => {
    draggingItem.current = item
    setDraggingId(item.id)
  }, [])

  const handleDragEnd = useCallback(() => {
    draggingItem.current = null
    setDraggingId(null)
    setDragOverKey(null)
  }, [])

  const handleDrop = useCallback((targetKey: string) => {
    const item = draggingItem.current
    if (item) onMoveItem(item, targetKey)
    draggingItem.current = null
    setDraggingId(null)
    setDragOverKey(null)
  }, [onMoveItem])

  const filterItems = (items: PlanItem[]) => items.filter(item => {
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (filterStatus && item.status !== filterStatus) return false
    return true
  })

  const totalItems = annualItems.length + [...itemsByQuarter.values()].reduce((s, arr) => s + arr.length, 0)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: '8px 20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff',
        display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{year}년 계획</span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>총 {totalItems}개</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>
          항목 클릭 → 선택 &nbsp;• 보기 버튼 → 하위 계획 &nbsp;• 드래그 → 분기 이동
        </span>
      </div>

      <div style={{
        flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden',
        padding: '20px', gap: 16, alignItems: 'flex-start',
      }}>
        {/* 연간 계획 컬럼 */}
        <AnnualColumn
          year={year}
          items={filterItems(annualItems)}
          allCount={annualItems.length}
          draggingId={draggingId}
          onAddItem={onAddAnnual}
          onEditItem={onEditItem}
          onDeleteItems={onDeleteItems}
          onCardClick={onCardClick}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />

        {/* 분기 컬럼들 */}
        {quarterKeys.map(key => {
          const q = key.split('-')[1]
          const cfg = QUARTER_CONFIG[q]
          const allItems = itemsByQuarter.get(key) ?? []
          const filteredItems = filterItems(allItems)
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
              onEditItem={onEditItem}
              onDeleteItems={onDeleteItems}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragEnter={() => setDragOverKey(key)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverKey(null)
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

// ── 삭제 확인 다이얼로그 ─────────────────────────────────────────
interface DeleteConfirmProps {
  count: number
  deleting: boolean
  onConfirm: () => void
  onCancel: () => void
}
function DeleteConfirm({ count, deleting, onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80, backgroundColor: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        backgroundColor: '#fff', borderRadius: 14, padding: '24px 28px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.2)', maxWidth: 300, width: '100%', textAlign: 'center',
        animation: 'kbPopIn 0.15s ease',
      }}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>🗑️</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 6 }}>계획 삭제</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
          <strong style={{ color: '#ef4444' }}>{count}개</strong> 계획을 삭제하시겠습니까?<br />
          <span style={{ fontSize: 11 }}>이 작업은 되돌릴 수 없습니다.</span>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onCancel}
            style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 13, color: '#374151', cursor: 'pointer', fontWeight: 500 }}>
            취소
          </button>
          <button onClick={onConfirm} disabled={deleting}
            style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: deleting ? 0.7 : 1 }}>
            {deleting && <Loader2 size={13} style={{ animation: 'kbSpin 1s linear infinite' }} />}
            삭제
          </button>
        </div>
      </div>
      <style>{`
        @keyframes kbPopIn { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes kbSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ── 공통: 카드 아이템 렌더 ────────────────────────────────────────
interface CardItemProps {
  item: PlanItem
  isSelected: boolean
  isDragging: boolean
  onToggle: (item: PlanItem) => void
  onEdit: (item: PlanItem) => void
  onView: (item: PlanItem) => void   // 하위 보기 (팝업 열기)
  onDragStart: (item: PlanItem) => void
  onDragEnd: () => void
  showView?: boolean
}

function CardItem({ item, isSelected, isDragging, onToggle, onEdit, onView, onDragStart, onDragEnd, showView = true }: CardItemProps) {
  const dragStartFired = useRef(false)
  const sc = STATUS_DOT[item.status] ?? '#9ca3af'

  return (
    <div
      draggable
      onDragStart={e => {
        dragStartFired.current = true
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', item.id)
        onDragStart(item)
      }}
      onDragEnd={() => { dragStartFired.current = false; onDragEnd() }}
      onClick={() => {
        if (!dragStartFired.current) onToggle(item)
        dragStartFired.current = false
      }}
      style={{
        backgroundColor: isSelected ? '#eff6ff' : '#fff',
        border: `1.5px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
        borderRadius: 10,
        padding: '9px 11px',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        transition: 'all 0.12s',
        opacity: isDragging ? 0.4 : 1,
        position: 'relative',
        boxShadow: isSelected ? '0 0 0 2px rgba(59,130,246,0.2)' : 'none',
      }}
      onMouseEnter={e => {
        if (isDragging || isSelected) return
        e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.08)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        if (isSelected) return
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'none'
      }}
    >
      {/* 선택 체크 표시 */}
      {isSelected && (
        <div style={{
          position: 'absolute', top: 6, left: 6,
          width: 16, height: 16, borderRadius: 4,
          backgroundColor: '#3b82f6', border: '2px solid #3b82f6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: '#fff', fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>
        </div>
      )}

      {/* 상태 점 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5, paddingLeft: isSelected ? 20 : 0 }}>
        <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>
          {formatPeriodKey(item.period_key, item.level)}
        </span>
        <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: sc, flexShrink: 0 }} />
      </div>

      {/* 제목 */}
      <div style={{
        fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1.4,
        marginBottom: 6, paddingLeft: isSelected ? 20 : 0,
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {item.title}
      </div>

      {/* 하단: 상태 + 우선순위 + 버튼들 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: isSelected ? 20 : 0 }}>
        <span style={{ fontSize: 10, color: sc, fontWeight: 600 }}>● {STATUS_CONFIG[item.status]?.label}</span>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>{PRIORITY_CONFIG[item.priority]?.label}</span>
        <div style={{ flex: 1 }} />
        {/* 수정 버튼 */}
        <button
          onClick={e => { e.stopPropagation(); onEdit(item) }}
          title="수정"
          style={{
            padding: '3px 5px', border: '1px solid #e5e7eb', background: '#fff',
            borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
            fontSize: 10, color: '#6b7280',
          }}
        >
          <Pencil size={9} /> 수정
        </button>
        {/* 하위 보기 버튼 */}
        {showView && (
          <button
            onClick={e => { e.stopPropagation(); onView(item) }}
            title="하위 계획 보기"
            style={{
              padding: '3px 5px', border: '1px solid #bfdbfe', background: '#eff6ff',
              borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
              fontSize: 10, color: '#1d4ed8',
            }}
          >
            보기 <ChevronRight size={9} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── 공통: 컬럼 헤더 액션 버튼 ────────────────────────────────────
interface ColumnHeaderActionsProps {
  allCount: number
  selCount: number
  onDelete: () => void
  onAdd: () => void
  headerBg: string
}
function ColumnHeaderActions({ allCount, selCount, onDelete, onAdd, headerBg }: ColumnHeaderActionsProps) {
  return (
    <>
      {selCount > 0 && (
        <span style={{ fontSize: 10, color: '#fff', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '1px 6px', fontWeight: 600 }}>
          {selCount}선택
        </span>
      )}
      <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 20, padding: '2px 7px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
        {allCount}
      </span>
      <button
        onClick={() => selCount > 0 && onDelete()}
        title={selCount > 0 ? `${selCount}개 삭제` : '항목을 클릭해서 선택하세요'}
        style={{
          width: 22, height: 22, borderRadius: 5, flexShrink: 0,
          border: `1.5px solid ${selCount > 0 ? 'rgba(255,100,100,0.7)' : 'rgba(255,255,255,0.2)'}`,
          background: selCount > 0 ? 'rgba(255,80,80,0.2)' : 'transparent',
          color: selCount > 0 ? '#fca5a5' : 'rgba(255,255,255,0.3)',
          cursor: selCount > 0 ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, lineHeight: 1, transition: 'all 0.12s',
        }}
      >−</button>
      <button
        onClick={onAdd}
        title="계획 추가"
        style={{
          width: 22, height: 22, borderRadius: 5, flexShrink: 0,
          border: '1.5px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.15)',
          color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Plus size={13} />
      </button>
    </>
  )
}

// ── 연간 계획 컬럼 ────────────────────────────────────────────────
interface AnnualColumnProps {
  year: number
  items: PlanItem[]
  allCount: number
  draggingId: string | null
  onAddItem: () => void
  onEditItem: (item: PlanItem) => void
  onDeleteItems: (ids: string[]) => void
  onCardClick: (item: PlanItem) => void
  onDragStart: (item: PlanItem) => void
  onDragEnd: () => void
}

function AnnualColumn({
  year, items, allCount, draggingId,
  onAddItem, onEditItem, onDeleteItems, onCardClick,
  onDragStart, onDragEnd,
}: AnnualColumnProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleToggle = (item: PlanItem) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(item.id) ? next.delete(item.id) : next.add(item.id)
      return next
    })
  }

  const handleDeleteConfirmed = () => {
    setDeleting(true)
    const ids = [...selectedIds]
    setSelectedIds(new Set())
    setShowDeleteConfirm(false)
    setDeleting(false)
    onDeleteItems(ids)
  }

  const selCount = selectedIds.size
  const HEADER_BG = '#0f172a'

  return (
    <>
      <div style={{
        width: 240, flexShrink: 0, borderRadius: 14,
        border: '2px solid #334155',
        backgroundColor: '#f8fafc',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div style={{ padding: '10px 12px', backgroundColor: HEADER_BG, display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#fff', display: 'flex', flexShrink: 0 }}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>{year}년 연간계획</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 1 }}>Annual Plan</div>
          </div>
          <ColumnHeaderActions
            allCount={allCount}
            selCount={selCount}
            onDelete={() => setShowDeleteConfirm(true)}
            onAdd={onAddItem}
            headerBg={HEADER_BG}
          />
        </div>

        {!collapsed ? (
          <div style={{
            padding: 10, display: 'flex', flexDirection: 'column', gap: 7,
            maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', minHeight: 80,
          }}>
            {items.length === 0 ? (
              <button
                onClick={onAddItem}
                style={{
                  textAlign: 'center', color: '#9ca3af', fontSize: 12,
                  padding: '24px 8px', border: '1.5px dashed #cbd5e1', borderRadius: 8,
                  cursor: 'pointer', background: 'transparent', width: '100%',
                }}
              >
                + 연간 계획 추가
              </button>
            ) : (
              items.map(item => (
                <CardItem
                  key={item.id}
                  item={item}
                  isSelected={selectedIds.has(item.id)}
                  isDragging={draggingId === item.id}
                  onToggle={handleToggle}
                  onEdit={onEditItem}
                  onView={onCardClick}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  showView={true}
                />
              ))
            )}
          </div>
        ) : (
          <div style={{ padding: '8px 10px', textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>
            {allCount}개 (접힘)
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <DeleteConfirm
          count={selCount}
          deleting={deleting}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  )
}

// ── 분기 컬럼 ─────────────────────────────────────────────────────
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
  onEditItem: (item: PlanItem) => void
  onDeleteItems: (ids: string[]) => void
  onDragStart: (item: PlanItem) => void
  onDragEnd: () => void
  onDragEnter: () => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: () => void
}

function QuarterColumn({
  config, items, allCount, isDragOver, draggingId, dimmed,
  onCardClick, onAddItem, onEditItem, onDeleteItems,
  onDragStart, onDragEnd, onDragEnter, onDragLeave, onDrop,
}: QuarterColumnProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleToggle = (item: PlanItem) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(item.id) ? next.delete(item.id) : next.add(item.id)
      return next
    })
  }

  const handleDeleteConfirmed = () => {
    setDeleting(true)
    const ids = [...selectedIds]
    setSelectedIds(new Set())
    setShowDeleteConfirm(false)
    setDeleting(false)
    onDeleteItems(ids)
  }

  const selCount = selectedIds.size

  return (
    <>
      <div
        style={{
          width: 260, flexShrink: 0, borderRadius: 14,
          border: `2px solid ${isDragOver ? config.headerBg : config.colBorder}`,
          backgroundColor: isDragOver ? config.dragBg : config.colBg,
          transition: 'border-color 0.12s, background-color 0.12s',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          opacity: dimmed ? 0.35 : 1,
          transform: isDragOver ? 'scale(1.01)' : 'scale(1)',
        }}
        onDragEnter={e => { e.preventDefault(); onDragEnter() }}
        onDragOver={e => { e.preventDefault() }}
        onDragLeave={onDragLeave}
        onDrop={e => { e.preventDefault(); onDrop() }}
      >
        {/* 헤더 */}
        <div style={{ padding: '10px 12px', backgroundColor: config.headerBg, display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#fff', display: 'flex', flexShrink: 0 }}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{config.label}</div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, marginTop: 1 }}>{config.months}</div>
          </div>
          <ColumnHeaderActions
            allCount={allCount}
            selCount={selCount}
            onDelete={() => setShowDeleteConfirm(true)}
            onAdd={onAddItem}
            headerBg={config.headerBg}
          />
        </div>

        {!collapsed ? (
          <div style={{
            padding: 10, display: 'flex', flexDirection: 'column', gap: 7,
            maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', minHeight: 80,
          }}>
            {items.length === 0 ? (
              <div style={{
                textAlign: 'center', color: isDragOver ? config.headerBg : '#9ca3af',
                fontSize: 12, padding: '24px 8px',
                border: `1.5px dashed ${isDragOver ? config.headerBg : '#d1d5db'}`,
                borderRadius: 8, transition: 'all 0.12s',
              }}>
                {isDragOver ? '여기에 놓기 ↓' : '계획 없음'}
              </div>
            ) : (
              items.map(item => (
                <CardItem
                  key={item.id}
                  item={item}
                  isSelected={selectedIds.has(item.id)}
                  isDragging={draggingId === item.id}
                  onToggle={handleToggle}
                  onEdit={onEditItem}
                  onView={onCardClick}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  showView={true}
                />
              ))
            )}
          </div>
        ) : (
          <div style={{
            padding: '8px 10px', textAlign: 'center', fontSize: 11,
            color: isDragOver ? config.headerBg : '#9ca3af',
            backgroundColor: isDragOver ? config.dragBg : 'transparent',
          }}>
            {isDragOver ? '여기에 놓기 ↓' : `${allCount}개 (접힘)`}
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <DeleteConfirm
          count={selCount}
          deleting={deleting}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  )
}
