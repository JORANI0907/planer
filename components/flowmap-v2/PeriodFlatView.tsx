'use client'

import { useState } from 'react'
import { Plus, Trash2, Check, History, GripVertical } from 'lucide-react'
import type { PlanItem, PlanLevel } from '@/lib/types'
import { STATUS_CONFIG } from '@/lib/types'
import { createPlanItem, updatePlanItem, deletePlanItem } from '@/lib/api'
import { formatPeriodLabel } from '@/lib/flowmap-v2-utils'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface PeriodFlatViewProps {
  level: PlanLevel
  activeKeys: string[]
  pastKeys: string[]
  itemsByPeriod: Map<string, PlanItem[]>
  allItems: PlanItem[]          // 상위 연간 아이템 포함 전체 (배지 표시용)
  onChanged: () => void         // 추가/삭제/상태 변경 시 호출
}

const STATUS_DOT: Record<string, string> = {
  completed: '#22c55e',
  in_progress: '#3b82f6',
  on_hold: '#f97316',
  pending: '#9ca3af',
}

const STATUS_BG: Record<string, { bg: string; border: string }> = {
  completed: { bg: 'rgba(34,197,94,0.07)', border: '#86efac' },
  in_progress: { bg: 'rgba(59,130,246,0.07)', border: '#93c5fd' },
  on_hold: { bg: 'rgba(249,115,22,0.07)', border: '#fdba74' },
  pending: { bg: '#fff', border: '#e5e7eb' },
}

/** parent_plan_item_id 체인을 추적해서 연간 아이템 이름 반환 */
function findAnnualAncestorTitle(
  item: PlanItem,
  allItems: PlanItem[]
): string | null {
  const itemMap = new Map(allItems.map(i => [i.id, i]))
  let current: PlanItem | undefined = item

  while (current) {
    if (current.level === 'annual') return current.title
    if (!current.parent_plan_item_id) return null
    current = itemMap.get(current.parent_plan_item_id)
  }
  return null
}

// ─── 개별 카드 ──────────────────────────────────────────────

