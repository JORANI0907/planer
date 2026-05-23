'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { RoutineTask } from '@/lib/types'
import { WEEKDAY_LABELS, ROUTINE_CATEGORY_CONFIG } from '@/lib/types'
import { RoutineTaskForm } from './RoutineTaskForm'

interface RoutineTaskCardProps {
  task: RoutineTask
  onToggle: (id: string, isActive: boolean) => Promise<void>
  onUpdate: (id: string, data: {
    title: string
    category: RoutineTask['category']
    schedule_type: 'weekly' | 'monthly'
    weekly_days: number[]
    monthly_dates: number[]
    color: string
    end_date: string
  }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function ScheduleLabel({ task }: { task: RoutineTask }) {
  if (task.schedule_type === 'weekly') {
    const sorted = [...task.weekly_days].sort(
      (a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b)
    )
    return (
      <span className="text-xs text-gray-500">
        매주 {sorted.map(d => WEEKDAY_LABELS[d]).join('·')}요일
      </span>
    )
  }
  const sorted = [...task.monthly_dates].sort((a, b) => a - b)
  return (
    <span className="text-xs text-gray-500">
      매월 {sorted.join(', ')}일
    </span>
  )
}

function EndDateLabel({ endDate }: { endDate: string | null }) {
  if (!endDate) return null
  const [y, m, d] = endDate.split('-')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)
  const daysLeft = Math.ceil((end.getTime() - today.getTime()) / 86400000)

  let suffix = ''
  if (daysLeft < 0) suffix = ' · 종료됨'
  else if (daysLeft === 0) suffix = ' · 오늘 마지막'
  else if (daysLeft <= 7) suffix = ` · D-${daysLeft}`

  return (
    <span className="text-xs text-gray-400">
      ~{parseInt(y)}년 {parseInt(m)}월 {parseInt(d)}일까지{suffix}
    </span>
  )
}

export function RoutineTaskCard({ task, onToggle, onUpdate, onDelete }: RoutineTaskCardProps) {
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const handleToggle = async () => {
    setToggling(true)
    try {
      await onToggle(task.id, !task.is_active)
    } finally {
      setToggling(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`"${task.title}" 필수과업을 삭제할까요?\n오늘 이후 미완료 일정도 함께 삭제됩니다.\n(과거 완료된 이력은 보존됩니다)`)) return
    setDeleting(true)
    try {
      await onDelete(task.id)
    } finally {
      setDeleting(false)
    }
  }

  const isExpired = task.end_date
    ? new Date(task.end_date) < new Date(new Date().setHours(0, 0, 0, 0))
    : false

  return (
    <>
      <div className={`bg-white rounded-2xl border transition-all overflow-hidden ${
        task.is_active && !isExpired ? 'border-gray-200 shadow-sm' : 'border-gray-100 opacity-70'
      }`}>
        {/* 색상 바 */}
        <div className="h-1 w-full" style={{ backgroundColor: task.color }} />

        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />

          {/* 제목 + 주기 + 종료일 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className={`text-sm font-medium truncate ${task.is_active && !isExpired ? 'text-gray-900' : 'text-gray-500'}`}>
                {task.title}
              </p>
              <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROUTINE_CATEGORY_CONFIG[task.category].color}`}>
                {ROUTINE_CATEGORY_CONFIG[task.category].label}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <ScheduleLabel task={task} />
              <EndDateLabel endDate={task.end_date} />
            </div>
          </div>

          {/* 버튼들 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setEditOpen(true)}
              className="text-gray-400 hover:text-gray-600 text-sm"
              title="편집"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-gray-300 hover:text-red-400 text-sm disabled:opacity-40"
              title="삭제"
            >
              <Trash2 size={14} />
            </button>

            {/* 토글 스위치 */}
            <button
              onClick={handleToggle}
              disabled={toggling || isExpired}
              title={isExpired ? '종료일이 지났습니다' : task.is_active ? '끄기' : '켜기'}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                toggling || isExpired ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              } ${task.is_active && !isExpired ? 'bg-orange-500' : 'bg-gray-200'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  task.is_active && !isExpired ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* 활성화 배지 */}
        {task.is_active && !isExpired && task.end_date && (
          <div className="px-4 pb-3">
            <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full inline-block animate-pulse" />
              {(() => {
                const [y, m, d] = task.end_date.split('-')
                return `${parseInt(y)}년 ${parseInt(m)}월 ${parseInt(d)}일까지 자동 반복 중`
              })()}
            </span>
          </div>
        )}

        {/* 종료됨 배지 */}
        {isExpired && (
          <div className="px-4 pb-3">
            <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              반복 종료
            </span>
          </div>
        )}
      </div>

      <RoutineTaskForm
        open={editOpen}
        onOpenChange={setEditOpen}
        initialData={{
          title: task.title,
          category: task.category,
          schedule_type: task.schedule_type,
          weekly_days: task.weekly_days,
          monthly_dates: task.monthly_dates,
          color: task.color,
          end_date: task.end_date ?? '',
        }}
        onSubmit={async (data) => { await onUpdate(task.id, data) }}
        submitLabel="수정 저장"
      />
    </>
  )
}
