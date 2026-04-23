'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getPlanItems, createPlanItem, updatePlanItem, deletePlanItem,
  getTasksForItem, createTask, updateTask, deleteTask,
} from '@/lib/api'
import { useUndo } from '@/lib/undo-stack'
import type { PlanItem, PlanItemTask } from '@/lib/types'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
const MONTH_NAMES = ['', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

function formatDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// ─── SortableRow 헬퍼 ────────────────────────────────────────
function SortableRow({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: isDragging ? 'relative' as const : undefined,
    zIndex: isDragging ? 50 : undefined,
  }
  const handle = (
    <button
      {...attributes}
      {...listeners}
      className="touch-none cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0 select-none px-0.5"
      title="드래그하여 순서 변경"
    >⠿</button>
  )
  return <div ref={setNodeRef} style={style}>{children(handle)}</div>
}

// ─── 세부 내용 패널 ───────────────────────────────────────────
function SubTaskPanel({ itemId }: { itemId: string }) {
  const [tasks, setTasks] = useState<PlanItemTask[]>([])
  const [loaded, setLoaded] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loaded) {
      getTasksForItem(itemId).then(t => { setTasks(t); setLoaded(true) })
    }
  }, [loaded, itemId])

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const taskSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const handleAdd = async () => {
    const t = newTitle.trim()
    if (!t) return
    const task = await createTask(itemId, t, tasks.length)
    setTasks(prev => [...prev, task])
    setNewTitle('')
  }

  const handleToggle = async (task: PlanItemTask) => {
    const updated = await updateTask(task.id, { is_completed: !task.is_completed })
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
  }

  const handleDelete = async (id: string) => {
    await deleteTask(id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const handleTaskRename = async (id: string, title: string) => {
    const updated = await updateTask(id, { title })
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
    setEditingId(null)
  }

  const handleTaskDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = tasks.findIndex(t => t.id === active.id)
    const newIdx = tasks.findIndex(t => t.id === over.id)
    const reordered = arrayMove(tasks, oldIdx, newIdx)
    setTasks(reordered)
    await Promise.all(reordered.map((task, idx) => updateTask(task.id, { sort_order: idx })))
  }

  if (!loaded) return <div className="px-4 py-3 text-xs text-gray-400">불러오는 중...</div>

  return (
    <div className="mx-3 mb-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
      <p className="text-xs font-semibold text-gray-500 mb-2">세부 내용</p>

      {tasks.length === 0 && (
        <p className="text-xs text-gray-400 mb-2">세부 내용을 추가하세요</p>
      )}

      <div className="space-y-1.5 mb-2">
        <DndContext sensors={taskSensors} collisionDetection={closestCenter} onDragEnd={handleTaskDragEnd}>
          <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map(task => (
              <SortableRow key={task.id} id={task.id}>
                {(handle) => (
                  <div className="group flex items-center gap-2">
                    {handle}
                    <button
                      onClick={() => handleToggle(task)}
                      className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                        task.is_completed ? 'bg-gray-500 border-gray-500' : 'border-gray-300 hover:border-gray-600'
                      }`}
                    >
                      {task.is_completed && (
                        <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      )}
                    </button>
                    {editingId === task.id ? (
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onBlur={() => {
                          const t = editTitle.trim()
                          if (t && t !== task.title) handleTaskRename(task.id, t)
                          else setEditingId(null)
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const t = editTitle.trim()
                            if (t && t !== task.title) handleTaskRename(task.id, t)
                            else setEditingId(null)
                          }
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="flex-1 text-xs border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none bg-white"
                      />
                    ) : (
                      <span className={`flex-1 text-xs ${task.is_completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {task.title}
                      </span>
                    )}
                    {!task.is_completed && editingId !== task.id && (
                      <button
                        onClick={() => { setEditingId(task.id); setEditTitle(task.title) }}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-400 text-xs"
                      >✎</button>
                    )}
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs"
                    >✕</button>
                  </div>
                )}
              </SortableRow>
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder="세부 내용 입력 후 Enter..."
          className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
        />
        <button
          onClick={handleAdd}
          disabled={!newTitle.trim()}
          className="text-xs bg-gray-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
        >
          추가
        </button>
      </div>
    </div>
  )
}

