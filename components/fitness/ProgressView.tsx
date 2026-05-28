'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, Search } from 'lucide-react'
import type { FitnessExercise } from '@/lib/fitness-types'
import { calc1RM, calcProgressTrend, COMPOUND_HIGHLIGHTS, formatDateShort } from '@/lib/fitness-types'
import { getExercises, getExerciseHistory, getCompoundHighlights } from '@/lib/fitness-api'

type CompoundStat = {
  exercise: string
  latest_weight: number
  latest_reps: number
  one_rm: number
  trend: 'up' | 'same' | 'down'
}

type HistoryEntry = { date: string; best_weight: number; best_reps: number; one_rm: number }

function TrendBadge({ trend }: { trend: 'up' | 'same' | 'down' }) {
  if (trend === 'up') return <span className="flex items-center gap-0.5 text-green-600 font-bold text-xs"><TrendingUp size={12} />↑</span>
  if (trend === 'down') return <span className="flex items-center gap-0.5 text-red-400 font-bold text-xs"><TrendingDown size={12} />↓</span>
  return <span className="flex items-center gap-0.5 text-gray-400 text-xs"><Minus size={12} />-</span>
}

export default function ProgressView() {
  const [exercises, setExercises] = useState<FitnessExercise[]>([])
  const [compounds, setCompounds] = useState<CompoundStat[]>([])
  const [selectedExercise, setSelectedExercise] = useState<FitnessExercise | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [muscleFilter, setMuscleFilter] = useState<string>('전체')

  useEffect(() => {
    async function load() {
      const [ex, comps] = await Promise.all([getExercises(), getCompoundHighlights()])
      setExercises(ex)
      setCompounds(comps)
      setIsLoading(false)
    }
    load()
  }, [])

  const handleSelectExercise = useCallback(async (ex: FitnessExercise) => {
    setSelectedExercise(ex)
    setIsLoadingHistory(true)
    try {
      const h = await getExerciseHistory(ex.name, 6)
      setHistory(h)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  const muscleGroups = ['전체', ...Array.from(new Set(exercises.map(e => e.muscle_group)))]

  const filtered = exercises.filter(ex => {
    const matchSearch = ex.name.includes(search)
    const matchMuscle = muscleFilter === '전체' || ex.muscle_group === muscleFilter
    return matchSearch && matchMuscle
  })

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-gray-400 text-sm">불러오는 중...</div>
  }

  return (
    <div className="space-y-5">
      {/* 주요 컴파운드 요약 */}
      <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
        <h3 className="font-bold text-gray-900 text-sm">주요 컴파운드 현황</h3>
        {compounds.filter(c => COMPOUND_HIGHLIGHTS.includes(c.exercise as typeof COMPOUND_HIGHLIGHTS[number]) && c.one_rm > 0).length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">기록이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[280px]">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-1.5 font-medium">종목</th>
                  <th className="text-right pb-1.5 font-medium">최근</th>
                  <th className="text-right pb-1.5 font-medium">추정 1RM</th>
                  <th className="text-right pb-1.5 font-medium">추세</th>
                </tr>
              </thead>
              <tbody>
                {compounds.filter(c => c.one_rm > 0).map(c => (
                  <tr key={c.exercise} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 font-medium text-gray-800">{c.exercise}</td>
                    <td className="py-2 text-right text-gray-500 text-xs">{c.latest_weight}×{c.latest_reps}</td>
                    <td className="py-2 text-right font-bold text-gray-900">{c.one_rm}kg</td>
                    <td className="py-2 text-right"><TrendBadge trend={c.trend} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-gray-400 mt-2">* Epley 공식 추정치</p>
          </div>
        )}
      </section>

      {/* 종목 선택 + 기록 조회 */}
      <section className="space-y-3">
        <h3 className="font-bold text-gray-900 text-sm">종목별 진행 기록</h3>

        {/* 검색 */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="종목 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm"
          />
        </div>

        {/* 근육군 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {muscleGroups.map(group => (
            <button
              key={group}
              onClick={() => setMuscleFilter(group)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                muscleFilter === group
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {group}
            </button>
          ))}
        </div>

        {/* 종목 목록 */}
        <div className="space-y-1.5">
          {filtered.map(ex => (
            <button
              key={ex.id}
              onClick={() => handleSelectExercise(ex)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors ${
                selectedExercise?.id === ex.id
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">{ex.name}</span>
                {ex.is_compound && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded">컴파운드</span>
                )}
              </div>
              <span className="text-xs text-gray-400">{ex.muscle_group}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 선택된 종목 기록 */}
      {selectedExercise && (
        <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <h3 className="font-bold text-gray-900">{selectedExercise.name} 기록</h3>

          {isLoadingHistory ? (
            <p className="text-xs text-gray-400 text-center py-3">불러오는 중...</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">아직 기록이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {history.map((entry, i) => {
                const prevEntry = history[i + 1]
                const trend = prevEntry ? calcProgressTrend(prevEntry.one_rm, entry.one_rm) : 'same'
                return (
                  <div key={entry.date + i} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                    <span className="text-gray-500 text-xs w-12">{formatDateShort(entry.date)}</span>
                    <span className="font-medium text-gray-700 flex-1 text-center">
                      {entry.best_weight}kg × {entry.best_reps}회
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">~{entry.one_rm}kg</span>
                      {i < history.length - 1 && <TrendBadge trend={trend} />}
                    </div>
                  </div>
                )
              })}
              <p className="text-[10px] text-gray-400 text-right">세션당 최고 세트 기준 추정 1RM</p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
