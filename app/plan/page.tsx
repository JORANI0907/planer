'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  getPlanSections, createPlanSection, updatePlanSection, deletePlanSection,
  getPlanItemsForYear, createPlanItem, updatePlanItem, deletePlanItem
} from '@/lib/api'
import type { PlanSection, PlanItem, PlanLevel } from '@/lib/types'
import { getCurrentYear, getISOWeekPublic } from '@/lib/types'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ─── 상수 ────────────────────────────────────────────────────
const SECTION_COLORS = [
  { key: 'blue',   bg: 'bg-blue-500',   light: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700' },
  { key: 'green',  bg: 'bg-green-500',  light: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700' },
  { key: 'purple', bg: 'bg-purple-500', light: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  { key: 'orange', bg: 'bg-orange-500', light: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  { key: 'pink',   bg: 'bg-pink-500',   light: 'bg-pink-50',   border: 'border-pink-200',   text: 'text-pink-700' },
  { key: 'indigo', bg: 'bg-indigo-500', light: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
  { key: 'red',    bg: 'bg-red-500',    light: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700' },
  { key: 'yellow', bg: 'bg-yellow-500', light: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
] as const

type ColorKey = typeof SECTION_COLORS[number]['key']

const LEVEL_CONFIG: { level: PlanLevel; label: string; icon: string }[] = [
  { level: 'annual',    label: '연간',  icon: '📅' },
  { level: 'quarterly', label: '분기',  icon: '📊' },
  { level: 'monthly',   label: '월간',  icon: '📆' },
  { level: 'weekly',    label: '주간',  icon: '📋' },
]

function getColorConfig(key: string) {
  return SECTION_COLORS.find(c => c.key === key) ?? SECTION_COLORS[0]
}

// ─── 기간 포맷 ───────────────────────────────────────────────
function formatPeriod(periodKey: string, level: PlanLevel): string {
  if (level === 'annual') return `${periodKey}년`
  if (level === 'quarterly') {
    const q = periodKey.split('-Q')[1]
    return `Q${q}`
  }
  if (level === 'monthly') {
    const m = parseInt(periodKey.split('-')[1])
    return `${m}월`
  }
  if (level === 'weekly') {
    const w = parseInt(periodKey.split('-W')[1])
    return `${w}주차`
  }
  return periodKey
}

// ─── 기간 선택 옵션 생성 ──────────────────────────────────────
function getPeriodOptions(level: PlanLevel, year: number): { value: string; label: string }[] {
  if (level === 'annual') return [{ value: String(year), label: `${year}년` }]
  if (level === 'quarterly') return [1,2,3,4].map(q => ({ value: `${year}-Q${q}`, label: `Q${q} (${(q-1)*3+1}~${q*3}월)` }))
  if (level === 'monthly') return Array.from({length:12}, (_,i) => ({ value: `${year}-${String(i+1).padStart(2,'0')}`, label: `${i+1}월` }))
  if (level === 'weekly') {
    const currentWeek = getISOWeekPublic(new Date())
    return Array.from({length:52}, (_,i) => ({ value: `${year}-W${String(i+1).padStart(2,'0')}`, label: `${i+1}주차` }))
      .slice(Math.max(0, currentWeek-4), currentWeek+8)
  }
  return []
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

// ─── 인라인 체크박스 아이템 ───────────────────────────────────
function PlanItemRow({
  item, onToggle, onDelete, onRename, dragHandle
}: {
  item: PlanItem
  onToggle: () => void
  onDelete: () => void
  onRename: (title: string) => void
  dragHandle?: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const save = () => {
    const t = title.trim()
    if (t && t !== item.title) onRename(t)
    setEditing(false)
  }

  const isDone = item.status === 'completed'

  return (
    <div className="group flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-black/5 transition-colors">
      {dragHandle}
      {/* 체크박스 */}
      <button
        onClick={onToggle}
        className={`flex-shrink-0 w-4.5 h-4.5 rounded border transition-all ${
          isDone ? 'bg-current border-current' : 'border-gray-300 hover:border-current'
        }`}
        style={{ width: 18, height: 18 }}
      >
        {isDone && (
          <svg viewBox="0 0 12 12" fill="none" className="w-full h-full p-0.5">
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* 제목 */}
      {editing ? (
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setTitle(item.title); setEditing(false) } }}
          className="flex-1 text-sm bg-white border border-blue-300 rounded px-2 py-0.5 focus:outline-none"
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className={`flex-1 text-sm cursor-text ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}
        >
          {item.title}
        </span>
      )}

      {/* 기간 배지 */}
      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
        {formatPeriod(item.period_key, item.level)}
      </span>

      {/* 삭제 버튼 */}
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0 text-xs"
      >✕</button>
    </div>
  )
}

// ─── 레벨 그룹 (연간/분기/월간/주간) ─────────────────────────
function LevelGroup({
  level, icon, label, items, year, sectionId, colorKey, onAdd, onToggle, onDelete, onRename, onReorder
}: {
  level: PlanLevel
  icon: string
  label: string
  items: PlanItem[]
  year: number
  sectionId: string | null
  colorKey: string
  onAdd: (title: string, periodKey: string) => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onReorder: (reorderedItems: PlanItem[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPeriod, setNewPeriod] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)
  const color = getColorConfig(colorKey)
  const periodOptions = getPeriodOptions(level, year)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  useEffect(() => {
    if (adding) {
      addInputRef.current?.focus()
      if (!newPeriod && periodOptions.length > 0) {
        setNewPeriod(periodOptions[0].value)
      }
    }
  }, [adding])

  const handleAdd = () => {
    const t = newTitle.trim()
    if (!t || !newPeriod) return
    onAdd(t, newPeriod)
    setNewTitle('')
    setAdding(false)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex(i => i.id === active.id)
    const newIdx = items.findIndex(i => i.id === over.id)
    const reordered = arrayMove(items, oldIdx, newIdx)
    onReorder(reordered)
  }

  const completedCount = items.filter(i => i.status === 'completed').length

  return (
    <div className="mb-4">
      {/* 레벨 헤더 */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{icon}</span>
          <span className="text-xs font-semibold text-gray-500">{label}</span>
          {items.length > 0 && (
            <span className="text-[10px] text-gray-400">
              {completedCount}/{items.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setAdding(true)}
          className={`text-xs ${color.text} hover:opacity-80 font-medium`}
        >
          + 추가
        </button>
      </div>

      {/* 아이템 목록 */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map(item => (
            <SortableRow key={item.id} id={item.id}>
              {(handle) => (
                <PlanItemRow
                  item={item}
                  onToggle={() => onToggle(item.id)}
                  onDelete={() => onDelete(item.id)}
                  onRename={(title) => onRename(item.id, title)}
                  dragHandle={handle}
                />
              )}
            </SortableRow>
          ))}
        </SortableContext>
      </DndContext>

      {/* 추가 폼 */}
      {adding && (
        <div className="flex items-center gap-1.5 mt-1 pl-6">
          <input
            ref={addInputRef}
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
            placeholder="항목 입력..."
            className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          {level !== 'annual' && (
            <select
              value={newPeriod}
              onChange={e => setNewPeriod(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
            >
              {periodOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
          <button onClick={handleAdd} className={`text-xs px-3 py-1.5 rounded-lg text-white ${color.bg}`}>추가</button>
          <button onClick={() => setAdding(false)} className="text-xs text-gray-400">취소</button>
        </div>
      )}

      {/* 빈 상태 */}
      {items.length === 0 && !adding && (
        <p className="text-xs text-gray-300 pl-6 py-0.5">없음</p>
      )}
    </div>
  )
}

// ─── 섹션 카드 ───────────────────────────────────────────────
function SectionCard({
  section, items, year, onAddItem, onToggleItem, onDeleteItem, onRenameItem,
  onDeleteSection, onRenameSection, onReorderItem
}: {
  section: PlanSection
  items: PlanItem[]
  year: number
  onAddItem: (sectionId: string, level: PlanLevel, title: string, periodKey: string) => void
  onToggleItem: (id: string) => void
  onDeleteItem: (id: string) => void
  onRenameItem: (id: string, title: string) => void
  onDeleteSection: (id: string) => void
  onRenameSection: (id: string, title: string) => void
  onReorderItem: (level: PlanLevel, reordered: PlanItem[]) => void
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(section.title)
  const color = getColorConfig(section.color)

  const saveTitle = () => {
    const t = title.trim()
    if (t && t !== section.title) onRenameSection(section.id, t)
    setEditingTitle(false)
  }

  const completedCount = items.filter(i => i.status === 'completed').length
  const totalCount = items.length

  return (
    <div className={`rounded-2xl border ${color.border} overflow-hidden shadow-sm`}>
      {/* 섹션 헤더 */}
      <div className={`${color.light} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2.5 flex-1">
          <div className={`w-2.5 h-2.5 rounded-full ${color.bg} flex-shrink-0`} />
          {editingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(section.title); setEditingTitle(false) } }}
              className={`flex-1 text-sm font-semibold ${color.text} bg-white border ${color.border} rounded px-2 py-0.5 focus:outline-none`}
            />
          ) : (
            <span
              onClick={() => setEditingTitle(true)}
              className={`text-sm font-semibold ${color.text} cursor-text`}
            >
              {section.title}
            </span>
          )}
          {totalCount > 0 && (
            <span className={`text-xs ${color.text} opacity-60`}>
              {completedCount}/{totalCount} 완료
            </span>
          )}
        </div>
        <button
          onClick={() => { if (confirm(`"${section.title}" 섹션을 삭제할까요? 항목은 삭제되지 않습니다.`)) onDeleteSection(section.id) }}
          className="text-gray-400 hover:text-red-400 text-xs ml-2"
        >
          삭제
        </button>
      </div>

      {/* 레벨 그룹들 */}
      <div className="px-4 py-3">
        {LEVEL_CONFIG.map(({ level, label, icon }) => (
          <LevelGroup
            key={level}
            level={level}
            icon={icon}
            label={label}
            items={items.filter(i => i.level === level)}
            year={year}
            sectionId={section.id}
            colorKey={section.color}
            onAdd={(t, p) => onAddItem(section.id, level, t, p)}
            onToggle={onToggleItem}
            onDelete={onDeleteItem}
            onRename={onRenameItem}
            onReorder={(reordered) => onReorderItem(level, reordered)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── 섹션 없는 항목 카드 ─────────────────────────────────────
function UnsortedCard({
  items, year, onAddItem, onToggleItem, onDeleteItem, onRenameItem, onReorderItem
}: {
  items: PlanItem[]
  year: number
  onAddItem: (level: PlanLevel, title: string, periodKey: string) => void
  onToggleItem: (id: string) => void
  onDeleteItem: (id: string) => void
  onRenameItem: (id: string, title: string) => void
  onReorderItem: (level: PlanLevel, reordered: PlanItem[]) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-gray-50 px-4 py-3 flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
        <span className="text-sm font-semibold text-gray-500">기타 (섹션 미지정)</span>
      </div>
      <div className="px-4 py-3">
        {LEVEL_CONFIG.map(({ level, label, icon }) => (
          <LevelGroup
            key={level}
            level={level}
            icon={icon}
            label={label}
            items={items.filter(i => i.level === level)}
            year={year}
            sectionId={null}
            colorKey="blue"
            onAdd={(t, p) => onAddItem(level, t, p)}
            onToggle={onToggleItem}
            onDelete={onDeleteItem}
            onRename={onRenameItem}
            onReorder={(reordered) => onReorderItem(level, reordered)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── 섹션 추가 다이얼로그 ────────────────────────────────────
function AddSectionModal({ year, onClose, onAdd }: { year: number; onClose: () => void; onAdd: (title: string, color: string) => void }) {
  const [title, setTitle] = useState('')
  const [color, setColor] = useState<ColorKey>('blue')

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h2 className="text-base font-bold text-gray-900 mb-4">새 섹션 만들기</h2>
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && title.trim()) { onAdd(title.trim(), color); onClose() } }}
          placeholder="섹션 이름 (예: 사업, 건강, 투자)"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
        />
        <div className="flex gap-2 flex-wrap mb-4">
          {SECTION_COLORS.map(c => (
            <button
              key={c.key}
              onClick={() => setColor(c.key)}
              className={`w-7 h-7 rounded-full ${c.bg} transition-all ${color === c.key ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { if (title.trim()) { onAdd(title.trim(), color); onClose() } }}
            disabled={!title.trim()}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-40"
          >
            만들기
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2.5 text-sm font-medium">
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────────────
export default function PlanPage() {
  const [year, setYear] = useState(getCurrentYear())
  const [sections, setSections] = useState<PlanSection[]>([])
  const [items, setItems] = useState<PlanItem[]>([])
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [secs, itms] = await Promise.all([
      getPlanSections(year),
      getPlanItemsForYear(year),
    ])
    setSections(secs)
    setItems(itms)
    setLoading(false)
  }, [year])

  useEffect(() => { load() }, [load])

  // 섹션 추가
  const handleAddSection = async (title: string, color: string) => {
    const newSec = await createPlanSection(year, title, color, sections.length)
    setSections(prev => [...prev, newSec])
  }

  // 섹션 이름 변경
  const handleRenameSection = async (id: string, title: string) => {
    const updated = await updatePlanSection(id, { title })
    setSections(prev => prev.map(s => s.id === id ? updated : s))
  }

  // 섹션 삭제
  const handleDeleteSection = async (id: string) => {
    await deletePlanSection(id)
    setSections(prev => prev.filter(s => s.id !== id))
  }

  // 항목 추가
  const handleAddItem = async (sectionId: string | null, level: PlanLevel, title: string, periodKey: string) => {
    const sectionItems = items.filter(i => i.section_id === sectionId && i.level === level)
    const newItem = await createPlanItem({
      title, level, period_key: periodKey,
      description: null, categories: [], status: 'pending', priority: 'medium',
      sort_order: sectionItems.length, section_id: sectionId,
    })
    setItems(prev => [...prev, newItem])
  }

  // 체크박스 토글
  const handleToggle = async (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    const newStatus = item.status === 'completed' ? 'pending' : 'completed'
    const updated = await updatePlanItem(id, { status: newStatus })
    setItems(prev => prev.map(i => i.id === id ? updated : i))
  }

  // 항목 삭제
  const handleDelete = async (id: string) => {
    await deletePlanItem(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  // 항목 이름 변경
  const handleRename = async (id: string, title: string) => {
    const updated = await updatePlanItem(id, { title })
    setItems(prev => prev.map(i => i.id === id ? updated : i))
  }

  // 항목 순서 변경
  const handleReorderItems = async (reordered: PlanItem[]) => {
    const idSet = new Set(reordered.map(i => i.id))
    setItems(prev =>
      prev
        .map(item => reordered.find(r => r.id === item.id) ?? item)
        .sort((a, b) => {
          if (!idSet.has(a.id) || !idSet.has(b.id)) return 0
          return reordered.findIndex(r => r.id === a.id) - reordered.findIndex(r => r.id === b.id)
        })
    )
    await Promise.all(reordered.map((item, idx) => updatePlanItem(item.id, { sort_order: idx })))
  }

  const today = new Date()
  const todayStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`

  // 전체 진행률
  const totalItems = items.length
  const completedItems = items.filter(i => i.status === 'completed').length

  return (
    <div className="max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">계획</h1>
          <p className="text-gray-500 mt-1">연간 · 분기 · 월간 · 주간</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">◀</button>
          <span className="font-bold text-gray-900 w-16 text-center">{year}년</span>
          <button onClick={() => setYear(y => y + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">▶</button>
        </div>
      </div>

      {/* 일일 계획 배너 */}
      <Link href="/daily"
        className="block bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-4 mb-6 text-white hover:opacity-95 transition-opacity shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-green-100 mb-0.5">오늘 · {todayStr}</p>
            <p className="font-semibold">✅ 일일 계획 보기</p>
          </div>
          <span className="text-2xl">→</span>
        </div>
      </Link>

      {/* 전체 진행률 */}
      {totalItems > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 font-medium">{year}년 전체 진행률</span>
            <span className="font-semibold text-blue-600">{completedItems}/{totalItems} 완료</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${totalItems ? (completedItems / totalItems) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">불러오는 중...</div>
      ) : (
        <div className="space-y-4">
          {/* 섹션 카드들 */}
          {sections.map(section => (
            <SectionCard
              key={section.id}
              section={section}
              items={items.filter(i => i.section_id === section.id)}
              year={year}
              onAddItem={handleAddItem}
              onToggleItem={handleToggle}
              onDeleteItem={handleDelete}
              onRenameItem={handleRename}
              onDeleteSection={handleDeleteSection}
              onRenameSection={handleRenameSection}
              onReorderItem={(_level, reordered) => handleReorderItems(reordered)}
            />
          ))}

          {/* 섹션 없는 항목 */}
          <UnsortedCard
            items={items.filter(i => i.section_id === null)}
            year={year}
            onAddItem={(level, title, periodKey) => handleAddItem(null, level, title, periodKey)}
            onToggleItem={handleToggle}
            onDeleteItem={handleDelete}
            onRenameItem={handleRename}
            onReorderItem={(_level, reordered) => handleReorderItems(reordered)}
          />

          {/* 섹션 추가 버튼 */}
          <button
            onClick={() => setAddSectionOpen(true)}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all text-sm font-medium"
          >
            + 새 섹션 만들기
          </button>

          {/* 섹션 없을 때 안내 */}
          {sections.length === 0 && items.length === 0 && (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-gray-500 font-medium mb-1">{year}년 계획을 시작하세요</p>
              <p className="text-sm text-gray-400">섹션을 만들어 계획을 체계적으로 관리하세요</p>
              <p className="text-xs text-gray-400 mt-1">예: 사업, 건강/운동, 투자, 개인/가족</p>
            </div>
          )}
        </div>
      )}

      {addSectionOpen && (
        <AddSectionModal
          year={year}
          onClose={() => setAddSectionOpen(false)}
          onAdd={handleAddSection}
        />
      )}
    </div>
  )
}
