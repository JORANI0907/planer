'use client'

import { useState } from 'react'
import { Flag, Calendar } from 'lucide-react'
import { getCurrentYear, getCurrentQuarter, getCurrentMonth } from '@/lib/types'
import DailyPage from './daily/page'
import { DashboardCalendar } from '@/components/DashboardCalendar'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

export default function DashboardPage() {
  const today = new Date()
  const year = getCurrentYear()
  const quarter = getCurrentQuarter()
  const month = getCurrentMonth()
  const dayName = DAY_NAMES[today.getDay()]
  const [showCalendar, setShowCalendar] = useState(false)

  return (
    <div className="max-w-2xl mx-auto">
      {/* 인사 헤더 */}
      <div className="mb-4">
        <p className="text-sm text-gray-400 mb-1">
          {year}년 {month}월 {today.getDate()}일 {dayName}요일 · {quarter}분기
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">오늘 하루도 화이팅! <Flag size={20} /></h1>
          <button
            onClick={() => setShowCalendar(v => !v)}
            title="캘린더 보기"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              showCalendar ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Calendar size={15} />
            <span>캘린더</span>
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-1">푯대를 향해 한 걸음씩 나아가고 있습니다</p>
      </div>

      {showCalendar ? (
        <div className="mb-4">
          <DashboardCalendar />
        </div>
      ) : (
        <div className="mt-2">
          <DailyPage />
        </div>
      )}
    </div>
  )
}
