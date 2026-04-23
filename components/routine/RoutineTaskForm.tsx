'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { WEEKDAY_LABELS, type RoutineCategory } from '@/lib/types'

interface FormData {
  title: string
  category: RoutineCategory
  schedule_type: 'weekly' | 'monthly'
  weekly_days: number[]
  monthly_dates: number[]
  color: string
}

interface RoutineTaskFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: Partial<FormData>
  onSubmit: (data: FormData) => Promise<void>
  submitLabel?: string
}

const COLOR_OPTIONS = [
  { value: '#f97316', label: '주황' },
  { value: '#8b5cf6', label: '보라' },
  { value: '#ef4444', label: '빨강' },
  { value: '#3b82f6', label: '파랑' },
  { value: '#10b981', label: '초록' },
]

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // 월~토,일

export function RoutineTaskForm({ open, onOpenChange, initialData, onSubmit, submitLabel = '저장' }: RoutineTaskFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [category, setCategory] = useState<RoutineCategory>(initialData?.category ?? '개인')
  const [scheduleType, setScheduleType] = useState<'weekly' | 'monthly'>(initialData?.schedule_type ?? 'weekly')
  const [weeklyDays, setWeeklyDays] = useState<number[]>(initialData?.weekly_days ?? [])
  const [monthlyDates, setMonthlyDates] = useState<number[]>(initialData?.monthly_dates ?? [])
  const [color, setColor] = useState(initialData?.color ?? '#f97316')
  const [submitting, setSubmitting] = useState(false)

  const toggleWeekday = (day: number) => {
    setWeeklyDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  const toggleMonthDate = (date: number) => {
    setMonthlyDates(prev =>
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    )
  }

  const handleSubmit = async () => {
    if (!title.trim()) return
    if (scheduleType === 'weekly' && weeklyDays.length === 0) return
    if (scheduleType === 'monthly' && monthlyDates.length === 0) return

    setSubmitting(true)
    try {
      await onSubmit({ title: title.trim(), category, schedule_type: scheduleType, weekly_days: weeklyDays, monthly_dates: monthlyDates, color })
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  const isValid =
    title.trim().length > 0 &&
    (scheduleType === 'weekly' ? weeklyDays.length > 0 : monthlyDates.length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{submitLabel === '저장' ? '필수과업 추가' : '필수과업 수정'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">과업 이름</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && isValid) handleSubmit() }}
              placeholder="예: 팀 일지 작성, 재고 점검..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>

          {/* 카테고리 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
            <div className="flex gap-2">
              {(['개인', '업무'] as RoutineCategory[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    category === cat
                      ? cat === '개인'
                        ? 'bg-purple-500 text-white border-purple-500'
                        : 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 주기 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">반복 주기</label>
            <div className="flex gap-2">
              <button
                onClick={() => setScheduleType('weekly')}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  scheduleType === 'weekly'
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                주간
              </button>
              <button
                onClick={() => setScheduleType('monthly')}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  scheduleType === 'monthly'
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                월간
              </button>
            </div>
          </div>

          {/* 주간: 요일 선택 */}
          {scheduleType === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">요일 선택</label>
              <div className="flex gap-1.5 flex-wrap">
                {WEEKDAY_ORDER.map(day => (
                  <button
                    key={day}
                    onClick={() => toggleWeekday(day)}
                    className={`w-9 h-9 rounded-full text-sm font-medium border transition-colors ${
                      weeklyDays.includes(day)
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {WEEKDAY_LABELS[day]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 월간: 날짜 선택 */}
          {scheduleType === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">날짜 선택</label>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 31 }, (_, i) => i + 1).map(date => (
                  <button
                    key={date}
                    onClick={() => toggleMonthDate(date)}
                    className={`h-8 rounded-lg text-xs font-medium border transition-colors ${
                      monthlyDates.includes(date)
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {date}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 색상 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">구분 색상</label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setColor(opt.value)}
                  title={opt.label}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === opt.value ? 'border-gray-700 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: opt.value }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex-1 py-2 rounded-xl text-sm bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-40 transition-colors"
          >
            {submitting ? '저장 중...' : submitLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
