'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  getPlanItems, createPlanItem, updatePlanItem, deletePlanItem,
  getTasksForItem, createTask, updateTask, deleteTask,
  getDailyItemsForMonth,
} from '@/lib/api'
import type { PlanItem, PlanItemTask } from '@/lib/types'
import { getCurrentYear, getCurrentQuarter, getCurrentMonth } from '@/lib/types'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const MonthCalendar = dynamic(() => import('@/components/MonthCalendar'), { ssr: false })

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

function fmtDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── 대시보드 + 일일계획 ─────────────────────────────

export default function DashboardPage() {
  const today = new Date()
  const year = getCurrentYear()
  const quarter = getCurrentQuarter()
  const month = getCurrentMonth()

  // 통계
  const [qStats, setQStats] = useState({ total: 0, done: 0 })
  const [mStats, setMStats] = useState({ total: 0, done: 0 })

  // 일일계획
  const [selectedDate, setSelectedDate] = useState(today)
  const [items, setItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')

  // 월간 캘린더
  const calYear = selectedDate.getFullYear()
  const calMonth = selectedDate.getMonth() + 1
  const [calendarItems, setCalendarItems] = useState<Record<string, PlanItem[]>>({})

  const periodKey = fmtDay(selectedDate)
  const isToday = fmtDay(selectedDate) === fmtDay(today)

  // 통계 로드
  useEffect(() => {
    const qKey = `${year}-Q${quarter}`
    const mKey = `${year}-${String(month).padStart(2, '0')}`
    Promise.all([getPlanItems('quarterly', qKey), getPlanItems('monthly', mKey)])
      .then(([q, m]) => {
        setQStats({ total: q.length, done: q.filter(i => i.status === 'completed').length })
        setMStats({ total: m.length, done: m.filter(i => i.status === 'completed').length })
      }).catch(() => {})
  }, [year, quarter, month])

  // 일일 로드
  const loadDaily = useCallback(async () => {
    setLoading(true)
    const data = await getPlanItems('daily', periodKey)
    setItems(data)
    setLoading(false)
  }, [periodKey])
  useEffect(() => { loadDaily() }, [loadDaily])

  // 월간 캘린더 데이터 로드
  useEffect(() => {
    getDailyItemsForMonth(calYear, calMonth).then(data => {
      const rec: Record<string, PlanItem[]> = {}
      data.forEach(item => {
        rec[item.period_key] = [...(rec[item.period_key] ?? []), item]
      })
      setCalendarItems(rec)
    }).catch(() => {})
  }, [calYear, calMonth])

  // 일일계획 변경 시 캘린더 동기화
  useEffect(() => {
    setCalendarItems(prev => ({ ...prev, [periodKey]: items }))
  }, [items, periodKey])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const handleAdd = async () => {
    const t = newTitle.trim(); if (!t) return
    const item = await createPlanItem({
      title: t, level: 'daily', period_key: periodKey,
      description: null, categories: [], status: 'pending', priority: 'medium', sort_order: items.length,
    })
    setItems(p => [...p, item]); setNewTitle('')
  }
  const handleToggle = async (id: string) => {
    const item = items.find(i => i.id === id); if (!item) return
    const u = await updatePlanItem(id, { status: item.status === 'completed' ? 'pending' : 'completed' })
    setItems(p => p.map(i => i.id === id ? u : i))
  }
  const handleDelete = async (id: string) => { await deletePlanItem(id); setItems(p => p.filter(i => i.id !== id)) }
  const handleRename = async (id: string, title: string) => {
    const u = await updatePlanItem(id, { title }); setItems(p => p.map(i => i.id === id ? u : i))
  }
  const handleReorder = async (e: DragEndEvent) => {
    const { active, over } = e; if (!over || active.id === over.id) return
    const reordered = arrayMove(items, items.findIndex(i => i.id === active.id), items.findIndex(i => i.id === over.id))
    setItems(reordered)
    await Promise.all(reordered.map((item, idx) => updatePlanItem(item.id, { sort_order: idx })))
  }

  const prevDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d) }
  const nextDay = () => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d) }
  const doneCount = items.filter(i => i.status === 'completed').length
  const dailyPct = items.length ? Math.round((doneCount / items.length) * 100) : 0
  const qPct = qStats.total ? Math.round((qStats.done / qStats.total) * 100) : 0
  const mPct = mStats.total ? Math.round((mStats.done / mStats.total) * 100) : 0

  return (
    <div className="max-w-2xl mx-auto">
      {/* 인사 헤더 */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">
          {isToday ? '오늘 하루도 화이팅!' : `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {year}년 {quarter}분기 · {month}월 {selectedDate.getDate()}일 {DAY_NAMES[selectedDate.getDay()]}요일
        </p>
      </div>

      {/* 요약 카드 3개 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label={`${quarter}분기`} pct={qPct} done={qStats.done} total={qStats.total} color="#3b82f6" />
        <StatCard label={`${month}월`} pct={mPct} done={mStats.done} total={mStats.total} color="#8b5cf6" />
        <StatCard label="오늘" pct={dailyPct} done={doneCount} total={items.length} color="#22c55e" />
      </div>

      {/* 바로가기 */}
      <div className="flex gap-3 mb-6">
        <Link href="/flowmap" className="flex-1 flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300 hover:shadow-sm transition-all">
          <span className="text-lg">🗺️</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">플로우맵</p>
            <p className="text-xs text-gray-400">전체 계획 관리</p>
          </div>
        </Link>
        <Link href="/decade" className="flex-1 flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300 hover:shadow-sm transition-all">
          <span className="text-lg">🚀</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">10년 계획</p>
            <p className="text-xs text-gray-400">장기 비전</p>
          </div>
        </Link>
      </div>

      {/* ── 월간 캘린더 ─────────────────── */}
      <MonthCalendar
        year={calYear}
        month={calMonth}
        selectedDate={selectedDate}
        calendarItems={calendarItems}
        onSelectDate={setSelectedDate}
      />

      {/* ── 일일 계획 섹션 ─────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
        {/* 날짜 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button onClick={prevDay} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-sm">◀</button>
          <div className="text-center">
            <span className="text-base font-bold text-gray-900">
              {selectedDate.getMonth() + 1}/{selectedDate.getDate()}
            </span>
            <span className="text-sm text-gray-500 ml-1.5">{DAY_NAMES[selectedDate.getDay()]}요일</span>
            {isToday && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">오늘</span>}
          </div>
          <button onClick={nextDay} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-sm">▶</button>
        </div>

        {/* 진행률 */}
        {items.length > 0 && (
          <div className="px-4 py-2.5 border-b border-gray-50 bg-gray-50/50">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-500">{doneCount}/{items.length} 완료</span>
              <span className="font-bold text-green-600">{dailyPct}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${dailyPct}%` }} />
            </div>
          </div>
        )}

        {/* 할 일 목록 */}
        <div className="p-3">
          {loading ? (
            <div className="text-center py-10 text-gray-400 text-sm">불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-gray-500 text-sm font-medium">할 일을 추가하세요</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleReorder}>
                <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  {items.map(item => (
                    <SortableRow key={item.id} id={item.id}>
                      {(handle) => (
                        <DailyItemCard item={item}
                          onToggle={() => handleToggle(item.id)}
                          onDelete={() => handleDelete(item.id)}
                          onRename={(t) => handleRename(item.id, t)}
                          dragHandle={handle} />
                      )}
                    </SortableRow>
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>

        {/* 추가 입력 */}
        <div className="px-3 pb-3 pt-1">
          <div className="flex gap-2">
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              placeholder="할 일 입력 후 Enter..."
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-400" />
            <button onClick={handleAdd} disabled={!newTitle.trim()}
              className="bg-green-500 hover:bg-green-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-40 transition-colors">
              추가
            </button>
          </div>
        </div>

        {/* 오늘로 돌아가기 */}
        {!isToday && (
          <div className="text-center pb-3">
            <button onClick={() => setSelectedDate(new Date(today))} className="text-xs text-blue-500 hover:underline">오늘로 돌아가기</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 통계 카드 ───────────────────────────────────────

function StatCard({ label, pct, done, total, color }: { label: string; pct: number; done: number; total: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
      <div className="text-xs text-gray-500 mb-1.5">{label}</div>
      <div className="text-xl font-bold mb-1.5" style={{ color }}>{pct}%</div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mx-2">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="text-xs text-gray-400 mt-1.5">{done}/{total}</div>
    </div>
  )
}

// ── SortableRow ─────────────────────────────────────

function SortableRow({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, position: isDragging ? 'relative' as const : undefined, zIndex: isDragging ? 50 : undefined }
  const handle = <button {...attributes} {...listeners} className="touch-none cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0 select-none px-0.5" title="드래그">⠿</button>
  return <div ref={setNodeRef} style={style}>{children(handle)}</div>
}

// ── 세부 내용 패널 ──────────────────────────────────

function SubTaskPanel({ itemId }: { itemId: string }) {
  const [tasks, setTasks] = useState<PlanItemTask[]>([])
  const [loaded, setLoaded] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (!loaded) getTasksForItem(itemId).then(t => { setTasks(t); setLoaded(true) }) }, [loaded, itemId])
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100) }, [])

  const taskSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const handleAdd = async () => { const t = newTitle.trim(); if (!t) return; const task = await createTask(itemId, t, tasks.length); setTasks(p => [...p, task]); setNewTitle('') }
  const handleToggle = async (task: PlanItemTask) => { const u = await updateTask(task.id, { is_completed: !task.is_completed }); setTasks(p => p.map(t => t.id === u.id ? u : t)) }
  const handleDelete = async (id: string) => { await deleteTask(id); setTasks(p => p.filter(t => t.id !== id)) }
  const handleRename = async (id: string, title: string) => { const u = await updateTask(id, { title }); setTasks(p => p.map(t => t.id === u.id ? u : t)); setEditingId(null) }
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event; if (!over || active.id === over.id) return
    const reordered = arrayMove(tasks, tasks.findIndex(t => t.id === active.id), tasks.findIndex(t => t.id === over.id))
    setTasks(reordered); await Promise.all(reordered.map((t, i) => updateTask(t.id, { sort_order: i })))
  }

  if (!loaded) return <div className="px-4 py-3 text-xs text-gray-400">불러오는 중...</div>

  return (
    <div className="mx-3 mb-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
      <p className="text-xs font-semibold text-gray-500 mb-2">세부 내용</p>
      {tasks.length === 0 && <p className="text-xs text-gray-400 mb-2">세부 내용을 추가하세요</p>}
      <div className="space-y-1.5 mb-2">
        <DndContext sensors={taskSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map(task => (
              <SortableRow key={task.id} id={task.id}>
                {(handle) => (
                  <div className="group flex items-center gap-2">
                    {handle}
                    <button onClick={() => handleToggle(task)}
                      className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${task.is_completed ? 'bg-gray-500 border-gray-500' : 'border-gray-300 hover:border-gray-600'}`}>
                      {task.is_completed && <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                    </button>
                    {editingId === task.id ? (
                      <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)}
                        onBlur={() => { const t = editTitle.trim(); if (t && t !== task.title) handleRename(task.id, t); else setEditingId(null) }}
                        onKeyDown={e => { if (e.key === 'Enter') { const t = editTitle.trim(); if (t && t !== task.title) handleRename(task.id, t); else setEditingId(null) }; if (e.key === 'Escape') setEditingId(null) }}
                        className="flex-1 text-xs border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none bg-white" />
                    ) : (
                      <span className={`flex-1 text-xs ${task.is_completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task.title}</span>
                    )}
                    {!task.is_completed && editingId !== task.id && (
                      <button onClick={() => { setEditingId(task.id); setEditTitle(task.title) }} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-400 text-xs">✎</button>
                    )}
                    <button onClick={() => handleDelete(task.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs">✕</button>
                  </div>
                )}
              </SortableRow>
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <div className="flex gap-1.5">
        <input ref={inputRef} value={newTitle} onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder="세부 내용 입력 후 Enter..."
          className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white" />
        <button onClick={handleAdd} disabled={!newTitle.trim()} className="text-xs bg-gray-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-40">추가</button>
      </div>
    </div>
  )
}

// ── 할 일 카드 ──────────────────────────────────────

function DailyItemCard({ item, onToggle, onDelete, onRename, dragHandle }: {
  item: PlanItem; onToggle: () => void; onDelete: () => void; onRename: (title: string) => void; dragHandle?: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  const saveTitle = () => { const t = title.trim(); if (t && t !== item.title) onRename(t); setEditing(false) }
  const isDone = item.status === 'completed'

  return (
    <div className={`rounded-xl border transition-all overflow-hidden ${isDone ? 'border-gray-100 bg-gray-50' : expanded ? 'border-blue-200 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {dragHandle}
        <button onClick={onToggle}
          className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isDone ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}>
          {isDone && <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </button>
        {editing ? (
          <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
            onBlur={saveTitle} onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(item.title); setEditing(false) } }}
            className="flex-1 text-sm border border-blue-300 rounded-lg px-2 py-1 focus:outline-none" />
        ) : (
          <span onDoubleClick={() => !isDone && setEditing(true)}
            className={`flex-1 text-sm font-medium cursor-default ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item.title}</span>
        )}
        {!isDone && (
          <button onClick={() => setExpanded(e => !e)}
            className={`flex-shrink-0 text-xs px-2 py-1 rounded-lg transition-all ${expanded ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {expanded ? '접기' : '세부'}
          </button>
        )}
        <button onClick={onDelete} className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors text-sm">✕</button>
      </div>
      {expanded && !isDone && <SubTaskPanel itemId={item.id} />}
    </div>
  )
}
