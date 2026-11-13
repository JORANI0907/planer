'use client'

import { useEffect, useState } from 'react'
import { getLifeGoals } from '@/lib/api'
import type { LifeGoal, AgeGroup } from '@/lib/types'
import { GOAL_TYPE_CONFIG, GOAL_PROGRESS_CONFIG } from '@/lib/types'
import { StrategyBoard } from '@/components/strategy/StrategyBoard'

const AGE_GROUPS: AgeGroup[] = ['30대', '40대', '50대', '60대', '기타']

export default function StrategyPage() {
  const [goals, setGoals] = useState<LifeGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('30대')
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)

  useEffect(() => {
    getLifeGoals()
      .then((g) => setGoals(g))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // 나이대/목표 변경 시 해당 나이대의 첫 목표 자동 선택
  useEffect(() => {
    const gg = goals.filter((g) => g.age_group === ageGroup)
    setSelectedGoalId((prev) => (prev && gg.some((g) => g.id === prev) ? prev : gg[0]?.id ?? null))
  }, [ageGroup, goals])

  const groupGoals = goals.filter((g) => g.age_group === ageGroup)
  const selected = goals.find((g) => g.id === selectedGoalId) ?? null

  return (
    <div className="px-4 py-5 flex flex-col gap-4 max-w-5xl mx-auto w-full">
      <div>
        <h1 className="text-xl font-bold text-gray-900">세부전략</h1>
        <p className="text-sm text-gray-500 mt-0.5">큰그림(10년 목표)을 전략 → 마일스톤 플로우로 구체화합니다.</p>
      </div>

      {/* 나이대 탭 */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {AGE_GROUPS.map((ag) => (
          <button
            key={ag}
            onClick={() => setAgeGroup(ag)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              ageGroup === ag ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {ag}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : groupGoals.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-12 text-center">
          <p className="text-sm text-gray-500">{ageGroup}에 등록된 10년 목표가 없습니다.</p>
          <p className="text-xs text-gray-400 mt-1">먼저 &lsquo;장기계획&rsquo;에서 목표를 추가하세요.</p>
        </div>
      ) : (
        <>
          {/* 목표 선택 칩 */}
          <div className="flex items-center gap-2 flex-wrap">
            {groupGoals.map((g) => {
              const active = g.id === selectedGoalId
              const typeConf = g.goal_type ? GOAL_TYPE_CONFIG[g.goal_type] : null
              const progConf = GOAL_PROGRESS_CONFIG[g.progress]
              return (
                <button
                  key={g.id}
                  onClick={() => setSelectedGoalId(g.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {typeConf && <span>{typeConf.icon}</span>}
                  <span className="truncate max-w-[200px]">{g.title}</span>
                  {!active && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${progConf.color}`}>{progConf.label}</span>}
                </button>
              )
            })}
          </div>

          {/* 선택한 목표의 전략 보드 */}
          {selected ? (
            <div className="mt-1">
              <div className="mb-2 text-xs text-gray-400">
                큰그림: <span className="font-semibold text-gray-600">{selected.title}</span>
              </div>
              <StrategyBoard key={selected.id} lifeGoalId={selected.id} />
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-gray-400">목표를 선택하세요.</div>
          )}
        </>
      )}
    </div>
  )
}