function PeriodCard({
  item,
  allItems,
  onChanged,
}: {
  item: PlanItem
  allItems: PlanItem[]
  onChanged: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const sc = STATUS_BG[item.status] ?? STATUS_BG.pending
  const dot = STATUS_DOT[item.status] ?? STATUS_DOT.pending
  const statusLabel = STATUS_CONFIG[item.status]?.label ?? item.status
  const ancestorTitle = findAnnualAncestorTitle(item, allItems)
  const isDone = item.status === 'completed'

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })
  const wrapStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 50 : undefined,
  }

  const handleToggleDone = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await updatePlanItem(item.id, {
        status: isDone ? 'pending' : 'completed',
      })
      onChanged()
    } catch {
      // 조용히 실패
    }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`"${item.title}" 항목을 삭제하시겠습니까?`)) return
    try {
      await deletePlanItem(item.id)
      onChanged()
    } catch {
      // 조용히 실패
    }
  }

  return (
    <div ref={setNodeRef} style={wrapStyle}>
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: `1.5px solid ${sc.border}`,
        borderRadius: 10,
        backgroundColor: sc.bg,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        position: 'relative',
      }}
    >
      {/* 드래그 핸들 (좌측 상단) */}
      <button
        {...attributes}
        {...listeners}
        title="드래그하여 순서 변경"
        style={{
          position: 'absolute',
          top: 4,
          left: 4,
          opacity: hovered ? 0.7 : 0,
          background: 'transparent',
          border: 'none',
          cursor: 'grab',
          color: '#6b7280',
          padding: 0,
          touchAction: 'none',
          transition: 'opacity 0.15s',
        }}
      >
        <GripVertical size={12} />
      </button>

      {/* 연간 목표 배지 */}
      {ancestorTitle && (
        <span
          style={{
            display: 'inline-block',
            fontSize: 10,
            fontWeight: 600,
            color: '#1d4ed8',
            backgroundColor: '#dbeafe',
            borderRadius: 12,
            padding: '1px 7px',
            alignSelf: 'flex-start',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={ancestorTitle}
        >
          {ancestorTitle}
        </span>
      )}

      {/* 제목 + 액션 인라인 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        {/* 완료 체크박스 */}
        <button
          onClick={handleToggleDone}
          title={isDone ? '미완료로 변경' : '완료 처리'}
          style={{
            flexShrink: 0,
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: `1.5px solid ${isDone ? '#22c55e' : '#d1d5db'}`,
            backgroundColor: isDone ? '#22c55e' : '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 2,
            padding: 0,
          }}
        >
          {isDone && <Check size={10} color="#fff" strokeWidth={3} />}
        </button>

        <div
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 600,
            color: isDone ? '#9ca3af' : '#111827',
            textDecoration: isDone ? 'line-through' : 'none',
            lineHeight: 1.4,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {item.title}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
            paddingTop: 2,
          }}
        >
          <span style={{ fontSize: 10, color: dot, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {statusLabel}
          </span>
          {hovered && (
            <button
              onClick={handleDelete}
              title="삭제"
              style={{
                display: 'flex',
                alignItems: 'center',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 2,
                borderRadius: 4,
                color: '#f87171',
              }}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 설명 */}
      {item.description && (
        <div
          style={{
            fontSize: 11,
            color: '#6b7280',
            lineHeight: 1.45,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {item.description}
        </div>
      )}
    </div>
    </div>
  )
}

// ─── 추가 입력 폼 ───────────────────────────────────────────

function AddItemInline({
  level,
  periodKey,
  sortOrder,
  onAdded,
}: {
  level: PlanLevel
  periodKey: string
  sortOrder: number
  onAdded: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')

  const handleAdd = async () => {
    const t = title.trim()
    if (!t) return
    try {
      await createPlanItem({
        level,
        period_key: periodKey,
        title: t,
        description: null,
        categories: [],
        status: 'pending',
        priority: 'medium',
        sort_order: sortOrder,
        parent_plan_item_id: null,
        section_id: null,
      })
      setTitle('')
      setAdding(false)
      onAdded()
    } catch {
      // 조용히 실패
    }
  }

  if (adding) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleAdd()
            if (e.key === 'Escape') { setAdding(false); setTitle('') }
          }}
          placeholder="제목 입력 후 Enter"
          style={{
            fontSize: 12,
            padding: '6px 8px',
            border: '1px solid #93c5fd',
            borderRadius: 6,
            outline: 'none',
            color: '#111827',
            backgroundColor: '#fff',
          }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleAdd}
            style={{
              flex: 1,
              fontSize: 11,
              padding: '4px 6px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: '#3b82f6',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            추가
          </button>
          <button
            onClick={() => { setAdding(false); setTitle('') }}
            style={{
              flex: 1,
              fontSize: 11,
              padding: '4px 6px',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
              backgroundColor: '#fff',
              cursor: 'pointer',
              color: '#6b7280',
            }}
          >
            취소
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setAdding(true)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        fontSize: 11,
        color: '#9ca3af',
        padding: '6px 8px',
        borderRadius: 8,
        border: '1.5px dashed #e5e7eb',
        background: 'transparent',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#93c5fd'
        e.currentTarget.style.color = '#3b82f6'
        e.currentTarget.style.backgroundColor = '#f0f9ff'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#e5e7eb'
        e.currentTarget.style.color = '#9ca3af'
        e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      <Plus size={11} />
      항목 추가
    </button>
  )
}

// ─── 컬럼 ───────────────────────────────────────────────────

function PeriodColumn({
  level,
  periodKey,
  items,
  allItems,
  onChanged,
  isPast,
}: {
  level: PlanLevel
  periodKey: string
  items: PlanItem[]
  allItems: PlanItem[]
  onChanged: () => void
  isPast?: boolean
}) {
  const label = formatPeriodLabel(periodKey)
  const { setNodeRef, isOver } = useDroppable({ id: `col-${periodKey}` })

  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 200,
        flex: '0 0 220px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        opacity: isPast ? 0.85 : 1,
        borderRadius: 10,
        outline: isOver ? '2px dashed #3b82f6' : 'none',
        outlineOffset: 4,
        transition: 'outline 0.1s',
      }}
    >
      {/* 컬럼 헤더 */}
      <div
        style={{
          padding: '7px 12px',
          backgroundColor: isOver ? '#dbeafe' : isPast ? '#f1f5f9' : '#f8fafc',
          borderRadius: 8,
          border: `1px solid ${isPast ? '#cbd5e1' : '#e5e7eb'}`,
          fontWeight: 700,
          fontSize: 13,
          color: '#374151',
          textAlign: 'center',
          transition: 'background-color 0.1s',
        }}
      >
        {label}
        <span
          style={{
            marginLeft: 6,
            fontSize: 10,
            color: '#9ca3af',
            fontWeight: 400,
          }}
        >
          {items.length}건
        </span>
      </div>

      {/* 카드 목록 (SortableContext만; DndContext는 상위 PeriodFlatView 단일) */}
      <SortableContext
        items={items.map(i => i.id)}
        strategy={verticalListSortingStrategy}
      >
        {items.map(item => (
          <PeriodCard key={item.id} item={item} allItems={allItems} onChanged={onChanged} />
        ))}
      </SortableContext>

      {/* 추가 입력 */}
      <AddItemInline
        level={level}
        periodKey={periodKey}
        sortOrder={items.length}
        onAdded={onChanged}
      />
    </div>
  )
}

