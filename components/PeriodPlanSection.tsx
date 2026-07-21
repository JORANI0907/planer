'use client'

import { useState, useEffect, useCallback } from 'react'
import { ClipboardList, CheckSquare, Square, Copy, MoveRight, ListTodo, X } from 'lucide-react'
import {
  getPlanItems, createPlanItem, updatePlanItem, deletePlanItem,
  getTasksForItem, createTask,
  getTodoItems, moveItemToTodo,
} from '@/lib/api'
import { useUndo } from '@/lib/undo-stack'
import type { PlanItem, PlanItemTask, PlanLevel } from '@/lib/types'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { SubTaskPanel, SortableRow } from '@/components/SubTaskPanel'

export type Period = 'annual' | 'quarterly' | 'monthly'

// ── 기간 유틸 ────────────────────────────────────────────────

function movePeriod(period: Period, year: number, q: number, m: number, dir: -1 | 1) {
  if (period === 'annual') return { year: year + dir, q, m }
  if (period === 'quarterly') {
    const nq = q + dir
    if (nq < 1) return { year: year - 1, q: 4, m }
    if (nq > 4) return { year: year + 1, q: 1, m }
    return { year, q: nq, m }
  }
  const nm = m + dir
  if (nm < 1) return { year: year - 1, q, m: 12 }
  if (nm > 12) return { year: year + 1, q, m: 1 }
  return { year, q, m: nm }
}

function getPeriodKey(period: Period, year: number, q: number, m: number) {
  if (period === 'annual') return `${year}`
  if (period === 'quarterly') return `${year}-Q${q}`
  return `${year}-${String(m).padStart(2, '0')}`
}

function getLevel(period: Period): PlanLevel {
  if (period === 'annual') return 'annual'
  if (period === 'quarterly') return 'quarterly'
  return 'monthly'
}

function getPeriodLabel(period: Period, year: number, q: number, m: number) {
  if (period === 'annual') return `${year}년`
  if (period === 'quarterly') return `${year}년 ${q}분기`
  return `${year}년 ${m}월`
}

function getPastePlaceholder(period: Period) {
  if (period === 'annual') return '연도 (예: 2026)'
  if (period === 'quarterly') return '예: 2025-Q3'
  return '예: 2025-07'
}

function getNextPeriodKey(period: Period, year: number, q: number, m: number) {
  const next = movePeriod(period, year, q, m, 1)
  return getPeriodKey(period, next.year, next.q, next.m)
}

// ── 항목 카드 ────────────────────────────────────────────────

function PeriodItemCard({ item, onToggle, onDelete, onRename, selected, onSelectToggle, dragHandle }: {
  item: PlanItem
  onToggle: () => void
  onDelete: () => void
  onRename: (title: string) => void
  selected: boolean
  onSelectToggle: () => void
  dragHandle?: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)

  const saveTitle = () => {
    const t = title.trim()
    if (t && t !== item.title) onRename(t)
    setEditing(false)
  }

  const isDone = item.status === 'completed'

  return (
    <div className={`rounded-2xl border transition-all overflow-hidden ${
      isDone
        ? 'border-gray-100 bg-gray-50'
        : selected
          ? 'border-blue-400 bg-blue-50/40 shadow-sm'
          : expanded
            ? 'border-blue-200 bg-white shadow-sm'
            : 'border-gray-200 bg-white hover:border-gray-300'
    }`}>
      {/* items-start 로 두어야 제목이 wrap될 때 위쪽 정렬 유지 */}
      <div className="flex items-start gap-2.5 px-3 py-3">
        {dragHandle}

        {/* 벌크 선택 체크박스 (사각형) */}
        <button
          onClick={onSelectToggle}
          className={`flex-shrink-0 mt-0.5 transition-colors ${
            selected ? 'text-blue-600' : 'text-gray-300 hover:text-gray-500'
          }`}
          title={selected ? '선택 해제' : '선택'}
          aria-label={selected ? '선택 해제' : '선택'}
        >
          {selected ? <CheckSquare size={18} /> : <Square size={18} />}
        </button>

        {/* 완료 체크박스 (원형) */}
        <button
          onClick={onToggle}
          className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
            isDone ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
          }`}
          title={isDone ? '완료 해제' : '완료 표시'}
        >
          {isDone && (
            <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {/* 제목 — min-w-0 + break-words 로 긴 텍스트 자연스러운 줄바꿈 */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => {
                if (e.key === 'Enter') saveTitle()
                if (e.key === 'Escape') { setTitle(item.title); setEditing(false) }
              }}
              className="w-full text-sm border border-blue-300 rounded-lg px-2 py-1 focus:outline-none"
            />
          ) : (
            <span
              onDoubleClick={() => !isDone && setEditing(true)}
              className={`block text-sm font-medium cursor-default break-words leading-snug ${
                isDone ? 'line-through text-gray-400' : 'text-gray-800'
              }`}
            >
              {item.title}
            </span>
          )}
        </div>

        {/* 세부내용 토글 (완료 아닐 때만) */}
        {!isDone && (
          <button
            onClick={() => setExpanded(e => !e)}
            className={`flex-shrink-0 self-start mt-0.5 text-xs px-2 py-1 rounded-lg transition-all ${
              expanded ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {expanded ? '접기' : '세부'}
          </button>
        )}

        {/* 삭제 */}
        <button
          onClick={onDelete}
          className="flex-shrink-0 self-start mt-0.5 text-gray-300 hover:text-red-400 transition-colors text-sm w-5 h-5 flex items-center justify-center"
          title="삭제"
        >✕</button>
      </div>

      {expanded && !isDone && <SubTaskPanel itemId={item.id} autoFocus={false} />}
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────

