'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, X, Trash2, Plus, Loader2 } from 'lucide-react'
import { getDailyItemsForMonth, createPlanItem, deletePlanItem, updatePlanItem } from '@/lib/api'
import type { PlanItem, PlanStatus } from '@/lib/types'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

const STATUS_COLOR: Record<PlanStatus, string> = {
  pending:     '#d1d5db',
  in_progress: '#3b82f6',
  completed:   '#22c55e',
  on_hold:     '#f59e0b',
}

const STATUS_LABEL: Record<PlanStatus, string> = {
  pending:     '미시작',
  in_progress: '진행중',
  completed:   '완료',
  on_hold:     '보류',
}

const STATUS_CYCLE: PlanStatus[] = ['pending', 'in_progress', 'completed', 'on_hold']

function pad(n: number) { return String(n).padStart(2, '0') }

export function DashboardCalendar() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [items, setItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  // 추가
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 삭제/상태변경
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setSelectedDay(null)
    setNewTitle('')
    getDailyItemsForMonth(year, month)
      .then(setItems)
      .finally(() => setLoading(false))
  }, [year, month])

  // 날짜 선택 시 입력창 포커스
  useEffect(() => {
    if (selectedDay !== null) {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [selectedDay])

  // 날짜별 그룹핑 (items state에서 매번 derive)
  const itemsByDay: Record<number, PlanItem[]> = {}
  for (const item of items) {
    const day = parseInt(item.period_key.split('-')[2], 10)
    if (!itemsByDay[day]) itemsByDay[day] = []
    itemsByDay[day].push(item)
  }

  const firstDow = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }
  const goToday = () => {
    setYear(today.getFullYear())
    setMonth(today.getMonth() + 1)
    setSelectedDay(today.getDate())
  }

  // ─── 일정 추가 ───────────────────────────────────────
  const handleAdd = async () => {
    if (!newTitle.trim() || selectedDay === null || adding) return
    const periodKey = `${year}-${pad(month)}-${pad(selectedDay)}`
    const maxOrder = (itemsByDay[selectedDay] ?? []).reduce((m, i) => Math.max(m, i.sort_order), 0)

    setAdding(true)
    try {
      const created = await createPlanItem({
        level: 'daily',
        period_key: periodKey,
        title: newTitle.trim(),
        description: null,
        categories: [],
        status: 'pending',
        priority: 'medium',
        sort_order: maxOrder + 1,
      })
      setItems(prev => [...prev, created])
      setNewTitle('')
      inputRef.current?.focus()
    } finally {
      setAdding(false)
    }
  }

  // ─── 일정 삭제 ───────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deletePlanItem(id)
      setItems(prev => prev.filter(i => i.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  // ─── 상태 순환 ───────────────────────────────────────
  const handleToggleStatus = async (item: PlanItem) => {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(item.status) + 1) % STATUS_CYCLE.length]
    setTogglingId(item.id)
    try {
      const updated = await updatePlanItem(item.id, { status: next })
      setItems(prev => prev.map(i => i.id === item.id ? updated : i))
    } finally {
      setTogglingId(null)
    }
  }

  const selectedItems = selectedDay !== null ? (itemsByDay[selectedDay] ?? []) : []

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600">
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 text-sm">{year}년 {month}월</span>
          {!isCurrentMonth && (
            <button
              onClick={goToday}
              className="text-xs text-blue-600 hover:text-blue-700 px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              오늘
            </button>
          )}
        </div>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="p-3">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-1.5">
          {DAY_LABELS.map((d, i) => (
            <div
              key={d}
              className={`text-center text-xs font-semibold py-1 ${
                i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        {loading ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-400">불러오는 중...</div>
        ) : (
          <div className="grid grid-cols-7 gap-y-0.5">
            {Array.from({ length: firstDow }, (_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const dow = (firstDow + i) % 7
              const dayItems = itemsByDay[day] ?? []
              const total = dayItems.length
              const done = dayItems.filter(x => x.status === 'completed').length
              const isToday = isCurrentMonth && day === today.getDate()
              const isSelected = selectedDay === day

              return (
                <button
                  key={day}
                  onClick={() => {
                    setSelectedDay(isSelected ? null : day)
                    setNewTitle('')
                  }}
                  className={`
                    relative flex flex-col items-center pt-1 pb-1.5 rounded-xl transition-all min-h-[52px]
                    ${isSelected ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-gray-50'}
                  `}
                >
                  <span className={`
                    text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium mb-0.5
                    ${isToday ? 'bg-blue-600 text-white' : dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-800'}
                  `}>
                    {day}
                  </span>
                  {total > 0 && (
                    <>
                      <div className="flex gap-0.5 flex-wrap justify-center max-w-7">
                        {dayItems.slice(0, 3).map((item, idx) => (
                          <span
                            key={idx}
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: STATUS_COLOR[item.status] ?? '#d1d5db' }}
                          />
                        ))}
                        {total > 3 && <span className="text-[8px] text-gray-400 leading-none mt-0.5">+{total - 3}</span>}
                      </div>
                      <span className="text-[9px] text-gray-400 mt-0.5 leading-none">{done}/{total}</span>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* 범례 */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 flex-wrap">
          {(Object.entries(STATUS_COLOR) as [PlanStatus, string][]).map(([key, color]) => (
            <div key={key} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-400">{STATUS_LABEL[key]}</span>
            </div>
          ))}
          <span className="text-xs text-gray-300 ml-auto">상태 점 클릭으로 변경</span>
        </div>
      </div>

      {/* 날짜 선택 — 인라인 패널 */}
      {selectedDay !== null && (
        <div className="border-t border-gray-200 bg-gray-50">
          {/* 패널 헤더 */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">
                {month}월 {selectedDay}일
              </span>
              <span className="text-xs text-gray-400">
                {selectedItems.length > 0 ? `${selectedItems.length}건` : '일정 없음'}
              </span>
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              className="p-1 rounded-lg hover:bg-gray-200 text-gray-400 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* 일정 목록 */}
          {selectedItems.length > 0 && (
            <div className="px-3 pb-2 space-y-1.5 max-h-52 overflow-y-auto">
              {selectedItems.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2.5 shadow-sm group"
                >
                  {/* 상태 토글 버튼 */}
                  <button
                    onClick={() => handleToggleStatus(item)}
                    disabled={togglingId === item.id}
                    title={`상태: ${STATUS_LABEL[item.status]} (클릭하여 변경)`}
                    className="w-3 h-3 rounded-full flex-shrink-0 transition-transform hover:scale-125 disabled:opacity-50"
                    style={{ backgroundColor: STATUS_COLOR[item.status] ?? '#d1d5db' }}
                  >
                    {togglingId === item.id && (
                      <span className="block w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    )}
                  </button>

                  {/* 제목 */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug ${
                      item.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'
                    }`}>
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{item.description}</p>
                    )}
                  </div>

                  {/* 상태 텍스트 */}
                  <span className="text-xs text-gray-400 flex-shrink-0 hidden group-hover:block">
                    {STATUS_LABEL[item.status]}
                  </span>

                  {/* 삭제 버튼 */}
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    title="삭제"
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all disabled:opacity-40 flex-shrink-0"
                  >
                    {deletingId === item.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Trash2 size={14} />
                    }
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 추가 입력 */}
          <div className="px-3 pb-3 pt-1">
            <div className="flex gap-2 items-center bg-white rounded-xl border border-gray-200 px-3 py-2 focus-within:ring-2 focus-within:ring-blue-300 focus-within:border-transparent transition-all">
              <Plus size={15} className="text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                placeholder="새 일정 추가..."
                className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
              />
              <button
                onClick={handleAdd}
                disabled={!newTitle.trim() || adding}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 flex items-center gap-1"
              >
                {adding
                  ? <Loader2 size={12} className="animate-spin" />
                  : '추가'
                }
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 px-1">
              Enter 또는 추가 버튼 · 상태 점을 클릭하면 미시작→진행중→완료→보류 순으로 변경
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
