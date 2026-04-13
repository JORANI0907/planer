'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getPlanItems, createPlanItem, updatePlanItem, deletePlanItem,
  getTasksForItem, createTask, updateTask, deleteTask,
  getDailyItemsForMonth, createMapping, deleteMapping, deleteAllMappingsForItem, getMappingsForItems,
  getLifeGoalsForAnnual, getLifeGoals, createLifeGoalAnnualMapping, deleteLifeGoalAnnualMapping, updateLifeGoal,
} from '@/lib/api'
import type { PlanItem, PlanItemTask, LifeGoal, LifeGoalAnnualMapping, GoalType, AgeGroup } from '@/lib/types'
import { getCurrentYear, getCurrentQuarter, getMonthWeeks, getWeekDays, GOAL_TYPE_CONFIG, GOAL_PROGRESS_CONFIG, calcDaysLeft, calcProgressPct } from '@/lib/types'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ─── 상수 ────────────────────────────────────────────────────
const Q_CONFIG = [
  { q: 1, months: [1, 2, 3], color: 'blue',   label: '1분기', range: '1~3월' },
  { q: 2, months: [4, 5, 6], color: 'pink',   label: '2분기', range: '4~6월' },
  { q: 3, months: [7, 8, 9], color: 'sky',    label: '3분기', range: '7~9월' },
  { q: 4, months: [10,11,12],color: 'amber',  label: '4분기', range: '10~12월' },
]

const Q_STYLE: Record<string, { tab: string; active: string; light: string; border: string; dot: string; text: string }> = {
  blue:   { tab: 'border-blue-200 text-blue-700',     active: 'bg-blue-600 text-white border-blue-600',     light: 'bg-blue-50',    border: 'border-blue-200',   dot: 'bg-blue-500',   text: 'text-blue-700' },
  pink:   { tab: 'border-pink-200 text-pink-700',     active: 'bg-pink-500 text-white border-pink-500',     light: 'bg-pink-50',    border: 'border-pink-200',   dot: 'bg-pink-500',   text: 'text-pink-700' },
  sky:    { tab: 'border-sky-200 text-sky-700',       active: 'bg-sky-500 text-white border-sky-500',       light: 'bg-sky-50',     border: 'border-sky-200',    dot: 'bg-sky-500',    text: 'text-sky-700' },
  amber:  { tab: 'border-amber-200 text-amber-700',   active: 'bg-amber-500 text-white border-amber-500',   light: 'bg-amber-50',   border: 'border-amber-200',  dot: 'bg-amber-500',  text: 'text-amber-700' },
  violet: { tab: 'border-violet-200 text-violet-700', active: 'bg-violet-600 text-white border-violet-600', light: 'bg-violet-50',  border: 'border-violet-200', dot: 'bg-violet-500', text: 'text-violet-700' },
}

