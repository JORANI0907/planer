'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Inbox, CalendarPlus } from 'lucide-react'
import {
  createPlanItem, updatePlanItem, deletePlanItem,
  getTasksForItem, createTask,
  getTodoItems, moveTodoToDaily, getPlanItems,
} from '@/lib/api'
import { TODO_PERIOD_KEY } from '@/lib/types'
import type { PlanItem, PlanItemTask } from '@/lib/types'
import { useUndo } from '@/lib/undo-stack'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { SubTaskPanel, SortableRow } from '@/components/SubTaskPanel'

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function TodoItemCard({ item, onToggle, onDelete, onRename, onMoveToDaily, dragHandle }: {
  item: PlanItem
  onToggle: () => void
  onDelete: () => void
  onRename: (title: string) => void
  onMoveToDaily: () => void
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

  return (
    <div className={`rounded-2xl border transition-all overflow-hidden ${
      isDone ? 'border-gray-100 bg-gray-50' : expanded ? 'border-purple-200 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
    }`}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        {dragHandle}
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

        {editing ? (
          <input
            ref={inputRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(item.title); setEditing(false) } }}
            className="flex-1 text-sm border border-purple-300 rounded-lg px-2 py-1 focus:outline-none"
          />
        ) : (
          <span
            onDoubleClick={() => !isDone && setEditing(true)}
            className={`flex-1 text-sm font-medium cursor-default ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}
          >
            {item.title}
          </span>
        )}

        {!isDone && (
          <button
            onClick={() => setExpanded(e => !e)}
            className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-lg transition-all ${
              expanded ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {expanded ? '접기' : '세부내용'}
          </button>
        )}

        <button
          onClick={onMoveToDaily}
          title="일정으로 이동 (원본 삭제)"
          className="flex-shrink-0 text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-purple-100 hover:text-purple-700 transition-all"
        ><CalendarPlus size={14} /></button>

        <button
          onClick={onDelete}
          className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors text-sm"
        >✕</button>
      </div>

      {expanded && !isDone && <SubTaskPanel itemId={item.id} />}
    </div>
  )
}

export default function TodoPage() {
  const [items, setItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [movingId, setMovingId] = useState<string | null>(null)
  const [moveDate, setMoveDate] = useState<string>(todayKey())
  const [moving, setMoving] = useState(false)
  const { push: pushUndo } = useUndo()

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getTodoItems()
    setItems(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const handleAdd = async () => {
    const t = newTitle.trim()
    if (!t) return
    const item = await createPlanItem({
      title: t, level: 'todo', period_key: TODO_PERIOD_KEY,
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
          level: 'todo',
          period_key: TODO_PERIOD_KEY,
          sort_order: item.sort_order,
        })
        await Promise.all(tasks.map((t, idx) => createTask(restored.id, t.title, idx)))
        await load()
      },
    })
  }

  const handleRename = async (id: string, title: string) => {
    const updated = await updatePlanItem(id, { title })
    setItems(prev => prev.map(i => i.id === id ? updated : i))
  }

  const startMove = (id: string) => {
    setMovingId(id)
    setMoveDate(todayKey())
  }

  const confirmMove = async () => {
    if (!movingId || !moveDate || moving) return
    setMoving(true)
    try {
      const dailyItems = await getPlanItems('daily', moveDate)
      const target = items.find(i => i.id === movingId)
      await moveTodoToDaily(movingId, moveDate, dailyItems.length)
      setItems(prev => prev.filter(i => i.id !== movingId))
      if (target) {
        pushUndo({
          label: `"${target.title}" 이동 되돌리기 (${moveDate} → TO-DO)`,
          restore: async () => {
            await updatePlanItem(movingId, { level: 'todo', period_key: TODO_PERIOD_KEY, sort_order: target.sort_order })
            await load()
          },
        })
      }
      setMovingId(null)
    } catch (err) {
      console.error('[todo move]', err)
      alert('일정으로 이동 중 오류가 발생했습니다.')
    } finally {
      setMoving(false)
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

  const completedCount = items.filter(i => i.status === 'completed').length

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Inbox size={22} className="text-purple-600" />
          <h1 className="text-2xl font-bold text-gray-900">TO-DO</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          언젠가 할 일 · 아이디어 · 메모 — 필요할 때 일정으로 이동하세요
        </p>
        {items.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">{items.length}개 항목 · 완료 {completedCount}개</p>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : (
        <div className="space-y-2 mb-4">
          {items.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
              <div className="flex justify-center mb-2"><Inbox size={20} /></div>
              <p className="text-gray-500 font-medium">TO-DO를 추가하세요</p>
              <p className="text-xs text-gray-400 mt-1">일정처럼 오늘 할 게 아닌, 언젠가 할 일을 모아두는 곳입니다</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleReorderItems}>
              <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                {items.map(item => (
                  <SortableRow key={item.id} id={item.id}>
                    {(handle) => (
                      <TodoItemCard
                        item={item}
                        onToggle={() => handleToggle(item.id)}
                        onDelete={() => handleDelete(item.id)}
                        onRename={(title) => handleRename(item.id, title)}
                        onMoveToDaily={() => startMove(item.id)}
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

      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder="TO-DO 입력 후 Enter 또는 추가 버튼..."
            className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button
            onClick={handleAdd}
            disabled={!newTitle.trim()}
            className="bg-purple-500 hover:bg-purple-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium disabled:opacity-40 transition-colors"
          >
            추가
          </button>
        </div>
      </div>

      {movingId && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-40 w-[calc(100%-2rem)] max-w-md">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <CalendarPlus size={16} className="text-purple-300" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">일정으로 이동 (원본 삭제)</p>
                <p className="text-xs font-medium truncate">
                  {items.find(i => i.id === movingId)?.title}
                </p>
              </div>
              <button
                onClick={() => setMovingId(null)}
                disabled={moving}
                className="text-gray-400 hover:text-white text-sm px-1.5"
                title="취소"
              >✕</button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-gray-400 whitespace-nowrap">대상 날짜</label>
              <input
                type="date"
                value={moveDate}
                onChange={e => setMoveDate(e.target.value)}
                disabled={moving}
                className="flex-1 text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-purple-400 min-w-0"
                style={{ colorScheme: 'dark' }}
              />
              <button
                onClick={confirmMove}
                disabled={moving || !moveDate}
                className="text-[11px] font-semibold bg-purple-500 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors"
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
