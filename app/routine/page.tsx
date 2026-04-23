'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  getRoutineTasks,
  createRoutineTask,
  updateRoutineTask,
  deleteRoutineTask,
  toggleRoutineTask,
} from '@/lib/routine-api'
import type { RoutineTask, RoutineCategory } from '@/lib/types'
import { WEEKDAY_LABELS } from '@/lib/types'
import { RoutineTaskCard } from '@/components/routine/RoutineTaskCard'
import { RoutineTaskForm } from '@/components/routine/RoutineTaskForm'

type CategoryTab = '전체' | RoutineCategory
type ScheduleFilter = 'all' | 'weekly' | 'monthly'

// 주간 정렬: 월(1)~토(6)~일(0) 순서
const WEEKDAY_SORT_ORDER = [1, 2, 3, 4, 5, 6, 0]

function getSortKey(task: RoutineTask): number {
  if (task.schedule_type === 'weekly') {
    const min = task.weekly_days.reduce((acc, d) => {
      const idx = WEEKDAY_SORT_ORDER.indexOf(d)
      return idx < acc ? idx : acc
    }, 99)
    return min
  }
  // monthly: 가장 이른 날짜
  return Math.min(...task.monthly_dates)
}

const CATEGORY_TABS: { value: CategoryTab; label: string }[] = [
  { value: '전체', label: '전체' },
  { value: '개인', label: '개인' },
  { value: '업무', label: '업무' },
]

const SCHEDULE_FILTERS: { value: ScheduleFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'weekly', label: '주간' },
  { value: 'monthly', label: '월간' },
]

export default function RoutinePage() {
  const [tasks, setTasks] = useState<RoutineTask[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [categoryTab, setCategoryTab] = useState<CategoryTab>('전체')
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>('all')

  useEffect(() => {
    getRoutineTasks()
      .then(setTasks)
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = async (data: {
    title: string
    category: RoutineCategory
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
    category: RoutineCategory
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

  // 필터링 + 정렬
  const filteredTasks = useMemo(() => {
    let list = tasks

    // 카테고리 필터
    if (categoryTab !== '전체') {
      list = list.filter(t => t.category === categoryTab)
    }

    // 주기 필터
    if (scheduleFilter !== 'all') {
      list = list.filter(t => t.schedule_type === scheduleFilter)
    }

    // 주기 필터 적용 시 정렬 (월~일, 1~31일 순)
    if (scheduleFilter !== 'all') {
      list = [...list].sort((a, b) => getSortKey(a) - getSortKey(b))
    }

    return list
  }, [tasks, categoryTab, scheduleFilter])

  const activeCount = tasks.filter(t => t.is_active).length
  const filteredActiveCount = filteredTasks.filter(t => t.is_active).length

  // 활성/비활성 분리
  const activeTasks = filteredTasks.filter(t => t.is_active)
  const inactiveTasks = filteredTasks.filter(t => !t.is_active)

  return (
    <div className="max-w-2xl mx-auto">
      {/* 헤더 */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">필수과업</h1>
            <p className="text-sm text-gray-500 mt-0.5">켜면 오늘부터 2주치 일정에 자동 생성됩니다</p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors"
          >
            <span className="text-base leading-none">+</span>
            추가
          </button>
        </div>

        {activeCount > 0 && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5 flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 animate-pulse" />
            <p className="text-sm text-orange-700 font-medium">
              {activeCount}개 과업이 활성화되어 2주치 일정을 자동 생성 중
            </p>
          </div>
        )}

        {/* 카테고리 탭 */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setCategoryTab(tab.value)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                categoryTab === tab.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.value !== '전체' && (
                <span className="ml-1 text-xs text-gray-400">
                  ({tasks.filter(t => t.category === tab.value).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 주기 필터 */}
        <div className="flex gap-2 mt-2">
          {SCHEDULE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setScheduleFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                scheduleFilter === f.value
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {f.label}
              {f.value !== 'all' && scheduleFilter === f.value && (
                <span className="ml-1 opacity-70">
                  {f.value === 'weekly' ? '↑ 월~일' : '↑ 1~31일'}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 과업 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-gray-200">
          <p className="text-4xl mb-3">🔄</p>
          {tasks.length === 0 ? (
            <>
              <p className="text-gray-600 font-medium">등록된 필수과업이 없습니다</p>
              <p className="text-sm text-gray-400 mt-1 mb-4">매일 반복할 업무를 등록해보세요</p>
              <button
                onClick={() => setAddOpen(true)}
                className="bg-orange-500 text-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                첫 번째 필수과업 추가
              </button>
            </>
          ) : (
            <p className="text-gray-500 font-medium">해당 조건의 과업이 없습니다</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* 활성 과업 */}
          {activeTasks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 px-1">
                활성화됨 ({filteredActiveCount})
              </p>
              {activeTasks.map(task => (
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
          {inactiveTasks.length > 0 && (
            <div className="space-y-2">
              {activeTasks.length > 0 && (
                <p className="text-xs font-semibold text-gray-400 px-1 mt-2">비활성화됨</p>
              )}
              {inactiveTasks.map(task => (
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