// ─── 메인 ───────────────────────────────────────────────────

export function PeriodFlatView({
  level,
  activeKeys,
  pastKeys,
  itemsByPeriod,
  allItems,
  onChanged,
}: PeriodFlatViewProps) {
  const [showPast, setShowPast] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    // active 카드의 현재 컬럼 찾기
    let activePeriodKey: string | null = null
    for (const [pk, list] of itemsByPeriod.entries()) {
      if (list.some(i => i.id === activeId)) {
        activePeriodKey = pk
        break
      }
    }
    if (!activePeriodKey) return

    // over가 어느 컬럼인지 + 어느 인덱스인지 파악
    let targetPeriodKey: string
    let targetIdx: number
    if (overId.startsWith('col-')) {
      targetPeriodKey = overId.slice(4)
      targetIdx = (itemsByPeriod.get(targetPeriodKey) ?? []).length
    } else {
      let foundKey: string | null = null
      let foundIdx = -1
      for (const [pk, list] of itemsByPeriod.entries()) {
        const idx = list.findIndex(i => i.id === overId)
        if (idx >= 0) {
          foundKey = pk
          foundIdx = idx
          break
        }
      }
      if (!foundKey || foundIdx < 0) return
      targetPeriodKey = foundKey
      targetIdx = foundIdx
    }

    try {
      if (activePeriodKey === targetPeriodKey) {
        // 같은 컬럼 내 순서 변경
        const list = itemsByPeriod.get(activePeriodKey) ?? []
        const oldIdx = list.findIndex(i => i.id === activeId)
        if (oldIdx < 0) return
        const reordered = arrayMove(list, oldIdx, targetIdx)
        await Promise.all(
          reordered.map((it, idx) => updatePlanItem(it.id, { sort_order: idx })),
        )
      } else {
        // 다른 컬럼으로 이동 — 대상 컬럼 전체 sort_order 재부여 + active의 period_key 변경
        const oldList = itemsByPeriod.get(activePeriodKey) ?? []
        const movedItem = oldList.find(i => i.id === activeId)
        if (!movedItem) return
        const targetList = itemsByPeriod.get(targetPeriodKey) ?? []
        const safeIdx = Math.max(0, Math.min(targetIdx, targetList.length))
        const newList = [
          ...targetList.slice(0, safeIdx),
          movedItem,
          ...targetList.slice(safeIdx),
        ]
        await Promise.all(
          newList.map((it, idx) =>
            it.id === activeId
              ? updatePlanItem(it.id, { period_key: targetPeriodKey, sort_order: idx })
              : updatePlanItem(it.id, { sort_order: idx }),
          ),
        )
      }
      onChanged()
    } catch {
      // 조용히 실패
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
    <div
      style={{
        display: 'flex',
        gap: 12,
        overflowX: 'auto',
        paddingBottom: 16,
        alignItems: 'flex-start',
      }}
    >
      {/* 지난 기간 펼치기 토글 */}
      {pastKeys.length > 0 && (
        <button
          onClick={() => setShowPast(s => !s)}
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: 56,
            alignSelf: 'stretch',
            minHeight: 80,
            border: '1.5px dashed #cbd5e1',
            backgroundColor: showPast ? '#e0e7ff' : '#f8fafc',
            color: showPast ? '#4338ca' : '#6b7280',
            borderRadius: 10,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            padding: '8px 4px',
            transition: 'all 0.15s',
          }}
          title={showPast ? '지난 기간 숨기기' : `지난 ${pastKeys.length}개 펼치기`}
        >
          <History size={14} />
          <span
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              lineHeight: 1.2,
              textAlign: 'center',
            }}
          >
            {showPast ? (
              <>
                <span>지난기간</span>
                <span>접기</span>
              </>
            ) : (
              <>
                <span>지난</span>
                <span>{pastKeys.length}개</span>
              </>
            )}
          </span>
        </button>
      )}

      {/* 지난 기간 컬럼 (펼친 경우에만) */}
      {showPast && pastKeys.map(key => (
        <PeriodColumn
          key={key}
          level={level}
          periodKey={key}
          items={itemsByPeriod.get(key) ?? []}
          allItems={allItems}
          onChanged={onChanged}
          isPast
        />
      ))}

      {/* 활성 컬럼 */}
      {activeKeys.map(key => (
        <PeriodColumn
          key={key}
          level={level}
          periodKey={key}
          items={itemsByPeriod.get(key) ?? []}
          allItems={allItems}
          onChanged={onChanged}
        />
      ))}
    </div>
    </DndContext>
  )
}