export function PeriodPlanSection({ period, initYear, initQuarter, initMonth }: {
  period: Period
  initYear: number
  initQuarter: number
  initMonth: number
}) {
  const [curYear, setCurYear] = useState(initYear)
  const [curQ, setCurQ] = useState(initQuarter)
  const [curM, setCurM] = useState(initMonth)

  const [items, setItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // 벌크 액션 상태: copy/move 는 대상 기간 입력 후 확정, todo 는 즉시 실행 후 확인
  const [bulkAction, setBulkAction] = useState<'copy' | 'move' | null>(null)
  const [bulkTargetKey, setBulkTargetKey] = useState('')
  const [bulkRunning, setBulkRunning] = useState(false)
  const { push: pushUndo } = useUndo()

  const periodKey = getPeriodKey(period, curYear, curQ, curM)
  const level = getLevel(period)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPlanItems(level, periodKey)
      setItems(data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [level, periodKey])

  useEffect(() => { load() }, [load])

  // 기간 이동 시 선택 초기화 (혼선 방지)
  useEffect(() => {
    setSelectedIds(new Set())
    setBulkAction(null)
    setBulkTargetKey('')
  }, [periodKey])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const navigate = (dir: -1 | 1) => {
    const next = movePeriod(period, curYear, curQ, curM, dir)
    setCurYear(next.year)
    setCurQ(next.q)
    setCurM(next.m)
  }

  const handleAdd = async () => {
    const t = newTitle.trim()
    if (!t) return
    const item = await createPlanItem({
      title: t, level, period_key: periodKey,
      description: null, categories: [], status: 'pending', priority: 'medium',
      sort_order: items.length,
    })
    setItems(prev => [...prev, item])
    setNewTitle('')
  }

  const handleToggle = async (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    const updated = await updatePlanItem(id, {
      status: item.status === 'completed' ? 'pending' : 'completed',
    })
    setItems(prev => prev.map(i => i.id === id ? updated : i))
  }

  const handleDelete = async (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    let tasks: PlanItemTask[] = []
    try { tasks = await getTasksForItem(id) } catch { /* ignore */ }
    await deletePlanItem(id)
    setItems(prev => prev.filter(i => i.id !== id))
    // 선택 목록에서도 제거
    setSelectedIds(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev); next.delete(id); return next
    })
    pushUndo({
      label: `"${item.title}" 삭제됨`,
      restore: async () => {
        const restored = await createPlanItem({
          title: item.title, description: item.description, categories: item.categories,
          status: item.status, priority: item.priority, level,
          period_key: item.period_key, sort_order: item.sort_order,
        })
        await Promise.all(tasks.map((t, idx) => createTask(restored.id, t.title, idx)))
        if (item.period_key === periodKey) await load()
      },
    })
  }

  const handleRename = async (id: string, title: string) => {
    const updated = await updatePlanItem(id, { title })
    setItems(prev => prev.map(i => i.id === id ? updated : i))
  }

  // ── 벌크 선택 ─────────────────────────────────────────
  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setBulkAction(null)
    setBulkTargetKey('')
  }

  const openBulkPaste = (action: 'copy' | 'move') => {
    if (selectedIds.size === 0) return
    setBulkAction(action)
    setBulkTargetKey(getNextPeriodKey(period, curYear, curQ, curM))
  }

  // ── 벌크 복사/이동 실행 ──────────────────────────────
  const runBulkPaste = async () => {
    if (!bulkAction || selectedIds.size === 0 || bulkRunning || !bulkTargetKey.trim()) return
    if (bulkAction === 'move' && bulkTargetKey === periodKey) return
    setBulkRunning(true)
    try {
      const targets = items.filter(i => selectedIds.has(i.id))
      // 대상 기간의 기존 항목 개수(정렬 순서 시작점)
      let targetOrderStart = 0
      if (bulkTargetKey === periodKey) {
        targetOrderStart = items.length
      } else {
        try {
          const targetItems = await getPlanItems(level, bulkTargetKey)
          targetOrderStart = targetItems.length
        } catch { targetOrderStart = 0 }
      }

      for (let i = 0; i < targets.length; i++) {
        const src = targets[i]
        let tasks: PlanItemTask[] = []
        try { tasks = await getTasksForItem(src.id) } catch { /* ignore */ }
        const newItem = await createPlanItem({
          title: src.title, description: src.description, categories: src.categories,
          status: bulkAction === 'move' ? src.status : 'pending', priority: src.priority,
          level, period_key: bulkTargetKey, sort_order: targetOrderStart + i,
        })
        if (tasks.length > 0) {
          await Promise.all(tasks.map((t, idx) => createTask(newItem.id, t.title, idx)))
        }
        if (bulkAction === 'move') {
          await deletePlanItem(src.id)
        }
      }

      clearSelection()
      if (bulkTargetKey === periodKey || bulkAction === 'move') {
        await load()
      }
    } catch { /* ignore */ } finally { setBulkRunning(false) }
  }

  // ── 벌크 투두로 보내기 ───────────────────────────────
  const runBulkToTodo = async () => {
    if (selectedIds.size === 0 || bulkRunning) return
    setBulkRunning(true)
    try {
      const targets = items.filter(i => selectedIds.has(i.id))
      const todoItems = await getTodoItems()
      let start = todoItems.length
      // 원본 스냅샷 (undo용)
      const snapshots = targets.map(t => ({
        id: t.id, level: t.level, period_key: t.period_key, sort_order: t.sort_order,
      }))
      for (const src of targets) {
        await moveItemToTodo(src.id, start++)
      }
      // 목록에서 제거
      setItems(prev => prev.filter(i => !selectedIds.has(i.id)))
      clearSelection()
      pushUndo({
        label: `${targets.length}개 항목이 투두로 이동됨`,
        restore: async () => {
          for (const snap of snapshots) {
            await updatePlanItem(snap.id, {
              level: snap.level, period_key: snap.period_key, sort_order: snap.sort_order,
            })
          }
          await load()
        },
      })
    } catch { /* ignore */ } finally { setBulkRunning(false) }
  }

  const handleReorder = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex(i => i.id === active.id)
    const newIdx = items.findIndex(i => i.id === over.id)
    const reordered = arrayMove(items, oldIdx, newIdx)
    setItems(reordered)
    await Promise.all(reordered.map((item, idx) => updatePlanItem(item.id, { sort_order: idx })))
  }

  const completedCount = items.filter(i => i.status === 'completed').length
  const progressPct = items.length ? Math.round((completedCount / items.length) * 100) : 0
  const label = getPeriodLabel(period, curYear, curQ, curM)
  const allSelected = items.length > 0 && selectedIds.size === items.length

  return (
    <div className="max-w-2xl mx-auto pb-24">

      {/* 기간 헤더 (← 라벨 →) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 text-lg transition-colors"
          >◀</button>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900">{label}</p>
          </div>
          <button
            onClick={() => navigate(1)}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 text-lg transition-colors"
          >▶</button>
        </div>
      </div>

      {/* 진행률 */}
      {items.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
          <div className="flex justify-between text-sm mb-2.5">
            <span className="text-gray-600 font-medium">진행률</span>
            <span className="font-bold text-green-600">{progressPct}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">{completedCount}/{items.length} 완료</p>
        </div>
      )}

      {/* 벌크 액션 툴바 — 항상 표시하되 선택된 항목 없을 때는 안내 */}
      {items.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-3 mb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds(allSelected ? new Set() : new Set(items.map(i => i.id)))}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                {allSelected ? '전체 해제' : '전체 선택'}
              </button>
              <span className="text-xs text-gray-400">
                {selectedIds.size > 0 ? `${selectedIds.size}개 선택됨` : '항목을 선택하세요'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => openBulkPaste('copy')}
                disabled={selectedIds.size === 0 || bulkRunning}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                title="선택한 항목을 다른 기간에 복사"
              >
                <Copy size={12} /> 복사
              </button>
              <button
                onClick={() => openBulkPaste('move')}
                disabled={selectedIds.size === 0 || bulkRunning}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                title="선택한 항목을 다른 기간으로 이동"
              >
                <MoveRight size={12} /> 이동
              </button>
              <button
                onClick={runBulkToTodo}
                disabled={selectedIds.size === 0 || bulkRunning}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                title="선택한 항목을 투두 목록으로 이동"
              >
                <ListTodo size={12} /> 투두로
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 계획 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : (
        <div className="space-y-2 mb-4">
          {items.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
              <div className="flex justify-center mb-2"><ClipboardList size={14} /></div>
              <p className="text-gray-500 font-medium">{label} 계획을 추가하세요</p>
              <p className="text-xs text-gray-400 mt-1">플로우맵에서 추가한 계획도 여기서 확인됩니다</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleReorder}>
              <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                {items.map(item => (
                  <SortableRow key={item.id} id={item.id}>
                    {(handle) => (
                      <PeriodItemCard
                        item={item}
                        onToggle={() => handleToggle(item.id)}
                        onDelete={() => handleDelete(item.id)}
                        onRename={(title) => handleRename(item.id, title)}
                        selected={selectedIds.has(item.id)}
                        onSelectToggle={() => toggleSelected(item.id)}
                        dragHandle={handle}
                      />
                    )}
                  </SortableRow>
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      {/* 추가 입력 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder={`${label} 계획 입력 후 Enter...`}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleAdd}
            disabled={!newTitle.trim()}
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium disabled:opacity-40 transition-colors"
          >
            추가
          </button>
        </div>
      </div>

      {/* 벌크 복사/이동 — 대상 기간 입력 배너 */}
      {bulkAction && selectedIds.size > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-40 w-[calc(100%-2rem)] max-w-md">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-3">
            <div className="flex items-center gap-2 mb-2">
              {bulkAction === 'copy' ? <Copy size={14} /> : <MoveRight size={14} />}
              <p className="text-xs font-medium flex-1">
                {selectedIds.size}개 항목 {bulkAction === 'copy' ? '복사' : '이동'}
              </p>
              <button
                onClick={() => { setBulkAction(null); setBulkTargetKey('') }}
                disabled={bulkRunning}
                className="text-gray-400 hover:text-white px-1.5"
                title="취소"
              ><X size={14} /></button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-gray-400 whitespace-nowrap">대상 기간</label>
              <input
                type="text"
                value={bulkTargetKey}
                onChange={e => setBulkTargetKey(e.target.value)}
                disabled={bulkRunning}
                placeholder={getPastePlaceholder(period)}
                className="flex-1 text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-blue-400 min-w-0"
              />
              <button
                onClick={runBulkPaste}
                disabled={bulkRunning || !bulkTargetKey.trim() || (bulkAction === 'move' && bulkTargetKey === periodKey)}
                title={bulkAction === 'move' && bulkTargetKey === periodKey ? '현재 기간으로는 이동할 수 없습니다' : ''}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  bulkAction === 'copy'
                    ? 'bg-blue-500 hover:bg-blue-600'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {bulkRunning ? '처리 중…' : (bulkAction === 'copy' ? '복사 실행' : '이동 실행')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
