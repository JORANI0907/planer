'use client'

import { useState, useEffect, useCallback } from 'react'
import { ClipboardList } from 'lucide-react'
import {
  getPlanItems, createPlanItem, updatePlanItem, deletePlanItem,
  getTasksForItem, createTask,
} from '@/lib/api'
import { useUndo } from '@/lib/undo-stack'
import type { PlanItem, PlanItemTask, PlanLevel } from '@/lib/types'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { SubTaskPanel, SortableRow } from '@/components/SubTaskPanel'

export type Period = 'annual' | 'quarterly' | 'monthly'

interface Clipboard {
  item: PlanItem
  tasks: PlanItemTask[]
  fromPeriodKey: string
}

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

function PeriodItemCard({ item, onToggle, onDelete, onRename, onCopy, dragHandle }: {
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
        : expanded
          ? 'border-blue-200 bg-white shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300'
    }`}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        {dragHandle}

        {/* 완료 체크박스 */}
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
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') saveTitle()
              if (e.key === 'Escape') { setTitle(item.title); setEditing(false) }
            }}
            className="flex-1 text-sm border border-blue-300 rounded-lg px-2 py-1 focus:outline-none"
          />
        ) : (
          <span
            onDoubleClick={() => !isDone && setEditing(true)}
            className={`flex-1 text-sm font-medium cursor-default ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}
          >
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

        {/* 복사/이동 */}
        <button
          onClick={onCopy}
          title="다른 기간으로 복사/이동"
          className="flex-shrink-0 text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-700 transition-all"
        ><ClipboardList size={14} /></button>

        {/* 삭제 */}
        <button
          onClick={onDelete}
          className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors text-sm"
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
  const [clipboard, setClipboard] = useState<Clipboard | null>(null)
  const [pasting, setPasting] = useState(false)
  const [pasteKey, setPasteKey] = useState('')
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

  const handleCopy = async (item: PlanItem) => {
    let tasks: PlanItemTask[] = []
    try { tasks = await getTasksForItem(item.id) } catch { /* ignore */ }
    setClipboard({ item, tasks, fromPeriodKey: item.period_key })
    setPasteKey(getNextPeriodKey(period, curYear, curQ, curM))
  }

  const handlePaste = async (mode: 'copy' | 'move') => {
    if (!clipboard || pasting || !pasteKey.trim()) return
    if (mode === 'move' && pasteKey === clipboard.fromPeriodKey) return
    setPasting(true)
    try {
      const { item: src, tasks } = clipboard
      const targetItems = pasteKey === periodKey ? items : await getPlanItems(level, pasteKey)
      const newItem = await createPlanItem({
        title: src.title, description: src.description, categories: src.categories,
        status: mode === 'move' ? src.status : 'pending', priority: src.priority,
        level, period_key: pasteKey, sort_order: targetItems.length,
      })
      if (tasks.length > 0) {
        await Promise.all(tasks.map((t, idx) => createTask(newItem.id, t.title, idx)))
      }
      if (mode === 'move') {
        await deletePlanItem(src.id)
        pushUndo({
          label: `"${src.title}" 이동 되돌리기 (${pasteKey} → ${src.period_key})`,
          restore: async () => {
            try { await deletePlanItem(newItem.id) } catch { /* ignore */ }
            const restored = await createPlanItem({
              title: src.title, description: src.description, categories: src.categories,
              status: src.status, priority: src.priority, level,
              period_key: src.period_key, sort_order: src.sort_order,
            })
            await Promise.all(tasks.map((t, idx) => createTask(restored.id, t.title, idx)))
            if (src.period_key === periodKey || pasteKey === periodKey) await load()
          },
        })
      }
      setClipboard(null)
      setPasteKey('')
      if (pasteKey === periodKey || (mode === 'move' && src.period_key === periodKey)) {
        await load()
      }
    } catch { /* ignore */ } finally { setPasting(false) }
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

  return (
    <div className="max-w-2xl mx-auto">

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
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5">
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

      {/* 복사/이동 클립보드 배너 */}
      {clipboard && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-40 w-[calc(100%-2rem)] max-w-md">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList size={14} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">원본: {clipboard.fromPeriodKey}</p>
                <p className="text-xs font-medium truncate">{clipboard.item.title}</p>
              </div>
              <button
                onClick={() => { setClipboard(null); setPasteKey('') }}
                disabled={pasting}
                className="text-gray-400 hover:text-white text-sm px-1.5"
                title="취소"
              >✕</button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-gray-400 whitespace-nowrap">대상 기간</label>
              <input
                type="text"
                value={pasteKey}
                onChange={e => setPasteKey(e.target.value)}
                disabled={pasting}
                placeholder={getPastePlaceholder(period)}
                className="flex-1 text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-blue-400 min-w-0"
              />
              <button
                onClick={() => handlePaste('copy')}
                disabled={pasting || !pasteKey.trim()}
                className="text-[11px] font-semibold bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors"
              >복사</button>
              <button
                onClick={() => handlePaste('move')}
                disabled={pasting || !pasteKey.trim() || pasteKey === clipboard.fromPeriodKey}
                title={pasteKey === clipboard.fromPeriodKey ? '원본과 같은 기간으로는 이동할 수 없습니다' : ''}
                className="text-[11px] font-semibold bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors"
              >이동</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