// ─── 할 일 카드 ───────────────────────────────────────────────
function DailyItemCard({ item, onToggle, onDelete, onRename, onCopy, dragHandle }: {
  item: PlanItem
  onToggle: () => void
  onDelete: () => void
  onRename: (title: string) => void
  onCopy: () => void
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
      isDone ? 'border-gray-100 bg-gray-50' : expanded ? 'border-blue-200 bg-white shadow-sm' : isRoutine ? 'border-orange-200 bg-white hover:border-orange-300' : 'border-gray-200 bg-white hover:border-gray-300'
    }`}>
      {/* 메인 행 */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {dragHandle}
        {/* 체크박스 */}
        <button
          onClick={onToggle}
          className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
            isDone ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
          }`}
        >
          {isDone && (
            <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {/* 제목 */}
        {editing ? (
          <input
            ref={inputRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(item.title); setEditing(false) } }}
            className="flex-1 text-sm border border-blue-300 rounded-lg px-2 py-1 focus:outline-none"
          />
        ) : (
          <span
            onDoubleClick={() => !isDone && setEditing(true)}
            className={`flex-1 text-sm font-medium cursor-default flex items-center gap-1.5 ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}
          >
            {isRoutine && !isDone && (
              <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 flex-shrink-0">
                필수
              </span>
            )}
            {item.title}
          </span>
        )}

        {/* 세부내용 토글 */}
        {!isDone && (
          <button
            onClick={() => setExpanded(e => !e)}
            className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-lg transition-all ${
              expanded ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {expanded ? '접기' : '세부내용'}
          </button>
        )}

        {/* 복사 */}
        <button
          onClick={onCopy}
          title="복사 (다른 날짜로 이동/복사)"
          className="flex-shrink-0 text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-700 transition-all"
        >📋</button>

        {/* 삭제 */}
        <button
          onClick={onDelete}
          className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors text-sm"
        >✕</button>
      </div>

      {/* 세부내용 패널 */}
      {expanded && !isDone && <SubTaskPanel itemId={item.id} />}
    </div>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────
type Clipboard = { item: PlanItem; tasks: PlanItemTask[]; fromPeriodKey: string }

export default function DailyPage() {
  const today = new Date()
  const [selectedDate, setSelectedDate] = useState(today)
  const [items, setItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [clipboard, setClipboard] = useState<Clipboard | null>(null)
  const [pasting, setPasting] = useState(false)
  const [pasteDate, setPasteDate] = useState('')
  const { push: pushUndo } = useUndo()

  const periodKey = formatDayKey(selectedDate)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getPlanItems('daily', periodKey)
    setItems(data)
    setLoading(false)
  }, [periodKey])

  useEffect(() => { load() }, [load])

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

  const handleCopy = async (item: PlanItem) => {
    let tasks: PlanItemTask[] = []
    try {
      tasks = await getTasksForItem(item.id)
    } catch { /* ignore — copy without subtasks */ }
    setClipboard({ item, tasks, fromPeriodKey: item.period_key })
    // 기본 대상 날짜: 다음날 (이동 사용 빈도 높음)
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + 1)
    setPasteDate(formatDayKey(next))
  }

  const handlePaste = async (mode: 'copy' | 'move') => {
    if (!clipboard || pasting || !pasteDate) return
    if (mode === 'move' && pasteDate === clipboard.fromPeriodKey) return
    setPasting(true)
    try {
      const { item: src, tasks } = clipboard
      const target = pasteDate
      const targetItems = target === periodKey ? items : await getPlanItems('daily', target)
      const newItem = await createPlanItem({
        title: src.title,
        description: src.description,
        categories: src.categories,
        status: mode === 'move' ? src.status : 'pending',
        priority: src.priority,
        level: 'daily',
        period_key: target,
        sort_order: targetItems.length,
      })
      if (tasks.length > 0) {
        await Promise.all(tasks.map((t, idx) => createTask(newItem.id, t.title, idx)))
      }
      if (mode === 'move') {
        await deletePlanItem(src.id)
        pushUndo({
          label: `"${src.title}" 이동 되돌리기 (${target} → ${src.period_key})`,
          restore: async () => {
            // 이동 되돌리기: 새로 만들어진 복제본 삭제 + 원본 재생성
            try { await deletePlanItem(newItem.id) } catch { /* 이미 지워졌을 수 있음 */ }
            const restored = await createPlanItem({
              title: src.title,
              description: src.description,
              categories: src.categories,
              status: src.status,
              priority: src.priority,
              level: 'daily',
              period_key: src.period_key,
              sort_order: src.sort_order,
            })
            await Promise.all(tasks.map((t, idx) => createTask(restored.id, t.title, idx)))
            if (src.period_key === periodKey || target === periodKey) await load()
          },
        })
      }
      setClipboard(null)
      setPasteDate('')
      if (target === periodKey || (mode === 'move' && src.period_key === periodKey)) {
        await load()
      }
    } catch (err) {
      console.error('[daily paste]', err)
      alert('복사/이동 중 오류가 발생했습니다.')
    } finally {
      setPasting(false)
    }
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

  return (
    <div className="max-w-2xl mx-auto">
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
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5">
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

      {/* 할 일 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : (
        <div className="space-y-2 mb-4">
          {items.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
              <p className="text-3xl mb-2">✅</p>
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
                        onCopy={() => handleCopy(item)}
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

      {/* 복사/이동 클립보드 배너 */}
      {clipboard && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-40 w-[calc(100%-2rem)] max-w-md">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📋</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">원본: {clipboard.fromPeriodKey}</p>
                <p className="text-xs font-medium truncate">{clipboard.item.title}</p>
              </div>
              <button
                onClick={() => { setClipboard(null); setPasteDate('') }}
                disabled={pasting}
                className="text-gray-400 hover:text-white text-sm px-1.5"
                title="취소"
              >✕</button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-gray-400 whitespace-nowrap">대상 날짜</label>
              <input
                type="date"
                value={pasteDate}
                onChange={e => setPasteDate(e.target.value)}
                disabled={pasting}
                className="flex-1 text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-blue-400 min-w-0"
                style={{ colorScheme: 'dark' }}
              />
              <button
                onClick={() => handlePaste('copy')}
                disabled={pasting || !pasteDate}
                title="선택 날짜에 복사"
                className="text-[11px] font-semibold bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors"
              >
                복사
              </button>
              <button
                onClick={() => handlePaste('move')}
                disabled={pasting || !pasteDate || pasteDate === clipboard.fromPeriodKey}
                title={pasteDate === clipboard.fromPeriodKey ? '원본과 같은 날짜로는 이동할 수 없습니다' : '선택 날짜로 이동 (원본 삭제)'}
                className="text-[11px] font-semibold bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors"
              >
                이동
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
