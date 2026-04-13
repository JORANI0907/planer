'use client'

import { useRef, useState, useCallback } from 'react'
import type { PlanItem } from '@/lib/types'
import { PlanCard } from './PlanCard'
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

interface KanbanBoardProps {
  year: number
  itemsByQuarter: Map<string, PlanItem[]>
  searchQuery: string
  filterStatus: string | null
  onCardClick: (item: PlanItem) => void
  onAddItem: (quarterKey: string) => void
  onMoveItem: (item: PlanItem, targetKey: string) => void
  onEditItem: (item: PlanItem) => void
  onDeleteItems: (ids: string[]) => void
}

export function KanbanBoard({
  year, itemsByQuarter, searchQuery, filterStatus,
  onCardClick, onAddItem, onMoveItem, onEditItem, onDeleteItems,
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

  const totalItems = [...itemsByQuarter.values()].reduce((s, arr) => s + arr.length, 0)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
      <style>{`@keyframes kbSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── 체크박스 ──────────────────────────────────────────────────────
function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onChange() }}
      style={{
        width: 15, height: 15, borderRadius: 4, flexShrink: 0, marginTop: 4,
        border: `2px solid ${checked ? '#3b82f6' : 'rgba(255,255,255,0.5)'}`,
        backgroundColor: checked ? '#3b82f6' : 'transparent',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s', userSelect: 'none',
      }}
    >
      {checked && <span style={{ color: '#fff', fontSize: 8, lineHeight: 1, fontWeight: 900 }}>✓</span>}
    </div>
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

  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleDeleteConfirmed = async () => {
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
        {/* Header */}
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

          {/* 선택 카운트 */}
          {selCount > 0 && (
            <span style={{ fontSize: 10, color: '#fff', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '1px 6px', fontWeight: 600 }}>
              {selCount}선택
            </span>
          )}

          {/* 전체 카운트 */}
          <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 20, padding: '2px 7px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {allCount}
          </span>

          {/* − 버튼 */}
          <button
            onClick={() => selCount > 0 && setShowDeleteConfirm(true)}
            title={selCount > 0 ? `${selCount}개 삭제` : '항목을 선택하세요'}
            style={{
              width: 22, height: 22, borderRadius: 5, flexShrink: 0,
              border: `1.5px solid ${selCount > 0 ? 'rgba(255,100,100,0.7)' : 'rgba(255,255,255,0.25)'}`,
              background: selCount > 0 ? 'rgba(255,80,80,0.2)' : 'transparent',
              color: selCount > 0 ? '#fca5a5' : 'rgba(255,255,255,0.4)',
              cursor: selCount > 0 ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, lineHeight: 1, transition: 'all 0.12s',
            }}
          >−</button>

          {/* + 버튼 */}
          <button
            onClick={onAddItem}
            title="계획 추가"
            style={{
              width: 22, height: 22, borderRadius: 5, flexShrink: 0,
              border: '1.5px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.15)',
              color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Cards area */}
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
              items.map(item => {
                const isSelected = selectedIds.has(item.id)
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <Checkbox checked={isSelected} onChange={() => handleToggle(item.id)} />
                    <div style={{ flex: 1, position: 'relative' }}>
                      <PlanCard
                        item={item}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onClick={onCardClick}
                        isDragging={draggingId === item.id}
                      />
                      {/* 수정 버튼 */}
                      <button
                        onClick={e => { e.stopPropagation(); onEditItem(item) }}
                        title="수정"
                        style={{
                          position: 'absolute', top: 5, right: 5,
                          padding: 4, border: 'none', background: 'rgba(255,255,255,0.9)',
                          borderRadius: 5, cursor: 'pointer', display: 'flex',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        }}
                      >
                        <Pencil size={10} color="#6b7280" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ) : (
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
