'use client'

import { useState } from 'react'
import type { RoutineTask } from '@/lib/types'
import { WEEKDAY_LABELS, ROUTINE_CATEGORY_CONFIG } from '@/lib/types'
import { RoutineTaskForm } from './RoutineTaskForm'

interface RoutineTaskCardProps {
  task: RoutineTask
  onToggle: (id: string, isActive: boolean) => Promise<void>
  onUpdate: (id: string, data: { title: string; category: RoutineTask['category']; schedule_type: 'weekly' | 'monthly'; weekly_days: number[]; monthly_dates: number[]; color: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function ScheduleLabel({ task }: { task: RoutineTask }) {
  if (task.schedule_type === 'weekly') {
    const sorted = [...task.weekly_days].sort((a, b) => {
      const order = [1, 2, 3, 4, 5, 6, 0]
      return order.indexOf(a) - order.indexOf(b)
    })
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
    if (!confirm(`"${task.title}" 필수과업을 삭제할까요?\n미래의 미완료 일정도 함께 삭제됩니다.`)) return
    setDeleting(true)
    try {
      await onDelete(task.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className={`bg-white rounded-2xl border transition-all overflow-hidden ${
        task.is_active ? 'border-gray-200 shadow-sm' : 'border-gray-100 opacity-70'
      }`}>
        {/* 색상 바 */}
        <div className="h-1 w-full" style={{ backgroundColor: task.color }} />

        <div className="flex items-center gap-3 px-4 py-3.5">
          {/* 색상 점 */}
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: task.color }}
          />

          {/* 제목 + 주기 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className={`text-sm font-medium truncate ${task.is_active ? 'text-gray-900' : 'text-gray-500'}`}>
                {task.title}
              </p>
              <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROUTINE_CATEGORY_CONFIG[task.category].color}`}>
                {ROUTINE_CATEGORY_CONFIG[task.category].label}
              </span>
            </div>
            <ScheduleLabel task={task} />
          </div>

          {/* 버튼들 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setEditOpen(true)}
              className="text-gray-400 hover:text-gray-600 text-sm"
              title="편집"
            >
              ✏️
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-gray-300 hover:text-red-400 text-sm disabled:opacity-40"
              title="삭제"
            >
              🗑️
            </button>

            {/* 토글 스위치 */}
            <button
              onClick={handleToggle}
              disabled={toggling}
              title={task.is_active ? '끄기' : '켜기'}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                toggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              } ${task.is_active ? 'bg-orange-500' : 'bg-gray-200'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  task.is_active ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {task.is_active && (
          <div className="px-4 pb-3">
            <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full inline-block" />
              오늘부터 2주치 일정 자동 생성 중
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
        }}
        onSubmit={async (data) => { await onUpdate(task.id, data) }}
        submitLabel="수정 저장"
      />
    </>
  )
}
