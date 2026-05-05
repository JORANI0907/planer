'use client'

import { useState } from 'react'
import { Rocket, Calendar } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { createMapping, deleteMapping, createLifeGoalAnnualMapping, deleteLifeGoalAnnualMapping } from '@/lib/api'
import { GOAL_TYPE_CONFIG, GOAL_PROGRESS_CONFIG, type LifeGoal, type PlanItem } from '@/lib/types'

// ─── 10년 목표에서 연간으로 불러오기 ───────────────────────
const AGE_GROUPS = ['전체', '30대', '40대', '50대', '60대'] as const
type AgeGroupFilter = typeof AGE_GROUPS[number]

interface LoadLifeGoalsSheetProps {
  open: boolean
  onClose: () => void
  annualPeriodKey: string
  lifeGoals: LifeGoal[]
  alreadyMappedIds: string[]
  onSuccess: () => void
}

export function LoadLifeGoalsSheet({ open, onClose, annualPeriodKey, lifeGoals, alreadyMappedIds, onSuccess }: LoadLifeGoalsSheetProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(alreadyMappedIds))
  const [loading, setLoading] = useState(false)
  const [ageFilter, setAgeFilter] = useState<AgeGroupFilter>('전체')

  const filteredGoals = ageFilter === '전체' ? lifeGoals : lifeGoals.filter(g => g.age_group === ageFilter)

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const toAdd = [...selected].filter(id => !alreadyMappedIds.includes(id))
      const toRemove = alreadyMappedIds.filter(id => !selected.has(id))
      await Promise.all([
        ...toAdd.map(id => createLifeGoalAnnualMapping(id, annualPeriodKey)),
        ...toRemove.map(id => deleteLifeGoalAnnualMapping(id, annualPeriodKey)),
      ])
      onSuccess()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-1"><Rocket size={20} /> 10년 단위 목표 불러오기</SheetTitle>
          <p className="text-xs text-gray-500">{annualPeriodKey}년 계획에 반영할 목표를 선택하세요</p>
        </SheetHeader>

        {/* 연령대 필터 */}
        <div className="mt-4 flex gap-1.5 flex-wrap">
          {AGE_GROUPS.map(ag => (
            <button
              key={ag}
              onClick={() => setAgeFilter(ag)}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                ageFilter === ag ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {ag}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          {filteredGoals.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">{ageFilter} 목표가 없습니다</p>
          )}
          {filteredGoals.map(goal => {
            const isSelected = selected.has(goal.id)
            const typeConfig = goal.goal_type ? GOAL_TYPE_CONFIG[goal.goal_type] : null
            const progressConfig = GOAL_PROGRESS_CONFIG[goal.progress]
            return (
              <button
                key={goal.id}
                onClick={() => toggle(goal.id)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                  isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{goal.age_group}</span>
                      <p className={`text-sm font-medium ${isSelected ? 'text-blue-800' : 'text-gray-900'}`}>
                        {goal.title}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {typeConfig && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${typeConfig.color}`}>
                          {typeConfig.icon} {typeConfig.label}
                        </span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${progressConfig.color}`}>
                        {progressConfig.label}
                      </span>
                      {goal.target_date && (
                        <span className="text-xs text-gray-400 inline-flex items-center gap-1"><Calendar size={14} /> {goal.target_date}</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-xl mt-0.5 ${isSelected ? 'text-blue-500' : 'text-gray-300'}`}>
                    {isSelected ? '✓' : '○'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-6 flex gap-2">
          <Button onClick={handleSave} disabled={loading} className="flex-1">
            {loading ? '저장 중...' : `${selected.size}개 목표 연결`}
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">취소</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── 상위 Plan Items에서 하위로 불러오기 ────────────────────
interface LoadPlanItemsSheetProps {
  open: boolean
  onClose: () => void
  parentLabel: string
  childPeriodKey: string
  parentItems: PlanItem[]
  alreadyMappedParentIds: string[]
  onSuccess: () => void
}

export function LoadPlanItemsSheet({ open, onClose, parentLabel, childPeriodKey, parentItems, alreadyMappedParentIds, onSuccess }: LoadPlanItemsSheetProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(alreadyMappedParentIds))
  const [loading, setLoading] = useState(false)

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const toAdd = [...selected].filter(id => !alreadyMappedParentIds.includes(id))
      const toRemove = alreadyMappedParentIds.filter(id => !selected.has(id))
      await Promise.all([
        ...toAdd.map(id => createMapping(id, childPeriodKey)),
        ...toRemove.map(id => deleteMapping(id, childPeriodKey)),
      ])
      onSuccess()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const STATUS_LABEL: Record<string, string> = {
    pending: '미시작', in_progress: '진행중', completed: '완료', on_hold: '보류'
  }
  const STATUS_COLOR: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600', in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700', on_hold: 'bg-orange-100 text-orange-700'
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>📌 {parentLabel}에서 불러오기</SheetTitle>
          <p className="text-xs text-gray-500">{childPeriodKey}에 반영할 계획을 선택하세요</p>
        </SheetHeader>

        {parentItems.length === 0 ? (
          <div className="mt-8 text-center text-gray-400 text-sm">
            <p>{parentLabel}에 계획이 없습니다</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {parentItems.map(item => {
              const isSelected = selected.has(item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                    isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isSelected ? 'text-blue-800' : 'text-gray-900'}`}>
                        {item.title}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLOR[item.status]}`}>
                          {STATUS_LABEL[item.status]}
                        </span>
                        <span className="text-xs text-gray-400 inline-flex items-center gap-1"><Calendar size={14} /> {item.period_key}</span>
                      </div>
                    </div>
                    <span className={`text-xl mt-0.5 ${isSelected ? 'text-blue-500' : 'text-gray-300'}`}>
                      {isSelected ? '✓' : '○'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <Button onClick={handleSave} disabled={loading || parentItems.length === 0} className="flex-1">
            {loading ? '저장 중...' : `${selected.size}개 계획 반영`}
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">취소</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
