'use client'

import { useEffect, useState } from 'react'
import { getLifeGoals } from '@/lib/api'
import { getStrategyNodes } from '@/lib/strategy-api'
import type { LifeGoal, AgeGroup } from '@/lib/types'
import type { StrategyNode } from '@/lib/strategy-types'

const AGE_GROUPS: AgeGroup[] = ['30대', '40대', '50대', '60대']

/**
 * 메모 항목을 세부전략으로 보내기 — 나이대 → 목표 → 전략 선택 후
 * 선택한 전략 노드의 id 를 돌려준다(onSend). 실제 반영(strategy_node_id 설정)은 호출부에서.
 */
export function SendToStrategyDialog({
  itemTitle,
  onClose,
  onSend,
}: {
  itemTitle: string
  onClose: () => void
  onSend: (strategyNodeId: string) => void
}) {
  const [goals, setGoals] = useState<LifeGoal[]>([])
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('30대')
  const [goalId, setGoalId] = useState('')
  const [strategies, setStrategies] = useState<StrategyNode[]>([])
  const [strategyId, setStrategyId] = useState('')
  const [loadingStrategies, setLoadingStrategies] = useState(false)

  useEffect(() => {
    getLifeGoals().then(setGoals).catch(() => {})
  }, [])

  const groupGoals = goals.filter((g) => g.age_group === ageGroup)

  // 나이대 바뀌면 첫 목표 자동 선택
  useEffect(() => {
    setGoalId((prev) => (prev && groupGoals.some((g) => g.id === prev) ? prev : groupGoals[0]?.id ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageGroup, goals])

  // 목표 바뀌면 전략 로드
  useEffect(() => {
    if (!goalId) { setStrategies([]); setStrategyId(''); return }
    setLoadingStrategies(true)
    getStrategyNodes(goalId)
      .then((ns) => {
        const strs = ns.filter((n) => n.kind === 'strategy')
        setStrategies(strs)
        setStrategyId(strs[0]?.id ?? '')
      })
      .catch(() => setStrategies([]))
      .finally(() => setLoadingStrategies(false))
  }, [goalId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-900">세부전략으로 보내기</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate">🎯 {itemTitle}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
        </div>

        {/* 나이대 */}
        <div className="flex items-center gap-1.5 mb-3">
          {AGE_GROUPS.map((ag) => (
            <button
              key={ag}
              onClick={() => setAgeGroup(ag)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${ageGroup === ag ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {ag}
            </button>
          ))}
        </div>

        {/* 목표 */}
        <label className="block text-xs font-semibold text-gray-600 mb-1">목표</label>
        {groupGoals.length === 0 ? (
          <p className="text-xs text-gray-400 mb-3">{ageGroup}에 목표가 없습니다.</p>
        ) : (
          <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3">
            {groupGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        )}

        {/* 전략 */}
        <label className="block text-xs font-semibold text-gray-600 mb-1">전략</label>
        {loadingStrategies ? (
          <p className="text-xs text-gray-400 mb-4">전략 불러오는 중...</p>
        ) : strategies.length === 0 ? (
          <p className="text-xs text-gray-400 mb-4">이 목표에 전략이 없습니다. &lsquo;세부전략&rsquo;에서 먼저 전략을 추가하세요.</p>
        ) : (
          <select value={strategyId} onChange={(e) => setStrategyId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4">
            {strategies.map((s) => <option key={s.id} value={s.id}>{s.title || '(제목 없는 전략)'}</option>)}
          </select>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
          <button
            onClick={() => strategyId && onSend(strategyId)}
            disabled={!strategyId}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
          >
            보내기
          </button>
        </div>
      </div>
    </div>
  )
}
