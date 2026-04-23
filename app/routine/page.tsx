'use client'

import { useState, useEffect } from 'react'
import {
  getRoutineTasks,
  createRoutineTask,
  updateRoutineTask,
  deleteRoutineTask,
  toggleRoutineTask,
} from '@/lib/routine-api'
import type { RoutineTask } from '@/lib/types'
import { RoutineTaskCard } from '@/components/routine/RoutineTaskCard'
import { RoutineTaskForm } from '@/components/routine/RoutineTaskForm'

export default function RoutinePage() {
  const [tasks, setTasks] = useState<RoutineTask[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    getRoutineTasks()
      .then(setTasks)
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = async (data: {
    title: string
    schedule_type: 'weekly' | 'monthly'
    weekly_days: number[]
    monthly_dates: number[]
    color: string
  }) => {
    const task = await createRoutineTask({
      ...data,
      is_active: false,
      sort_order: tasks.length,
    })
    setTasks(prev => [...prev, task])
  }

  const handleUpdate = async (id: string, data: {
    title: string
    schedule_type: 'weekly' | 'monthly'
    weekly_days: number[]
    monthly_dates: number[]
    color: string
  }) => {
    const updated = await updateRoutineTask(id, data)
    setTasks(prev => prev.map(t => t.id === id ? updated : t))
  }

  const handleToggle = async (id: string, isActive: boolean) => {
    const updated = await toggleRoutineTask(id, isActive)
    setTasks(prev => prev.map(t => t.id === id ? updated : t))
  }

  const handleDelete = async (id: string) => {
    await deleteRoutineTask(id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const activeCount = tasks.filter(t => t.is_active).length

  return (
    <div className="max-w-2xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900">필수과업</h1>
            <p className="text-sm text-gray-500 mt-0.5">켜면 오늘부터 2주치 일정에 자동 생성됩니다</p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors"
          >
            <span className="text-base leading-none">+</span>
            필수과업 추가
          </button>
        </div>

        {activeCount > 0 && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 animate-pulse" />
            <p className="text-sm text-orange-700 font-medium">
              {activeCount}개 과업이 활성화되어 2주치 일정을 자동 생성 중입니다
            </p>
          </div>
        )}
      </div>

      {/* 과업 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <p className="text-4xl mb-3">🔄</p>
          <p className="text-gray-600 font-medium">등록된 필수과업이 없습니다</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">매일 반복할 업무를 등록하고 자동으로 일정을 만들어보세요</p>
          <button
            onClick={() => setAddOpen(true)}
            className="bg-orange-500 text-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            첫 번째 필수과업 추가
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 활성 과업 */}
          {tasks.filter(t => t.is_active).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 px-1">활성화됨</p>
              {tasks.filter(t => t.is_active).map(task => (
                <RoutineTaskCard
                  key={task.id}
                  task={task}
                  onToggle={handleToggle}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {/* 비활성 과업 */}
          {tasks.filter(t => !t.is_active).length > 0 && (
            <div className="space-y-2">
              {tasks.filter(t => t.is_active).length > 0 && (
                <p className="text-xs font-semibold text-gray-400 px-1 mt-4">비활성화됨</p>
              )}
              {tasks.filter(t => !t.is_active).map(task => (
                <RoutineTaskCard
                  key={task.id}
                  task={task}
                  onToggle={handleToggle}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 안내 카드 */}
      {tasks.length > 0 && (
        <div className="mt-6 bg-gray-50 rounded-2xl p-4 border border-gray-100">
          <p className="text-xs font-semibold text-gray-600 mb-2">사용 방법</p>
          <ul className="space-y-1.5 text-xs text-gray-500">
            <li className="flex items-start gap-1.5">
              <span className="text-orange-500 font-bold flex-shrink-0">켜기</span>
              오늘부터 14일 앞까지 해당 요일/날짜에 일정이 자동 생성됩니다
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-gray-400 font-bold flex-shrink-0">끄기</span>
              오늘 이후 미완료 일정이 삭제되고, 과거·완료 일정은 유지됩니다
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-blue-500 font-bold flex-shrink-0">일정</span>
              일일 계획 탭에서 주황색 테두리로 필수과업을 확인할 수 있습니다
            </li>
          </ul>
        </div>
      )}

      {/* 추가 폼 */}
      <RoutineTaskForm
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={handleAdd}
      />
    </div>
  )
}
