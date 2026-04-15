'use client'

import type { PlanItem } from '@/lib/types'

function fmtDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function MonthCalendar({ year, month, selectedDate, calendarItems, onSelectDate }: {
  year: number
  month: number
  selectedDate: Date
  calendarItems: Record<string, PlanItem[]>
  onSelectDate: (d: Date) => void
}) {
  const today = new Date()
  const todayStr = fmtDay(today)
  const selectedStr = fmtDay(selectedDate)

  const firstDay = new Date(year, month - 1, 1)
  const lastDate = new Date(year, month, 0).getDate()
  const startOffset = firstDay.getDay()

  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: lastDate }, (_, i) => new Date(year, month - 1, i + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-900">{year}년 {month}월</span>
        <span className="text-xs text-gray-400">날짜 클릭 → 일일계획 이동</span>
      </div>
      <div className="p-2">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-1">
          {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
            <div key={d} className={`text-center text-[11px] font-semibold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
          ))}
        </div>
        {/* 날짜 그리드 */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0.5 mb-0.5">
            {week.map((date, di) => {
              if (!date) return <div key={di} />
              const key = fmtDay(date)
              const dayItems = calendarItems[key] ?? []
              const doneCount = dayItems.filter(i => i.status === 'completed').length
              const inProgressCount = dayItems.filter(i => i.status === 'in_progress').length
              const pendingCount = dayItems.filter(i => i.status === 'pending').length
              const isSelected = key === selectedStr
              const isToday = key === todayStr
              const isPast = date < today && !isToday
              const allDone = dayItems.length > 0 && doneCount === dayItems.length

              return (
                <button
                  key={di}
                  onClick={() => onSelectDate(new Date(date))}
                  className={`flex flex-col items-center py-1.5 px-0.5 rounded-xl transition-all ${
                    isSelected ? 'bg-blue-500 shadow-sm'
                    : isToday ? 'bg-blue-50 ring-1 ring-blue-300'
                    : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`text-[12px] font-semibold leading-none mb-1 ${
                    isSelected ? 'text-white'
                    : isToday ? 'text-blue-600'
                    : di === 0 ? 'text-red-400'
                    : di === 6 ? 'text-blue-400'
                    : isPast ? 'text-gray-300'
                    : 'text-gray-700'
                  }`}>{date.getDate()}</span>
                  <div className="flex gap-0.5 min-h-[6px] items-center justify-center">
                    {(allDone || doneCount > 0) && <div className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                    {inProgressCount > 0 && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />}
                    {!allDone && pendingCount > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.5)' : '#d1d5db' }} />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ))}
        {/* 범례 */}
        <div className="flex items-center gap-3 pt-2 px-1 border-t border-gray-50 mt-1">
          <span className="flex items-center gap-1 text-[10px] text-gray-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />완료</span>
          <span className="flex items-center gap-1 text-[10px] text-gray-400"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />진행중</span>
          <span className="flex items-center gap-1 text-[10px] text-gray-400"><span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />미완료</span>
        </div>
      </div>
    </div>
  )
}
