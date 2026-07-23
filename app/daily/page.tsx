'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CheckSquare, Square, Copy, MoveRight, ListTodo, X } from 'lucide-react'
import {
  getPlanItems, createPlanItem, updatePlanItem, deletePlanItem,
  getTasksForItem, createTask,
  getTodoItems, moveItemToTodo,
} from '@/lib/api'
import { useUndo } from '@/lib/undo-stack'
import type { PlanItem, PlanItemTask } from '@/lib/types'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { SubTaskPanel, SortableRow } from '@/components/SubTaskPanel'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
const MONTH_NAMES = ['', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

function formatDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// ─── 할 일 카드 ───────────────────────────────────────────────
function DailyItemCard({ item, onToggle, onDelete, onRename, selected, onSelectToggle, dragHandle }: {
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
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const saveTitle = () => {
    const t = title.trim()
    if (t && t !== item.title) onRename(t)
    setEditing(false)
  }

  const isDone = item.status === 'completed'
  const isRoutine = !!item.routine_task_id

  return (
    <div className={`rounded-2xl border transition-all overflow-hidden ${
      isDone
        ? 'border-gray-100 bg-gray-50'
        : selected
          ? 'border-blue-400 bg-blue-50/40 shadow-sm'
          : expanded
            ? 'border-blue-200 bg-white shadow-sm'
            : isRoutine
              ? 'border-orange-200 bg-white hover:border-orange-300'
              : 'border-gray-200 bg-white hover:border-gray-300'
    }`}>
      {/* items-start 로 두어야 제목 wrap 시 위 정렬 유지 */}
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
              ref={inputRef}
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
            <div
              onDoubleClick={() => !isDone && setEditing(true)}
              className={`text-sm font-medium cursor-default flex items-start gap-1.5 leading-snug ${
                isDone ? 'line-through text-gray-400' : 'text-gray-800'
              }`}
            >
              {isRoutine && !isDone && (
                <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 flex-shrink-0 mt-0.5">
                  필수
                </span>
              )}
              <span className="break-words min-w-0">{item.title}</span>
            </div>
          )}
        </div>

        {/* 세부내용 토글 */}
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

      {expanded && !isDone && <SubTaskPanel itemId={item.id} />}
    </div>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────

export default function DailyPage() {
  const today = new Date()
  const [selectedDate, setSelectedDate] = useState(today)
  const [items, setItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // 벌크 액션: copy/move 는 대상 날짜 입력 후 확정, todo 는 즉시 실행
  const [bulkAction, setBulkAction] = useState<'copy' | 'move' | null>(null)
  const [bulkTargetDate, setBulkTargetDate] = useState('')
  const [bulkRunning, setBulkRunning] = useState(false)
  const { push: pushUndo } = useUndo()

  const periodKey = formatDayKey(selectedDate)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getPlanItems('daily', periodKey)
    setItems(data)
    setLoading(false)
  }, [periodKey])

  useEffect(() => { load() }, [load])

  // 날짜 이동 시 선택 초기화 (혼선 방지)
  useEffect(() => {
    setSelectedIds(new Set())
    setBulkAction(null)
    setBulkTargetDate('')
  }, [periodKey])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const handleAdd = async () => {
    const t = newTitle.trim()
    if (!t) return
    const item = await createPlanItem({
      title: t, level: 'daily', period_key: periodKey,
      description: null, categories: [], status: 'pending', priority: 'medium',
      sort_order: items.length,
    })
    setItems(prev => [...prev, item])
    setNewTitle('')
  }

  const handleToggle = async (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    const updated = await updatePlanItem(id, { status: item.status === 'completed' ? 'pending' : 'completed' })
    setItems(prev => prev.map(i => i.id === id ? updated : i))
  }

  const handleDelete = async (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    let tasks: PlanItemTask[] = []
    try { tasks = await getTasksForItem(id) } catch { /* ignore */ }
    await deletePlanItem(id)
    setItems(prev => prev.filter(i => i.id !== id))
    setSelectedIds(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev); next.delete(id); return next
    })
    pushUndo({
      label: `"${item.title}" 삭제됨`,
      restore: async () => {
        const restored = await createPlanItem({
          title: item.title,
          description: item.description,
          categories: item.categories,
          status: item.status,
          priority: item.priority,
          level: 'daily',
          period_key: item.period_key,
          sort_order: item.sort_order,
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

  // ── 벌크 선택 ──────────────────────────────────
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
    setBulkTargetDate('')
  }

  const openBulkPaste = (action: 'copy' | 'move') => {
    if (selectedIds.size === 0) return
    setBulkAction(action)
    // 기본 대상 날짜: 다음날
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + 1)
    setBulkTargetDate(formatDayKey(next))
  }

  // ── 벌크 복사/이동 실행 ────────────────────────
  const runBulkPaste = async () => {
    if (!bulkAction || selectedIds.size === 0 || bulkRunning || !bulkTargetDate) return
    if (bulkAction === 'move' && bulkTargetDate === periodKey) return
    setBulkRunning(true)
    try {
      const targets = items.filter(i => selectedIds.has(i.id))
      let targetOrderStart = 0
      if (bulkTargetDate === periodKey) {
        targetOrderStart = items.length
      } else {
        try {
          const targetItems = await getPlanItems('daily', bulkTargetDate)
          targetOrderStart = targetItems.length
        } catch { targetOrderStart = 0 }
      }

      for (let i = 0; i < targets.length; i++) {
        const src = targets[i]
        let tasks: PlanItemTask[] = []
        try { tasks = await getTasksForItem(src.id) } catch { /* ignore */ }
        const newItem = await createPlanItem({
          title: src.title,
          description: src.description,
          categories: src.categories,
          status: bulkAction === 'move' ? src.status : 'pending',
          priority: src.priority,
          level: 'daily',
          period_key: bulkTargetDate,
          sort_order: targetOrderStart + i,
        })
        if (tasks.length > 0) {
          await Promise.all(tasks.map((t, idx) => createTask(newItem.id, t.title, idx)))
        }
        if (bulkAction === 'move') {
          await deletePlanItem(src.id)
        }
      }

      clearSelection()
      if (bulkTargetDate === periodKey || bulkAction === 'move') {
        await load()
      }
    } catch (err) {
      console.error('[daily bulk paste]', err)
      alert('복사/이동 중 오류가 발생했습니다.')
    } finally { setBulkRunning(false) }
  }

  // ── 벌크 TODO 이동 ────────────────────────────
  const runBulkToTodo = async () => {
    if (selectedIds.size === 0 || bulkRunning) return
    setBulkRunning(true)
    try {
      const targets = items.filter(i => selectedIds.has(i.id))
      const todoItems = await getTodoItems()
      let start = todoItems.length
      const snapshots = targets.map(t => ({
        id: t.id, level: t.level, period_key: t.period_key, sort_order: t.sort_order,
      }))
      for (const src of targets) {
        await moveItemToTodo(src.id, start++)
      }
      setItems(prev => prev.filter(i => !selectedIds.has(i.id)))
      clearSelection()
      pushUndo({
        label: `${targets.length}개 항목이 TODO로 이동됨`,
        restore: async () => {
          for (const snap of snapshots) {
            await updatePlanItem(snap.id, {
              level: snap.level, period_key: snap.period_key, sort_order: snap.sort_order,
            })
          }
          await load()
        },
      })
    } catch (err) {
      console.error('[daily bulk todo]', err)
      alert('TODO 이동 중 오류가 발생했습니다.')
    } finally { setBulkRunning(false) }
  }

  const handleReorderItems = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex(i => i.id === active.id)
    const newIdx = items.findIndex(i => i.id === over.id)
    const reordered = arrayMove(items, oldIdx, newIdx)
    setItems(reordered)
    await Promise.all(reordered.map((item, idx) => updatePlanItem(item.id, { sort_order: idx })))
  }

  const prevDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d) }
  const nextDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d) }

  const isToday = formatDayKey(selectedDate) === formatDayKey(today)
  const completedCount = items.filter(i => i.status === 'completed').length
  const progressPct = items.length ? Math.round((completedCount / items.length) * 100) : 0
  const allSelected = items.length > 0 && selectedIds.size === items.length

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* 날짜 헤더 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-5 mb-4 md:mb-5 shadow-sm">
        <div className="flex items-center justify-between">
          <button onClick={prevDay} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 text-lg">◀</button>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <p className="text-xl md:text-2xl font-bold text-gray-900">
                {selectedDate.getDate()}
              </p>
              <div>
                <p className="text-sm font-semibold text-gray-600">
                  {DAY_NAMES[selectedDate.getDay()]}요일
                </p>
                <p className="text-xs text-gray-400">
                  {selectedDate.getFullYear()}년 {MONTH_NAMES[selectedDate.getMonth() + 1]}
                </p>
              </div>
            </div>
            {isToday && (
              <span className="inline-block mt-2 text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                오늘
              </span>
            )}
          </div>
          <button onClick={nextDay} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 text-lg">▶</button>
        </div>

        {!isToday && (
          <div className="text-center mt-3 pt-3 border-t border-gray-100">
            <button onClick={() => setSelectedDate(new Date(today))} className="text-xs text-blue-500 hover:underline">
              오늘로 돌아가기
            </button>
          </div>
        )}
      </div>

      {/* 진행률 */}
      {items.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
          <div className="flex justify-between text-sm mb-2.5">
            <span className="text-gray-600 font-medium">오늘 진행률</span>
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

      {/* 벌크 액션 툴바 — 항목 있을 때만 노출 */}
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
                title="선택한 항목을 다른 날짜에 복사"
              >
                <Copy size={12} /> 복사
              </button>
              <button
                onClick={() => openBulkPaste('move')}
                disabled={selectedIds.size === 0 || bulkRunning}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                title="선택한 항목을 다른 날짜로 이동"
              >
                <MoveRight size={12} /> 이동
              </button>
              <button
                onClick={runBulkToTodo}
                disabled={selectedIds.size === 0 || bulkRunning}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                title="선택한 항목을 TODO로 이동"
              >
                <ListTodo size={12} /> TODO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 할 일 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : (
        <div className="space-y-2 mb-4">
          {items.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
              <div className="flex justify-center mb-2"><CheckSquare size={20} /></div>
              <p className="text-gray-500 font-medium">오늘의 할 일을 추가하세요</p>
              <p className="text-xs text-gray-400 mt-1">연간 계획에서 주간 계획으로 추가하면 자동 연동됩니다</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleReorderItems}>
              <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                {items.map(item => (
                  <SortableRow key={item.id} id={item.id}>
                    {(handle) => (
                      <DailyItemCard
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
            placeholder="할 일 입력 후 Enter 또는 추가 버튼..."
            className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <button
            onClick={handleAdd}
            disabled={!newTitle.trim()}
            className="bg-green-500 hover:bg-green-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium disabled:opacity-40 transition-colors"
          >
            추가
          </button>
        </div>
      </div>

      {/* 벌크 복사/이동 — 대상 날짜 입력 배너 */}
      {bulkAction && selectedIds.size > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-40 w-[calc(100%-2rem)] max-w-md">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-3">
            <div className="flex items-center gap-2 mb-2">
              {bulkAction === 'copy' ? <Copy size={14} /> : <MoveRight size={14} />}
              <p className="text-xs font-medium flex-1">
                {selectedIds.size}개 항목 {bulkAction === 'copy' ? '복사' : '이동'}
              </p>
              <button
                onClick={() => { setBulkAction(null); setBulkTargetDate('') }}
                disabled={bulkRunning}
                className="text-gray-400 hover:text-white px-1.5"
                title="취소"
              ><X size={14} /></button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-gray-400 whitespace-nowrap">대상 날짜</label>
              <input
                type="date"
                value={bulkTargetDate}
                onChange={e => setBulkTargetDate(e.target.value)}
                disabled={bulkRunning}
                className="flex-1 text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-blue-400 min-w-0"
                style={{ colorScheme: 'dark' }}
              />
              <button
                onClick={runBulkPaste}
                disabled={bulkRunning || !bulkTargetDate || (bulkAction === 'move' && bulkTargetDate === periodKey)}
                title={bulkAction === 'move' && bulkTargetDate === periodKey ? '현재 날짜로는 이동할 수 없습니다' : ''}
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