const ROUTINE_CONFIG = { q: 0, months: [1,2,3,4,5,6,7,8,9,10,11,12], color: 'violet', label: '순기', range: '연중 반복' }

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일']
const MONTH_NAMES = ['', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

// ─── 정렬 가능한 행 래퍼 ──────────────────────────────────────
function SortableRow({ id, data, children }: { id: string; data?: Record<string, unknown>; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data })
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

function toDayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getQuarterWeeks(year: number, months: number[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  months.forEach(m => getMonthWeeks(year, m).forEach(w => { if (!seen.has(w)) { seen.add(w); result.push(w) } }))
  return result
}

// ─── 연간계획: 직접 추가 항목 카드 ──────────────────────────
function AnnualItemCard({ item, onUpdate, onDelete }: {
  item: PlanItem
  onUpdate: (id: string, title: string) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(item.title)

  const handleSave = () => {
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== item.title) onUpdate(item.id, trimmed)
    setEditing(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') { setEditTitle(item.title); setEditing(false) }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-xl border border-blue-200 bg-blue-50">
        <input
          autoFocus
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onKeyDown={handleKey}
          onBlur={handleSave}
          className="flex-1 text-sm bg-transparent outline-none text-gray-800"
        />
        <button onClick={handleSave} className="text-blue-600 text-xs font-medium hover:text-blue-800">저장</button>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-2 rounded-xl border border-gray-100 bg-white p-3 hover:shadow-sm transition-shadow min-w-0">
      <span className="text-sm flex-shrink-0 text-gray-400">•</span>
      <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 break-words">{item.title}</span>
      <button
        onClick={() => { setEditTitle(item.title); setEditing(true) }}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-400 text-xs flex-shrink-0 transition-opacity px-1"
        title="수정"
      >
        ✎
      </button>
      <button
        onClick={() => onDelete(item.id)}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs flex-shrink-0 transition-opacity"
        title="삭제"
      >
        ✕
      </button>
    </div>
  )
}

// ─── 연간계획: 연동 목표 카드 ─────────────────────────────────
function LinkedGoalCard({ goal, onUnlink, onUpdate }: {
  goal: LifeGoal
  onUnlink: () => void
  onUpdate: (id: string, title: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(goal.title)
  const typeCfg = goal.goal_type ? GOAL_TYPE_CONFIG[goal.goal_type as GoalType] : null
  const progressCfg = GOAL_PROGRESS_CONFIG[goal.progress]
  const daysLeft = goal.target_date ? calcDaysLeft(goal.target_date) : null
  const progressPct = calcProgressPct(goal.start_value, goal.end_value)

  const handleSave = () => {
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== goal.title) onUpdate(goal.id, trimmed)
    setEditing(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') { setEditTitle(goal.title); setEditing(false) }
  }

  return (
    <div className="group rounded-xl border border-gray-100 bg-white p-3 hover:shadow-sm transition-shadow overflow-hidden">
      <div className="flex items-center gap-2 min-w-0">
        {typeCfg && <span className="text-sm flex-shrink-0">{typeCfg.icon}</span>}
        {editing ? (
          <input
            autoFocus
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onKeyDown={handleKey}
            onBlur={handleSave}
            className="flex-1 text-sm bg-blue-50 border border-blue-200 rounded-lg px-2 py-0.5 outline-none text-gray-800"
          />
        ) : (
          <span
            className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate cursor-text"
            onDoubleClick={() => { setEditTitle(goal.title); setEditing(true) }}
          >
            {goal.title}
          </span>
        )}
        {progressCfg && !editing && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${progressCfg.color}`}>
            {progressCfg.label}
          </span>
        )}
        {!editing && (
          <>
            <button
              onClick={() => { setEditTitle(goal.title); setEditing(true) }}
              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-400 text-xs flex-shrink-0 transition-opacity px-1"
              title="수정"
            >
              ✎
            </button>
            <button
              onClick={() => setExpanded(x => !x)}
              className="text-gray-400 hover:text-gray-600 text-xs flex-shrink-0 px-1"
              title="세부내용 보기"
            >
              {expanded ? '▴' : '▾'}
            </button>
            <button
              onClick={onUnlink}
              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs flex-shrink-0 transition-opacity"
              title="연동 해제"
            >
              ✕
            </button>
          </>
        )}
      </div>
      {expanded && !editing && (
        <div className="mt-2.5 pl-6 space-y-1.5">
          {goal.description && (
            <p className="text-xs text-gray-500 leading-relaxed">{goal.description}</p>
          )}
          {goal.target_date && (
            <p className="text-xs text-gray-400">
              목표일: {goal.target_date}
              {daysLeft !== null && (
                <span className={`ml-2 font-medium ${daysLeft < 0 ? 'text-red-500' : daysLeft < 30 ? 'text-orange-500' : 'text-gray-500'}`}>
                  ({daysLeft < 0 ? `${Math.abs(daysLeft)}일 초과` : `D-${daysLeft}`})
                </span>
              )}
            </p>
          )}
          {progressPct !== null && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{progressPct}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 연간계획: 10년 목표 선택 모달 (나이대→목표유형 정렬) ────
const AGE_GROUPS: AgeGroup[] = ['30대', '40대', '50대', '60대']
const GOAL_TYPE_ORDER: GoalType[] = ['가족목표', '개인목표', '사업목표']

function GoalPickerModalByAge({ allGoals, linkedIds, onToggle, onClose }: {
  allGoals: LifeGoal[]
  linkedIds: Set<string>
  onToggle: (goal: LifeGoal) => void
  onClose: () => void
}) {
  // Group by age_group then goal_type
  const sections = AGE_GROUPS.flatMap(age => {
    const byType = GOAL_TYPE_ORDER.map(type => ({
      age,
      type,
      cfg: GOAL_TYPE_CONFIG[type],
      goals: allGoals.filter(g => g.age_group === age && g.goal_type === type),
    })).filter(s => s.goals.length > 0)
    const untyped = allGoals.filter(g => g.age_group === age && !g.goal_type)
    if (untyped.length > 0) byType.push({ age, type: '기타' as GoalType, cfg: { label: '기타', color: '', icon: '' }, goals: untyped })
    return byType
  })
  const noAge = allGoals.filter(g => !g.age_group)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">10년 목표 연동</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {sections.map(({ age, type, cfg, goals }) => (
            <div key={`${age}-${type}`}>
              <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                <span className="bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{age}</span>
                {cfg.icon && <span>{cfg.icon}</span>}
                <span>{cfg.label}</span>
              </p>
              <div className="space-y-1.5">
                {goals.map(goal => {
                  const isLinked = linkedIds.has(goal.id)
                  return (
                    <label key={goal.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isLinked}
                        onChange={() => onToggle(goal)}
                        className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                      />
                      <span className="flex-1 text-sm text-gray-700">{goal.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${GOAL_PROGRESS_CONFIG[goal.progress].color}`}>
                        {GOAL_PROGRESS_CONFIG[goal.progress].label}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
          {noAge.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">기타</p>
              <div className="space-y-1.5">
                {noAge.map(goal => {
                  const isLinked = linkedIds.has(goal.id)
                  return (
                    <label key={goal.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isLinked}
                        onChange={() => onToggle(goal)}
                        className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                      />
                      <span className="flex-1 text-sm text-gray-700">{goal.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${GOAL_PROGRESS_CONFIG[goal.progress].color}`}>
                        {GOAL_PROGRESS_CONFIG[goal.progress].label}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
          {allGoals.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">등록된 10년 목표가 없습니다.</p>
          )}
        </div>
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            완료
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 연간계획 섹션 ─────────────────────────────────────────────
function AnnualSection({ year }: { year: number }) {
  const periodKey = String(year)
  const [annualItems, setAnnualItems] = useState<PlanItem[]>([])
  const [linkedGoals, setLinkedGoals] = useState<{ mapping: LifeGoalAnnualMapping; goal: LifeGoal }[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [allGoals, setAllGoals] = useState<LifeGoal[]>([])
  const [sectionOpen, setSectionOpen] = useState(true)
  const [loadingAll, setLoadingAll] = useState(false)
  const [addingItem, setAddingItem] = useState(false)
  const [newItemTitle, setNewItemTitle] = useState('')

  useEffect(() => {
    getPlanItems('annual', periodKey).then(setAnnualItems).catch(() => {})
    getLifeGoalsForAnnual(periodKey).then(setLinkedGoals).catch(() => {})
  }, [periodKey])

  const linkedIds = new Set(linkedGoals.map(lg => lg.goal.id))
  const totalCount = annualItems.length + linkedGoals.length

  const handleAddItem = async () => {
    const trimmed = newItemTitle.trim()
    if (!trimmed) return
    const item = await createPlanItem({
      title: trimmed, level: 'annual', period_key: periodKey,
      description: null, categories: [], status: 'pending', priority: 'medium',
      sort_order: annualItems.length,
    })
    setAnnualItems(prev => [...prev, item])
    setNewItemTitle('')
    setAddingItem(false)
  }

  const handleUpdateItem = async (id: string, title: string) => {
    const updated = await updatePlanItem(id, { title })
    setAnnualItems(prev => prev.map(i => i.id === id ? updated : i))
  }

  const handleDeleteItem = async (id: string) => {
    await deletePlanItem(id)
    setAnnualItems(prev => prev.filter(i => i.id !== id))
  }

  const handleOpenPicker = async () => {
    if (allGoals.length === 0 && !loadingAll) {
      setLoadingAll(true)
      try {
        const goals = await getLifeGoals()
        setAllGoals(goals)
      } finally {
        setLoadingAll(false)
      }
    }
    setShowPicker(true)
  }

  const handleToggleLink = async (goal: LifeGoal) => {
    if (linkedIds.has(goal.id)) {
      await deleteLifeGoalAnnualMapping(goal.id, periodKey)
      setLinkedGoals(prev => prev.filter(lg => lg.goal.id !== goal.id))
    } else {
      await createLifeGoalAnnualMapping(goal.id, periodKey)
      const freshLinked = await getLifeGoalsForAnnual(periodKey)
      setLinkedGoals(freshLinked)
    }
  }

  const handleUnlink = async (goalId: string) => {
    await deleteLifeGoalAnnualMapping(goalId, periodKey)
    setLinkedGoals(prev => prev.filter(lg => lg.goal.id !== goalId))
  }

  const handleUpdateGoal = async (id: string, title: string) => {
    await updateLifeGoal(id, { title })
    setLinkedGoals(prev => prev.map(lg =>
      lg.goal.id === id ? { ...lg, goal: { ...lg.goal, title } } : lg
    ))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 mb-5">
      <div className="flex items-center justify-between px-5 py-3.5">
        <button
          onClick={() => setSectionOpen(x => !x)}
          className="flex items-center gap-2 text-left"
        >
          <span className="font-semibold text-gray-800 text-sm">📋 연간계획</span>
          {totalCount > 0 && (
            <span className="text-xs text-gray-400 font-normal">{totalCount}개</span>
          )}
          <span className="text-gray-400 text-xs ml-1">{sectionOpen ? '▴' : '▾'}</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddingItem(true)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
          >
            + 직접
          </button>
          <button
            onClick={handleOpenPicker}
            disabled={loadingAll}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {loadingAll ? '불러오는 중...' : '+ 연동'}
          </button>
        </div>
      </div>

      {sectionOpen && (
        <div className="px-5 pb-4 space-y-2">
          {annualItems.map(item => (
            <AnnualItemCard
              key={item.id}
              item={item}
              onUpdate={handleUpdateItem}
              onDelete={handleDeleteItem}
            />
          ))}
          {linkedGoals.map(({ goal }) => (
            <LinkedGoalCard
              key={goal.id}
              goal={goal}
              onUnlink={() => handleUnlink(goal.id)}
              onUpdate={handleUpdateGoal}
            />
          ))}
          {totalCount === 0 && !addingItem && (
            <p className="text-xs text-gray-400 text-center py-3">
              &quot;+ 직접&quot; 또는 &quot;+ 연동&quot; 버튼으로 연간계획을 추가하세요.
            </p>
          )}
          {addingItem && (
            <div className="flex items-center gap-2 p-2 rounded-xl border border-blue-200 bg-blue-50 mt-1">
              <input
                autoFocus
                value={newItemTitle}
                onChange={e => setNewItemTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddItem()
                  if (e.key === 'Escape') { setAddingItem(false); setNewItemTitle('') }
                }}
                placeholder="연간 계획 항목 입력..."
                className="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder-gray-400"
              />
              <button
                onClick={handleAddItem}
                className="text-blue-600 text-xs font-medium hover:text-blue-800"
              >
                추가
              </button>
              <button
                onClick={() => { setAddingItem(false); setNewItemTitle('') }}
                className="text-gray-400 text-xs hover:text-gray-600"
              >
                취소
              </button>
            </div>
          )}
        </div>
      )}

      {showPicker && (
        <GoalPickerModalByAge
          allGoals={allGoals}
          linkedIds={linkedIds}
          onToggle={handleToggleLink}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

// ─── 대기 아이템 카드 (세부계획 포함, 요일 배정) ─────────────
function WaitingItemCard({ item, monthKey, activeWeekKey, color, year, month, onUnassign, onAssignToDay, onAssignTaskToDay }: {
  item: PlanItem
  monthKey: string
  activeWeekKey: string | null
  color: string
  year: number
  month: number
  onUnassign: (itemId: string, monthKey: string) => void
  onAssignToDay: (itemId: string, dayKeys: string[]) => void
  onAssignTaskToDay: (taskTitle: string, parentItemId: string, dayKeys: string[]) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [tasks, setTasks] = useState<PlanItemTask[]>([])
  const [loaded, setLoaded] = useState(false)
  const [pickingItem, setPickingItem] = useState(false)
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [pickingTaskId, setPickingTaskId] = useState<string | null>(null)
  const [selectedTaskDays, setSelectedTaskDays] = useState<string[]>([])
  const style = Q_STYLE[color]

  const { attributes: dragAttrs, listeners: dragListeners, setNodeRef: setDragRef, transform: dragTransform, isDragging: isDraggingWaiting } = useDraggable({
    id: `w:${item.id}`,
    data: { type: 'waiting', itemId: item.id },
  })
  const dragStyle = { transform: CSS.Transform.toString(dragTransform), opacity: isDraggingWaiting ? 0.5 : 1, zIndex: isDraggingWaiting ? 50 : undefined }

  // 현재 선택된 주차의 날짜 중 이 월에 속하는 날짜들
  const monthDays = activeWeekKey
    ? getWeekDays(year, parseInt(activeWeekKey.split('-W')[1]))
    : []

  useEffect(() => {
    getTasksForItem(item.id).then(t => { setTasks(t); setLoaded(true) })
  }, [item.id])

  return (
    <div ref={setDragRef} style={dragStyle} className={`group bg-white border ${style.border} rounded-xl p-2.5 shadow-sm`}>
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Drag handle */}
        <button {...dragAttrs} {...dragListeners} className="touch-none cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 flex-shrink-0 select-none" title="드래그하여 요일에 배정">⠿</button>
        <span className={`flex-1 min-w-0 text-xs font-medium truncate ${style.text}`}>{item.title}</span>
        {loaded && tasks.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(x => !x) }}
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-all flex-shrink-0 ${
              expanded ? `${style.dot} text-white border-transparent` : `${style.tab} bg-white`
            }`}
          >
            {expanded ? '▴' : `▾ ${tasks.length}개`}
          </button>
        )}

        {/* 항목 요일 배정 버튼 */}
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); if (pickingItem) { setPickingItem(false) } else { setPickingItem(true); setSelectedDays([]) } }}
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-all ${
              pickingItem ? `${style.dot} text-white border-transparent` : `${style.tab} bg-white`
            }`}
            title="요일에 추가"
          >📅</button>
          {pickingItem && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-40 p-3 min-w-[180px]">
              {monthDays.length === 0 ? (
                <>
                  <p className="text-xs text-gray-400 text-center py-2">주차를 먼저 선택해주세요</p>
                  <button onClick={() => setPickingItem(false)} className="w-full text-xs text-gray-400 mt-1">닫기</button>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold text-gray-600 mb-2">요일 선택 (복수 가능)</p>
                  <div className="space-y-1 mb-3">
                    {monthDays.map(dk => {
                      const d = new Date(dk)
                      const dayName = DAY_NAMES[(d.getDay() + 6) % 7]
                      const checked = selectedDays.includes(dk)
                      return (
                        <label key={dk} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setSelectedDays(prev => prev.includes(dk) ? prev.filter(x => x !== dk) : [...prev, dk])}
                            className="w-3.5 h-3.5 rounded"
                          />
                          <span className="text-xs text-gray-700">{dayName} ({d.getMonth()+1}/{d.getDate()})</span>
                        </label>
                      )
                    })}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => { if (selectedDays.length > 0) onAssignToDay(item.id, selectedDays); setPickingItem(false) }}
                      disabled={selectedDays.length === 0}
                      className={`flex-1 text-xs py-1.5 rounded-lg text-white ${style.dot} disabled:opacity-40`}
                    >추가</button>
                    <button onClick={() => setPickingItem(false)} className="text-xs text-gray-400 px-2">취소</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onUnassign(item.id, monthKey) }}
          className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs flex-shrink-0"
          title="대기 목록에서 제거"
        >✕</button>
      </div>

      {expanded && loaded && tasks.length > 0 && (
        <div className="mt-2 pl-3 space-y-1.5 border-l-2 border-gray-200">
          {tasks.map(t => (
            <div key={t.id} className="group/task flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm border flex-shrink-0 ${t.is_completed ? 'bg-gray-400 border-gray-400' : 'border-gray-300'}`} />
              <span className={`text-[10px] flex-1 ${t.is_completed ? 'line-through text-gray-400' : 'text-gray-600'}`}>{t.title}</span>
              {/* 세부항목 요일 배정 버튼 */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); if (pickingTaskId === t.id) { setPickingTaskId(null) } else { setPickingTaskId(t.id); setSelectedTaskDays([]) } }}
                  className={`text-[10px] px-1 py-0.5 rounded border transition-all opacity-0 group-hover/task:opacity-100 ${
                    pickingTaskId === t.id ? `${style.dot} text-white border-transparent` : `${style.tab} bg-white`
                  }`}
                  title="요일에 추가"
                >📅</button>
                {pickingTaskId === t.id && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-40 p-3 min-w-[180px]">
                    {monthDays.length === 0 ? (
                      <p className="text-xs text-gray-400 py-1">주차를 먼저 선택해주세요</p>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-gray-600 mb-2">요일 선택 (복수 가능)</p>
                        <div className="space-y-1 mb-3">
                          {monthDays.map(dk => {
                            const d = new Date(dk)
                            const dayName = DAY_NAMES[(d.getDay() + 6) % 7]
                            const checked = selectedTaskDays.includes(dk)
                            return (
                              <label key={dk} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-gray-50">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => setSelectedTaskDays(prev => prev.includes(dk) ? prev.filter(x => x !== dk) : [...prev, dk])}
                                  className="w-3.5 h-3.5 rounded"
                                />
                                <span className="text-xs text-gray-700">{dayName} ({d.getMonth()+1}/{d.getDate()})</span>
                              </label>
                            )
                          })}
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => { if (selectedTaskDays.length > 0) onAssignTaskToDay(t.title, item.id, selectedTaskDays); setPickingTaskId(null) }}
                            disabled={selectedTaskDays.length === 0}
                            className={`flex-1 text-xs py-1.5 rounded-lg text-white ${style.dot} disabled:opacity-40`}
                          >추가</button>
                          <button onClick={() => setPickingTaskId(null)} className="text-xs text-gray-400 px-2">취소</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 월 대기 섹션 (주차 무관, 항상 표시) ────────────────────
function MonthWaitingSection({ monthKey, activeWeekKey, qItems, itemWeekMap, color, year, month, onUnassign, onAssignToDay, onAssignTaskToDay }: {
  monthKey: string
  activeWeekKey: string | null
  qItems: PlanItem[]
  itemWeekMap: Record<string, string[]>
  color: string
  year: number
  month: number
  onUnassign: (itemId: string, monthKey: string) => void
  onAssignToDay: (itemId: string, dayKeys: string[]) => void
  onAssignTaskToDay: (taskTitle: string, parentItemId: string, dayKeys: string[]) => void
}) {
  const style = Q_STYLE[color]
  const waitingItems = qItems.filter(item => itemWeekMap[item.id]?.includes(monthKey))
  if (waitingItems.length === 0) return null

  return (
    <div className={`mb-3 rounded-xl border ${style.border} p-3`} style={{ background: 'rgba(255,255,255,0.7)' }}>
      <p className={`text-xs font-semibold ${style.text} mb-2`}>
        📌 분기목표 대기
        {!activeWeekKey && <span className="ml-1 text-gray-400 font-normal">— 주차를 선택하면 요일 배정 가능</span>}
      </p>
      <div className="flex flex-col gap-2">
        {waitingItems.map(item => (
          <WaitingItemCard
            key={item.id}
            item={item}
            monthKey={monthKey}
            activeWeekKey={activeWeekKey}
            color={color}
            year={year}
            month={month}
            onUnassign={onUnassign}
            onAssignToDay={onAssignToDay}
            onAssignTaskToDay={onAssignTaskToDay}
          />
        ))}
      </div>
    </div>
  )
}

// ─── 세부 내용 (서브태스크) ───────────────────────────────────
function SubTaskList({ itemId, visible }: { itemId: string; visible: boolean }) {
  const [tasks, setTasks] = useState<PlanItemTask[]>([])
  const [loaded, setLoaded] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  useEffect(() => {
    if (visible && !loaded) {
      getTasksForItem(itemId).then(t => { setTasks(t); setLoaded(true) })
    }
  }, [visible, loaded, itemId])

  useEffect(() => {
    if (visible) inputRef.current?.focus()
  }, [visible])

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

  const handleRename = async (id: string, title: string) => {
    const updated = await updateTask(id, { title })
    setTasks(prev => prev.map(t => t.id === id ? updated : t))
    setEditingId(null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = tasks.findIndex(t => t.id === active.id)
    const newIdx = tasks.findIndex(t => t.id === over.id)
    const reordered = arrayMove(tasks, oldIdx, newIdx)
    setTasks(reordered)
    await Promise.all(reordered.map((t, i) => updateTask(t.id, { sort_order: i })))
  }

  if (!visible) return null

  return (
    <div className="ml-7 mt-1.5 pl-3 border-l-2 border-gray-200 space-y-1.5">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <SortableRow key={task.id} id={task.id}>
              {(handle) => (
                <div className="group flex items-center gap-1.5 py-0.5">
                  {handle}
                  <button
                    onClick={() => handleToggle(task)}
                    className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                      task.is_completed ? 'bg-gray-400 border-gray-400' : 'border-gray-300 hover:border-gray-500'
                    }`}
                  >
                    {task.is_completed && <svg viewBox="0 0 10 10" fill="none" className="w-2 h-2"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                  </button>
                  {editingId === task.id ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(task.id, editTitle)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      onBlur={() => handleRename(task.id, editTitle)}
                      className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-300 bg-white"
                    />
                  ) : (
                    <span className={`text-xs flex-1 min-w-0 ${task.is_completed ? 'line-through text-gray-400' : 'text-gray-600'}`}>{task.title}</span>
                  )}
                  {!task.is_completed && editingId !== task.id && (
                    <button
                      onClick={() => { setEditingId(task.id); setEditTitle(task.title) }}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-400 text-xs flex-shrink-0 transition-opacity"
                    >✎</button>
                  )}
                  <button onClick={() => handleDelete(task.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs flex-shrink-0">✕</button>
                </div>
              )}
            </SortableRow>
          ))}
        </SortableContext>
      </DndContext>
      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder="세부 내용 추가..."
          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
        <button onClick={handleAdd} className="text-xs text-blue-600 hover:text-blue-800 font-medium">추가</button>
      </div>
    </div>
  )
}

// ─── 일일 항목 (체크박스 + 세부내용 + 수정) ─────────────────
function DayItem({ item, onToggle, onDelete, onEdit, color, dragHandle }: {
  item: PlanItem
  onToggle: () => void
  onDelete: () => void
  onEdit?: (id: string, title: string) => void
  color: string
  dragHandle?: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(item.title)
  const style = Q_STYLE[color]
  const isDone = item.status === 'completed'

  const handleSave = () => {
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== item.title && onEdit) onEdit(item.id, trimmed)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-1">
        <div className="w-4 h-4 flex-shrink-0" />
        <input
          autoFocus
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') { setEditTitle(item.title); setEditing(false) }
          }}
          onBlur={handleSave}
          className="flex-1 text-xs border border-gray-200 rounded px-2 py-0.5 outline-none bg-white focus:ring-1 focus:ring-blue-300"
        />
      </div>
    )
  }

  return (
    <div>
      <div className="group flex items-center gap-2 py-1 min-w-0">
        {dragHandle}
        <button
          onClick={onToggle}
          className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
            isDone ? `${style.dot.replace('bg-','bg-')} border-current` : 'border-gray-300 hover:border-current'
          }`}
          style={isDone ? { backgroundColor: 'currentColor' } : {}}
        >
          {isDone && <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
        </button>
        <button
          onClick={() => setExpanded(e => !e)}
          className={`flex-1 min-w-0 text-xs text-left break-words ${isDone ? 'line-through text-gray-400' : 'text-gray-700 hover:text-gray-900'}`}
        >
          {item.title}
          {!isDone && <span className="ml-1 text-gray-300">{expanded ? '▴' : '▾'}</span>}
        </button>
        {!isDone && onEdit && (
          <button
            onClick={() => { setEditTitle(item.title); setEditing(true) }}
            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-400 text-xs"
            title="수정"
          >✎</button>
        )}
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs">✕</button>
      </div>
      <SubTaskList itemId={item.id} visible={expanded && !isDone} />
    </div>
  )
}

// ─── 하루 행 ─────────────────────────────────────────────────
function DayRow({ date, dayItems, onAdd, onToggle, onDelete, onEdit, color, isToday }: {
  date: Date
  dayItems: PlanItem[]
  onAdd: (title: string, dayKey: string) => void
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onEdit?: (id: string, title: string) => void
  color: string
  isToday: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dayKey = toDayKey(date)
  const dayName = DAY_NAMES[(date.getDay() + 6) % 7]
  const style = Q_STYLE[color]
  const completedCount = dayItems.filter(i => i.status === 'completed').length

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `day:${dayKey}`, data: { dayKey } })

  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])

  const handleAdd = () => {
    const t = newTitle.trim()
    if (!t) return
    onAdd(t, dayKey)
    setNewTitle('')
    setAdding(false)
  }

  return (
    <div
      ref={setDropRef}
      className={`rounded-xl border p-3 transition-all ${
        isToday ? `${style.light} ${style.border}` : 'bg-white border-gray-100'
      } ${isOver ? 'ring-2 ring-blue-300 ring-offset-1' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold w-5 ${isToday ? style.text : 'text-gray-500'}`}>{dayName}</span>
          <span className={`text-xs ${isToday ? style.text : 'text-gray-400'}`}>
            {date.getMonth()+1}/{date.getDate()}
          </span>
          {isToday && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${style.light} ${style.text} font-medium`}>오늘</span>}
          {dayItems.length > 0 && (
            <span className="text-[10px] text-gray-400">{completedCount}/{dayItems.length}</span>
          )}
        </div>
        <button
          onClick={() => setAdding(true)}
          className={`text-xs ${style.text} hover:opacity-80`}
        >
          + 추가
        </button>
      </div>

      {/* 항목 목록 */}
      {dayItems.length > 0 && (
        <SortableContext items={dayItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-0.5">
            {dayItems.map(item => (
              <SortableRow key={item.id} id={item.id} data={{ type: 'day-item', dayKey }}>
                {(handle) => (
                  <DayItem
                    item={item}
                    onToggle={() => onToggle(item.id)}
                    onDelete={() => onDelete(item.id)}
                    onEdit={onEdit}
                    color={color}
                    dragHandle={handle}
                  />
                )}
              </SortableRow>
            ))}
          </div>
        </SortableContext>
      )}

      {/* 추가 폼 */}
      {adding && (
        <div className="flex gap-1.5 mt-2">
          <input
            ref={inputRef}
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
            placeholder="계획 입력..."
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
          <button onClick={handleAdd} className={`text-xs px-2.5 py-1.5 rounded-lg text-white ${style.dot}`}>추가</button>
          <button onClick={() => setAdding(false)} className="text-xs text-gray-400">취소</button>
        </div>
      )}

      {/* 빈 상태 */}
      {dayItems.length === 0 && !adding && (
        <p className="text-[10px] text-gray-300 pl-7">계획 없음</p>
      )}
    </div>
  )
}

// ─── 주간 뷰 (7일) ───────────────────────────────────────────
function WeekView({ weekKey, year, month, dailyItems, onAddDaily, onToggleDaily, onDeleteDaily, color }: {
  weekKey: string
  year: number
  month: number
  dailyItems: Record<string, PlanItem[]>
  onAddDaily: (title: string, dayKey: string) => void
  onToggleDaily: (id: string) => void
  onDeleteDaily: (id: string) => void
  color: string
}) {
  const wNum = parseInt(weekKey.split('-W')[1])
  const days = getWeekDays(year, wNum).map(k => new Date(k))
  const today = toDayKey(new Date())

  return (
    <div className="flex flex-col gap-2 mt-3">
      {days.map((date, i) => {
        const dayKey = toDayKey(date)
        const isInMonth = date.getMonth() + 1 === month
        if (!isInMonth) return null
        return (
          <DayRow
            key={dayKey}
            date={date}
            dayItems={dailyItems[dayKey] ?? []}
            onAdd={onAddDaily}
            onToggle={onToggleDaily}
            onDelete={onDeleteDaily}
            color={color}
            isToday={dayKey === today}
          />
        )
      })}
    </div>
  )
}

// ─── 월 섹션 ─────────────────────────────────────────────────
function MonthSection({ year, month, color, dailyItems, onAddDaily, onToggleDaily, onDeleteDaily }: {
  year: number
  month: number
  color: string
  dailyItems: Record<string, PlanItem[]>
  onAddDaily: (title: string, dayKey: string) => void
  onToggleDaily: (id: string) => void
  onDeleteDaily: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [activeWeek, setActiveWeek] = useState<string | null>(null)
  const weeks = getMonthWeeks(year, month)
  const style = Q_STYLE[color]

  // 이번 달 계획 수 집계
  const monthDays: string[] = []
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(year, month - 1, d)
    if (dt.getMonth() + 1 !== month) break
    monthDays.push(toDayKey(dt))
  }
  const monthTotal = monthDays.reduce((sum, k) => sum + (dailyItems[k]?.length ?? 0), 0)
  const monthDone = monthDays.reduce((sum, k) => sum + (dailyItems[k]?.filter(i => i.status === 'completed').length ?? 0), 0)

  useEffect(() => {
    if (open && !activeWeek && weeks.length > 0) {
      // 현재 월이라면 현재 주로, 아니면 첫 주로
      const currentWeekNum = Math.ceil((new Date().getMonth() + 1) / 3)
      setActiveWeek(weeks[0])
    }
  }, [open])

  return (
    <div className={`rounded-xl border transition-all ${open ? `${style.border} ${style.light}` : 'border-gray-200 bg-white'}`}>
      {/* 월 헤더 버튼 */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${open ? style.text : 'text-gray-700'}`}>{MONTH_NAMES[month]}</span>
          {monthTotal > 0 && (
            <span className="text-xs text-gray-400">{monthDone}/{monthTotal}</span>
          )}
        </div>
        <span className={`text-xs ${open ? style.text : 'text-gray-400'}`}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {/* 주차 탭 */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            {weeks.map(wk => {
              const wNum = parseInt(wk.split('-W')[1])
              const wDays = getWeekDays(year, wNum)
              const first = new Date(wDays[0])
              const last = new Date(wDays[6])
              return (
                <button
                  key={wk}
                  onClick={() => setActiveWeek(wk === activeWeek ? null : wk)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    activeWeek === wk
                      ? `${style.dot.replace('bg-', 'bg-')} text-white border-transparent`
                      : `bg-white ${style.tab} hover:${style.light}`
                  }`}
                  style={activeWeek === wk ? { backgroundColor: '' } : {}}
                >
                  <span className={activeWeek === wk ? 'text-white' : ''}>
                    {wNum}주 <span className="opacity-70">({first.getMonth()+1}/{first.getDate()}~{last.getMonth()+1}/{last.getDate()})</span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* 선택한 주의 일별 뷰 */}
          {activeWeek && (
            <WeekView
              weekKey={activeWeek}
              year={year}
              month={month}
              dailyItems={dailyItems}
              onAddDaily={onAddDaily}
              onToggleDaily={onToggleDaily}
              onDeleteDaily={onDeleteDaily}
              color={color}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── 분기 섹션 ───────────────────────────────────────────────
function QuarterSection({ qConfig, year, items, dailyItems, onAddQItem, onToggleQ, onDeleteQ, onLoadMonth }: {
  qConfig: typeof Q_CONFIG[number]
  year: number
  items: PlanItem[]
  dailyItems: Record<string, PlanItem[]>
  onAddQItem: (title: string, q: number) => void
  onToggleQ: (id: string) => void
  onDeleteQ: (id: string) => void
  onLoadMonth: (month: number) => void
}) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const addRef = useRef<HTMLInputElement>(null)
  const { q, months, color, label, range } = qConfig
  const style = Q_STYLE[color]
  const completedCount = items.filter(i => i.status === 'completed').length

  useEffect(() => { if (adding) addRef.current?.focus() }, [adding])

  const handleAdd = () => {
    const t = newTitle.trim()
    if (!t) return
    onAddQItem(t, q)
    setNewTitle('')
    setAdding(false)
  }

  return (
    <div className={`rounded-2xl border overflow-hidden ${style.border}`}>
      {/* 분기 헤더 */}
      <div className={`${style.light} px-5 py-4`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-base font-bold ${style.text}`}>{label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{range}</p>
          </div>
          {items.length > 0 && (
            <div className="text-right">
              <p className={`text-sm font-bold ${style.text}`}>{completedCount}/{items.length}</p>
              <p className="text-xs text-gray-400">목표 달성</p>
            </div>
          )}
        </div>

        {/* 진행률 바 */}
        {items.length > 0 && (
          <div className="mt-3 h-1.5 bg-white/60 rounded-full overflow-hidden">
            <div
              className={`h-full ${style.dot} rounded-full transition-all`}
              style={{ width: `${(completedCount / items.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* 분기 목표 목록 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500">분기 목표</p>
            <button onClick={() => setAdding(true)} className={`text-xs ${style.text} font-medium`}>+ 목표 추가</button>
          </div>

          {items.length === 0 && !adding && (
            <p className="text-xs text-gray-300 py-2">목표를 추가하세요</p>
          )}

          <div className="space-y-1.5">
            {items.map(item => {
              const isDone = item.status === 'completed'
              return (
                <div key={item.id} className="group flex items-center gap-2.5 py-1">
                  <button
                    onClick={() => onToggleQ(item.id)}
                    className={`w-4.5 h-4.5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all`}
                    style={{
                      width: 18, height: 18,
                      backgroundColor: isDone ? 'currentColor' : '',
                      borderColor: isDone ? '' : '#d1d5db',
                    }}
                  >
                    {isDone && <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                  </button>
                  <span className={`flex-1 text-sm ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item.title}</span>
                  <button onClick={() => onDeleteQ(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs">✕</button>
                </div>
              )
            })}
          </div>

          {adding && (
            <div className="flex gap-1.5 mt-2">
              <input
                ref={addRef}
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
                placeholder="목표 입력..."
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button onClick={handleAdd} className={`text-sm px-3 py-2 rounded-lg text-white ${style.dot}`}>추가</button>
              <button onClick={() => setAdding(false)} className="text-sm text-gray-400">취소</button>
            </div>
          )}
        </div>

        {/* 구분선 */}
        <div className={`border-t ${style.border}`} />

        {/* 월별 섹션 */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-3">월별 계획</p>
          <div className="space-y-2">
            {months.map(m => (
              <MonthSection
                key={m}
                year={year}
                month={m}
                color={color}
                dailyItems={dailyItems}
                onAddDaily={async (title, dayKey) => {
                  onLoadMonth(m) // ensure loaded
                }}
                onToggleDaily={() => {}}
                onDeleteDaily={() => {}}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────────────
export default function AnnualPage() {
  const [year, setYear] = useState(getCurrentYear())
  const [activeQ, setActiveQ] = useState(getCurrentQuarter())
  const [qItems, setQItems] = useState<Record<number, PlanItem[]>>({ 0: [], 1: [], 2: [], 3: [], 4: [] })
  const [dailyItems, setDailyItems] = useState<Record<string, PlanItem[]>>({})
  const [loadedMonths, setLoadedMonths] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [itemWeekMap, setItemWeekMap] = useState<Record<string, string[]>>({})

  // 분기 목표 로드
  const loadQItems = useCallback(async () => {
    setLoading(true)
    const [routine, ...quarterly] = await Promise.all([
      getPlanItems('quarterly', `${year}-routine`),
      ...([1, 2, 3, 4].map(q => getPlanItems('quarterly', `${year}-Q${q}`))),
    ])
    setQItems({ 0: routine, 1: quarterly[0], 2: quarterly[1], 3: quarterly[2], 4: quarterly[3] })
    setLoading(false)
  }, [year])

  useEffect(() => { loadQItems() }, [loadQItems])

  // 분기 목표 → 주차 매핑 로드
  useEffect(() => {
    const allIds = Object.values(qItems).flat().map(i => i.id)
    if (allIds.length === 0) return
    getMappingsForItems(allIds).then(mappings => {
      const map: Record<string, string[]> = {}
      mappings.forEach(m => {
        if (!map[m.parent_item_id]) map[m.parent_item_id] = []
        map[m.parent_item_id] = [...map[m.parent_item_id], m.child_period_key]
      })
      setItemWeekMap(map)
    })
  }, [qItems])

  // 월별 일일 계획 lazy 로드
  const loadMonth = useCallback(async (month: number) => {
    const key = `${year}-${month}`
    if (loadedMonths.has(key)) return
    const items = await getDailyItemsForMonth(year, month)
    setLoadedMonths(prev => new Set([...prev, key]))
    setDailyItems(prev => {
      const next = { ...prev }
      items.forEach(item => {
        if (!next[item.period_key]) next[item.period_key] = []
        const exists = next[item.period_key].find(i => i.id === item.id)
        if (!exists) next[item.period_key] = [...(next[item.period_key] || []), item]
      })
      // 해당 월 날짜들 초기화 (항목 없는 날도)
      const pad = (n: number) => String(n).padStart(2, '0')
      for (let d = 1; d <= 31; d++) {
        const dt = new Date(year, month - 1, d)
        if (dt.getMonth() + 1 !== month) break
        const dk = `${year}-${pad(month)}-${pad(d)}`
        if (!next[dk]) next[dk] = []
      }
      return next
    })
  }, [year, loadedMonths])

  // 현재 분기 월들 자동 로드
  useEffect(() => {
    const cfg = Q_CONFIG.find(c => c.q === activeQ)
    if (cfg) cfg.months.forEach(m => loadMonth(m))
  }, [activeQ, year])

  // 분기 목표 추가
  const handleAddQItem = async (title: string, q: number) => {
    const periodKey = q === 0 ? `${year}-routine` : `${year}-Q${q}`
    const item = await createPlanItem({
      title, level: 'quarterly',
      period_key: periodKey,
      description: null, categories: [], status: 'pending', priority: 'medium',
      sort_order: qItems[q]?.length ?? 0,
    })
    setQItems(prev => ({ ...prev, [q]: [...(prev[q] ?? []), item] }))
  }

  // 분기 목표 토글
  const handleToggleQ = async (id: string) => {
    for (const q of [1, 2, 3, 4]) {
      const item = qItems[q].find(i => i.id === id)
      if (item) {
        const newStatus = item.status === 'completed' ? 'pending' : 'completed'
        const updated = await updatePlanItem(id, { status: newStatus })
        setQItems(prev => ({ ...prev, [q]: prev[q].map(i => i.id === id ? updated : i) }))
        return
      }
    }
  }

  // 분기 목표 삭제
  const handleDeleteQ = async (id: string) => {
    await deletePlanItem(id)
    setQItems(prev => {
      const next = { ...prev }
      for (const q of [1, 2, 3, 4]) {
        next[q] = prev[q].filter(i => i.id !== id)
      }
      return next
    })
  }

  // 분기 목표 → 월 배정 (다중)
  const handleAssignToMonth = async (itemId: string, newMonthKeys: string[]) => {
    const currentMonths = (itemWeekMap[itemId] ?? []).filter(k => /^\d{4}-\d{2}$/.test(k))
    // 제거된 월 삭제
    for (const mk of currentMonths) {
      if (!newMonthKeys.includes(mk)) await deleteMapping(itemId, mk).catch(() => {})
    }
    // 새로 추가된 월 생성
    for (const mk of newMonthKeys) {
      if (!currentMonths.includes(mk)) await createMapping(itemId, mk).catch(() => {})
    }
    // 해당 월들 로드
    newMonthKeys.forEach(mk => {
      const m = parseInt(mk.split('-')[1])
      loadMonth(m)
    })
    setItemWeekMap(prev => ({ ...prev, [itemId]: newMonthKeys }))
  }

  // 월 대기에서 삭제 (배정 취소)
  const handleUnassignMonth = async (itemId: string, monthKey: string) => {
    await deleteMapping(itemId, monthKey).catch(() => {})
    setItemWeekMap(prev => ({
      ...prev,
      [itemId]: (prev[itemId] ?? []).filter(k => k !== monthKey),
    }))
  }

  // 대기 항목 → 특정 요일들에 배정 (세부계획도 복사)
  const handleAssignToDay = async (itemId: string, dayKeys: string[]) => {
    const item = Object.values(qItems).flat().find(i => i.id === itemId)
    if (!item) return
    const tasks = await getTasksForItem(itemId)
    for (const dayKey of dayKeys) {
      const existing = dailyItems[dayKey] ?? []
      const dailyItem = await createPlanItem({
        title: item.title, level: 'daily', period_key: dayKey,
        description: null, categories: [], status: 'pending', priority: 'medium',
        sort_order: existing.length,
      })
      setDailyItems(prev => ({ ...prev, [dayKey]: [...(prev[dayKey] ?? []), dailyItem] }))
      if (tasks.length > 0) {
        await Promise.all(tasks.map((t, i) => createTask(dailyItem.id, t.title, i)))
      }
    }
  }

  // 세부 항목 → 특정 요일들에 별도 항목으로 추가
  const handleAssignTaskToDay = async (taskTitle: string, _parentItemId: string, dayKeys: string[]) => {
    for (const dayKey of dayKeys) {
      const existing = dailyItems[dayKey] ?? []
      const dailyItem = await createPlanItem({
        title: taskTitle, level: 'daily', period_key: dayKey,
        description: null, categories: [], status: 'pending', priority: 'medium',
        sort_order: existing.length,
      })
      setDailyItems(prev => ({ ...prev, [dayKey]: [...(prev[dayKey] ?? []), dailyItem] }))
    }
  }

  // 일일 계획 추가
  const handleAddDaily = async (title: string, dayKey: string) => {
    const existing = dailyItems[dayKey] ?? []
    const item = await createPlanItem({
      title, level: 'daily', period_key: dayKey,
      description: null, categories: [], status: 'pending', priority: 'medium',
      sort_order: existing.length,
    })
    setDailyItems(prev => ({ ...prev, [dayKey]: [...(prev[dayKey] ?? []), item] }))
  }

  // 일일 계획 토글
  const handleToggleDaily = async (id: string) => {
    // 전체 dailyItems에서 찾기
    for (const [dayKey, items] of Object.entries(dailyItems)) {
      const item = items.find(i => i.id === id)
      if (item) {
        const newStatus = item.status === 'completed' ? 'pending' : 'completed'
        const updated = await updatePlanItem(id, { status: newStatus })
        setDailyItems(prev => ({ ...prev, [dayKey]: prev[dayKey].map(i => i.id === id ? updated : i) }))
        return
      }
    }
  }

  // 일일 계획 수정
  const handleUpdateDaily = async (id: string, title: string) => {
    const updated = await updatePlanItem(id, { title })
    setDailyItems(prev => {
      const next: Record<string, PlanItem[]> = {}
      for (const [k, v] of Object.entries(prev)) {
        next[k] = v.map(i => i.id === id ? updated : i)
      }
      return next
    })
  }

  // 일일 계획 삭제
  const handleDeleteDaily = async (id: string) => {
    await deletePlanItem(id)
    setDailyItems(prev => {
      const next: Record<string, PlanItem[]> = {}
      for (const [k, v] of Object.entries(prev)) {
        next[k] = v.filter(i => i.id !== id)
      }
      return next
    })
  }

  // 분기 목표 이름 변경
  const handleRenameQ = async (id: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    const updated = await updatePlanItem(id, { title: trimmed })
    setQItems(prev => {
      const next = { ...prev }
      for (const q of [0, 1, 2, 3, 4] as const) {
        next[q] = prev[q].map(i => i.id === id ? updated : i)
      }
      return next
    })
  }

  // 일일 항목 다른 날로 이동
  const handleMoveDaily = async (itemId: string, fromDay: string, toDay: string) => {
    const updated = await updatePlanItem(itemId, { period_key: toDay })
    setDailyItems(prev => ({
      ...prev,
      [fromDay]: (prev[fromDay] ?? []).filter(i => i.id !== itemId),
      [toDay]: [...(prev[toDay] ?? []), updated],
    }))
  }

  // 분기 목표 순서 변경
  const handleReorderQ = async (q: number, newItems: PlanItem[]) => {
    setQItems(prev => ({ ...prev, [q]: newItems }))
    await Promise.all(newItems.map((item, idx) => updatePlanItem(item.id, { sort_order: idx })))
  }

  // 일별 항목 순서 변경
  const handleReorderDaily = async (dayKey: string, newItems: PlanItem[]) => {
    setDailyItems(prev => ({ ...prev, [dayKey]: newItems }))
    await Promise.all(newItems.map((item, idx) => updatePlanItem(item.id, { sort_order: idx })))
  }

  return (
    <div className="max-w-4xl mx-auto w-full overflow-x-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">연간 계획</h1>
          <p className="hidden md:block text-gray-500 mt-1">분기 · 월 · 주 · 일 계획 통합 관리</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setYear(y => y - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">◀</button>
          <span className="font-bold text-gray-900 w-14 text-center text-sm md:text-base">{year}년</span>
          <button onClick={() => setYear(y => y + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">▶</button>
        </div>
      </div>

      {/* 10년 목표 연동 */}
      <AnnualSection year={year} />

      {/* 분기 + 순기 탭 */}
      <div className="grid grid-cols-5 gap-1 md:gap-2 mb-4 md:mb-6">
        {Q_CONFIG.map(cfg => {
          const style = Q_STYLE[cfg.color]
          const isActive = activeQ === cfg.q
          const qTotal = qItems[cfg.q]?.length ?? 0
          const qDone = qItems[cfg.q]?.filter(i => i.status === 'completed').length ?? 0
          return (
            <button
              key={cfg.q}
              onClick={() => setActiveQ(cfg.q)}
              className={`rounded-xl border-2 p-2 md:p-3 text-left transition-all ${
                isActive ? `${style.active}` : `bg-white ${style.tab} hover:${style.light}`
              }`}
            >
              <p className={`text-xs md:text-sm font-bold ${isActive ? 'text-white' : style.text}`}>{cfg.label}</p>
              <p className={`hidden md:block text-xs mt-0.5 ${isActive ? 'text-white/70' : 'text-gray-400'}`}>{cfg.range}</p>
              {qTotal > 0 && (
                <p className={`text-[10px] md:text-xs mt-0.5 md:mt-1 font-medium ${isActive ? 'text-white/80' : style.text}`}>{qDone}/{qTotal}</p>
              )}
            </button>
          )
        })}
        {/* 순기업무 탭 */}
        {(() => {
          const style = Q_STYLE[ROUTINE_CONFIG.color]
          const isActive = activeQ === 0
          const rTotal = qItems[0]?.length ?? 0
          const rDone = qItems[0]?.filter(i => i.status === 'completed').length ?? 0
          return (
            <button
              onClick={() => setActiveQ(0)}
              className={`rounded-xl border-2 p-2 md:p-3 text-left transition-all ${
                isActive ? `${style.active}` : `bg-white ${style.tab} hover:${style.light}`
              }`}
            >
              <p className={`text-xs md:text-sm font-bold ${isActive ? 'text-white' : style.text}`}>순기</p>
              <p className={`hidden md:block text-xs mt-0.5 ${isActive ? 'text-white/70' : 'text-gray-400'}`}>반복업무</p>
              {rTotal > 0 && (
                <p className={`text-[10px] md:text-xs mt-0.5 md:mt-1 font-medium ${isActive ? 'text-white/80' : style.text}`}>{rDone}/{rTotal}</p>
              )}
            </button>
          )
        })()}
      </div>

      {/* 선택된 섹션 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : (
        <QuarterSectionFull
          qConfig={activeQ === 0 ? ROUTINE_CONFIG : Q_CONFIG.find(c => c.q === activeQ)!}
          year={year}
          items={qItems[activeQ] ?? []}
          dailyItems={dailyItems}
          onAddQItem={handleAddQItem}
          onToggleQ={handleToggleQ}
          onDeleteQ={handleDeleteQ}
          onAddDaily={handleAddDaily}
          onToggleDaily={handleToggleDaily}
          onDeleteDaily={handleDeleteDaily}
          onEditDaily={handleUpdateDaily}
          onRequestLoadMonth={loadMonth}
          itemWeekMap={itemWeekMap}
          onAssignToMonth={handleAssignToMonth}
          onAssignToDay={handleAssignToDay}
          onAssignTaskToDay={handleAssignTaskToDay}
          onUnassignMonth={handleUnassignMonth}
          onRenameQ={handleRenameQ}
          onReorderQ={(newItems) => handleReorderQ(activeQ, newItems)}
          onReorderDaily={handleReorderDaily}
          onMoveDaily={handleMoveDaily}
        />
      )}
    </div>
  )
}

// ─── 분기 전체 뷰 (월 포함) ──────────────────────────────────
function QuarterSectionFull({ qConfig, year, items, dailyItems, onAddQItem, onToggleQ, onDeleteQ, onAddDaily, onToggleDaily, onDeleteDaily, onEditDaily, onRequestLoadMonth, itemWeekMap, onAssignToMonth, onAssignToDay, onAssignTaskToDay, onUnassignMonth, onRenameQ, onReorderQ, onReorderDaily, onMoveDaily }: {
  qConfig: typeof Q_CONFIG[number]
  year: number
  items: PlanItem[]
  dailyItems: Record<string, PlanItem[]>
  onAddQItem: (title: string, q: number) => void
  onToggleQ: (id: string) => void
  onDeleteQ: (id: string) => void
  onAddDaily: (title: string, dayKey: string) => void
  onToggleDaily: (id: string) => void
  onDeleteDaily: (id: string) => void
  onEditDaily: (id: string, title: string) => void
  onRequestLoadMonth: (month: number) => void
  itemWeekMap: Record<string, string[]>
  onAssignToMonth: (itemId: string, monthKeys: string[]) => void
  onAssignToDay: (itemId: string, dayKeys: string[]) => void
  onAssignTaskToDay: (taskTitle: string, parentItemId: string, dayKeys: string[]) => void
  onUnassignMonth: (itemId: string, monthKey: string) => void
  onRenameQ: (id: string, title: string) => void
  onReorderQ: (newItems: PlanItem[]) => void
  onReorderDaily: (dayKey: string, newItems: PlanItem[]) => void
  onMoveDaily: (itemId: string, fromDay: string, toDay: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [pickingItemId, setPickingItemId] = useState<string | null>(null)
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [expandedQItems, setExpandedQItems] = useState<Set<string>>(new Set())
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [editGoalTitle, setEditGoalTitle] = useState('')
  const addRef = useRef<HTMLInputElement>(null)
  const { q, months, color } = qConfig
  const style = Q_STYLE[color]
  const completedCount = items.filter(i => i.status === 'completed').length

  const qSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  const handleGoalDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex(i => i.id === active.id)
    const newIdx = items.findIndex(i => i.id === over.id)
    onReorderQ(arrayMove(items, oldIdx, newIdx))
  }

  useEffect(() => { if (adding) addRef.current?.focus() }, [adding])

  const handleAdd = () => {
    const t = newTitle.trim()
    if (!t) return
    onAddQItem(t, q)
    setNewTitle('')
    setAdding(false)
  }

  return (
    <div className={`rounded-2xl border ${style.border}`}>
      {/* 분기 헤더 */}
      <div className={`${style.light} px-5 py-4`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className={`text-base font-bold ${style.text}`}>{qConfig.label} 목표</p>
            <p className="text-xs text-gray-500">{qConfig.range}</p>
          </div>
          <button onClick={() => setAdding(true)} className={`text-xs px-3 py-1.5 rounded-lg ${style.dot} text-white font-medium`}>
            + 목표 추가
          </button>
        </div>

        {/* 목표 목록 */}
        {items.length === 0 && !adding ? (
          <p className="text-sm text-gray-400">분기 목표를 추가하세요</p>
        ) : (
          <DndContext sensors={qSensors} collisionDetection={closestCenter} onDragEnd={handleGoalDragEnd}>
            <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {items.map(item => {
                  const isDone = item.status === 'completed'
                  const assignedMonths = (itemWeekMap[item.id] ?? []).filter(k => /^\d{4}-\d{2}$/.test(k))
                  const isAssigned = assignedMonths.length > 0
                  const isExpanded = expandedQItems.has(item.id)
                  return (
                    <SortableRow key={item.id} id={item.id}>
                      {(dragHandle) => (
                        <div className={`group rounded-xl transition-colors ${
                          isAssigned ? 'bg-gray-100' : 'bg-white/70'
                        }`}>
                          {/* 메인 행 */}
                          <div className="flex items-center gap-2 px-3 py-2.5 min-w-0">
                            {dragHandle}
                            {/* 완료 체크버튼 */}
                            <button
                              onClick={() => onToggleQ(item.id)}
                              className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                                isDone ? `${style.dot} border-transparent` : 'border-gray-300 hover:border-gray-500'
                              }`}
                            >
                              {isDone && <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>}
                            </button>

                            {/* 제목 — edit 지원 */}
                            {editingGoalId === item.id ? (
                              <input
                                autoFocus
                                value={editGoalTitle}
                                onChange={e => setEditGoalTitle(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { onRenameQ(item.id, editGoalTitle); setEditingGoalId(null) }
                                  if (e.key === 'Escape') setEditingGoalId(null)
                                }}
                                onBlur={() => { onRenameQ(item.id, editGoalTitle); setEditingGoalId(null) }}
                                className="flex-1 min-w-0 text-sm font-medium border border-gray-200 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-blue-300 bg-white"
                              />
                            ) : (
                              <span className={`flex-1 min-w-0 text-sm font-medium truncate ${isDone ? 'line-through text-gray-400' : isAssigned ? 'text-gray-600' : 'text-gray-800'}`}>
                                {item.title}
                              </span>
                            )}
                            {!isDone && editingGoalId !== item.id && (
                              <button
                                onClick={() => { setEditingGoalId(item.id); setEditGoalTitle(item.title) }}
                                className="text-gray-300 hover:text-blue-400 text-xs flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="수정"
                              >✎</button>
                            )}

                            {/* 우측 고정 영역 */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {/* 월 배정 뱃지 */}
                              {assignedMonths.length > 0 && (
                                <span className={`text-[10px] ${style.text} ${style.light} px-1.5 py-0.5 rounded-full whitespace-nowrap`}>
                                  {assignedMonths.map(mk => `${parseInt(mk.split('-')[1])}월`).join(', ')}
                                </span>
                              )}

                              {/* 세부계획 토글 */}
                              <button
                                onClick={() => setExpandedQItems(prev => {
                                  const next = new Set(prev)
                                  next.has(item.id) ? next.delete(item.id) : next.add(item.id)
                                  return next
                                })}
                                className={`text-[10px] px-2 py-1 rounded-lg border flex-shrink-0 transition-all ${
                                  isExpanded ? `${style.dot} text-white border-transparent` : `bg-white/80 ${style.tab} hover:opacity-80`
                                }`}
                              >{isExpanded ? '접기' : '세부'}</button>

                              {/* 주차 배정 버튼 */}
                              {!isDone && (
                                <div className="relative">
                                  <button
                                    onClick={() => {
                                      if (pickingItemId === item.id) { setPickingItemId(null) }
                                      else { setPickingItemId(item.id); setSelectedMonths(assignedMonths) }
                                    }}
                                    className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${
                                      pickingItemId === item.id
                                        ? `${style.dot} text-white border-transparent`
                                        : `bg-white/80 ${style.tab} hover:opacity-80`
                                    }`}
                                  >📅</button>

                                  {pickingItemId === item.id && (
                                    <div className="absolute right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 p-3 w-40 max-w-[calc(100vw-2rem)]">
                                      <p className="text-xs font-semibold text-gray-600 mb-2">월 배정 (복수 선택)</p>
                                      <div className="space-y-1.5 mb-3">
                                        {months.map(m => {
                                          const mk = `${year}-${String(m).padStart(2, '0')}`
                                          const checked = selectedMonths.includes(mk)
                                          return (
                                            <label key={mk} className="flex items-center gap-2 cursor-pointer px-1 py-1 rounded-lg hover:bg-gray-50">
                                              <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => setSelectedMonths(prev =>
                                                  prev.includes(mk) ? prev.filter(k => k !== mk) : [...prev, mk]
                                                )}
                                                className="w-3.5 h-3.5 rounded accent-current flex-shrink-0"
                                              />
                                              <span className="text-xs text-gray-700">{m}월</span>
                                            </label>
                                          )
                                        })}
                                      </div>
                                      <div className="flex gap-1.5">
                                        <button
                                          onClick={() => { onAssignToMonth(item.id, selectedMonths); setPickingItemId(null) }}
                                          className={`flex-1 text-xs py-1.5 rounded-lg text-white ${style.dot}`}
                                        >적용</button>
                                        <button onClick={() => setPickingItemId(null)} className="text-xs text-gray-400 px-2">취소</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* 삭제 버튼 */}
                              <button onClick={() => onDeleteQ(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-sm">✕</button>
                            </div>
                          </div>

                          {/* 세부계획 패널 */}
                          {isExpanded && (
                            <div className="px-3 pb-3">
                              <SubTaskList itemId={item.id} visible={true} />
                            </div>
                          )}
                        </div>
                      )}
                    </SortableRow>
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {adding && (
          <div className="flex gap-2 mt-3">
            <input
              ref={addRef}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
              placeholder="분기 목표 입력..."
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            />
            <button onClick={handleAdd} className={`text-sm px-4 py-2 rounded-xl text-white ${style.dot}`}>추가</button>
            <button onClick={() => setAdding(false)} className="text-sm text-gray-400 px-2">취소</button>
          </div>
        )}
      </div>

      {/* 월별 섹션 */}
      <div className="px-5 py-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">월별 계획</p>
        <div className="space-y-3">
          {months.map(m => (
            <MonthSectionFull
              key={m}
              year={year}
              month={m}
              color={color}
              dailyItems={dailyItems}
              onAddDaily={onAddDaily}
              onToggleDaily={onToggleDaily}
              onDeleteDaily={onDeleteDaily}
              onEditDaily={onEditDaily}
              onOpen={() => onRequestLoadMonth(m)}
              qItems={items}
              itemWeekMap={itemWeekMap}
              onAssignToDay={onAssignToDay}
              onAssignTaskToDay={onAssignTaskToDay}
              onUnassignMonth={onUnassignMonth}
              onReorderDaily={onReorderDaily}
              onMoveDaily={onMoveDaily}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 월 섹션 (전체) ──────────────────────────────────────────
function MonthSectionFull({ year, month, color, dailyItems, onAddDaily, onToggleDaily, onDeleteDaily, onEditDaily, onOpen, qItems, itemWeekMap, onAssignToDay, onAssignTaskToDay, onUnassignMonth, onReorderDaily, onMoveDaily }: {
  year: number
  month: number
  color: string
  dailyItems: Record<string, PlanItem[]>
  onAddDaily: (title: string, dayKey: string) => void
  onToggleDaily: (id: string) => void
  onDeleteDaily: (id: string) => void
  onEditDaily: (id: string, title: string) => void
  onOpen: () => void
  qItems: PlanItem[]
  itemWeekMap: Record<string, string[]>
  onAssignToDay: (itemId: string, dayKeys: string[]) => void
  onAssignTaskToDay: (taskTitle: string, parentItemId: string, dayKeys: string[]) => void
  onUnassignMonth: (itemId: string, monthKey: string) => void
  onReorderDaily: (dayKey: string, newItems: PlanItem[]) => void
  onMoveDaily: (itemId: string, fromDay: string, toDay: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [activeWeek, setActiveWeek] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const style = Q_STYLE[color]
  const weeks = getMonthWeeks(year, month)

  const globalSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  const findDayForItem = (itemId: string): string | null => {
    for (const [dk, items] of Object.entries(dailyItems)) {
      if (items.some(i => i.id === itemId)) return dk
    }
    return null
  }

  const handleGlobalDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Waiting item dropped on a day or day item
    if (activeId.startsWith('w:')) {
      const waitingItemId = activeId.slice(2)
      let targetDayKey: string | null = null
      if (overId.startsWith('day:')) {
        targetDayKey = overId.slice(4)
      } else {
        targetDayKey = findDayForItem(overId)
      }
      if (targetDayKey) {
        onAssignToDay(waitingItemId, [targetDayKey])
      }
      return
    }

    // Day item drag
    const fromDayKey = (active.data.current?.dayKey as string | undefined) ?? findDayForItem(activeId)
    if (!fromDayKey) return

    let toDayKey: string | null = null
    if (overId.startsWith('day:')) {
      toDayKey = overId.slice(4)
    } else {
      toDayKey = (over.data.current?.dayKey as string | undefined) ?? findDayForItem(overId)
    }
    if (!toDayKey) return

    if (fromDayKey === toDayKey) {
      // Same day reorder
      const items = [...(dailyItems[fromDayKey] ?? [])]
      const oldIdx = items.findIndex(i => i.id === activeId)
      const newIdx = items.findIndex(i => i.id === overId)
      if (oldIdx !== -1 && newIdx !== -1) {
        onReorderDaily(fromDayKey, arrayMove(items, oldIdx, newIdx))
      }
    } else {
      // Cross-day move
      onMoveDaily(activeId, fromDayKey, toDayKey)
    }
  }

  // 이번 달 통계
  const pad = (n: number) => String(n).padStart(2, '0')
  let monthTotal = 0, monthDone = 0
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(year, month - 1, d)
    if (dt.getMonth() + 1 !== month) break
    const dk = `${year}-${pad(month)}-${pad(d)}`
    monthTotal += dailyItems[dk]?.length ?? 0
    monthDone += dailyItems[dk]?.filter(i => i.status === 'completed').length ?? 0
  }

  const handleOpen = () => {
    const next = !open
    setOpen(next)
    if (next) {
      onOpen()
      if (weeks.length > 0 && !activeWeek) setActiveWeek(weeks[0])
    }
  }

  return (
    <div className={`rounded-xl border transition-all ${open ? `${style.border}` : 'border-gray-200'}`}>
      <button onClick={handleOpen} className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${open ? style.text : 'text-gray-700'}`}>{MONTH_NAMES[month]}</span>
          {monthTotal > 0 && (
            <span className={`text-xs ${open ? style.text : 'text-gray-400'}`}>{monthDone}/{monthTotal} 완료</span>
          )}
        </div>
        <span className={`text-xs ${open ? style.text : 'text-gray-400'}`}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <DndContext
          sensors={globalSensors}
          collisionDetection={closestCenter}
          onDragStart={(event: DragStartEvent) => setActiveDragId(event.active.id as string)}
          onDragEnd={handleGlobalDragEnd}
          onDragCancel={() => setActiveDragId(null)}
        >
          <div className={`px-4 pb-4 ${open ? style.light : ''}`}>
            {/* 분기목표 대기 섹션 (주차 무관, 항상 표시) */}
            <MonthWaitingSection
              monthKey={`${year}-${String(month).padStart(2, '0')}`}
              activeWeekKey={activeWeek}
              qItems={qItems}
              itemWeekMap={itemWeekMap}
              color={color}
              year={year}
              month={month}
              onUnassign={onUnassignMonth}
              onAssignToDay={onAssignToDay}
              onAssignTaskToDay={onAssignTaskToDay}
            />

            {/* 주차 탭 */}
            <div className="flex gap-1.5 flex-wrap mb-3">
              {weeks.map(wk => {
                const wNum = parseInt(wk.split('-W')[1])
                const wDays = getWeekDays(year, wNum)
                const first = new Date(wDays[0])
                const last = new Date(wDays[6])
                const isActive = activeWeek === wk
                return (
                  <button
                    key={wk}
                    onClick={() => setActiveWeek(isActive ? null : wk)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
                      isActive ? `${style.dot} text-white border-transparent` : `bg-white ${style.tab}`
                    }`}
                  >
                    {wNum}주차
                    <span className={`ml-1 text-[10px] ${isActive ? 'text-white/70' : 'text-gray-400'}`}>
                      {first.getMonth()+1}/{first.getDate()}~{last.getMonth()+1}/{last.getDate()}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* 선택된 주차의 요일별 뷰 */}
            {activeWeek && (
              <div className="flex flex-col gap-2">
                {getWeekDays(year, parseInt(activeWeek.split('-W')[1])).map(dayKey => {
                  const date = new Date(dayKey)
                  const today = toDayKey(new Date())
                  return (
                    <DayRow
                      key={dayKey}
                      date={date}
                      dayItems={dailyItems[dayKey] ?? []}
                      onAdd={onAddDaily}
                      onToggle={onToggleDaily}
                      onDelete={onDeleteDaily}
                      onEdit={onEditDaily}
                      color={color}
                      isToday={dayKey === today}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </DndContext>
      )}
    </div>
  )
}
