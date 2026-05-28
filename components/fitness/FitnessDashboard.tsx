'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, Dumbbell, Utensils, AlertTriangle } from 'lucide-react'
import type { FitnessProgram, FitnessProgramSplit, FitnessSession, FitnessDiet } from '@/lib/fitness-types'
import { DIET_GOALS, COMPOUND_HIGHLIGHTS, formatDateShort, calc1RM } from '@/lib/fitness-types'
import {
  getActiveProgram, getSplitsByProgram, getThisWeekSessions,
  getCompoundHighlights, getDietHistory, getSessions,
} from '@/lib/fitness-api'

type CompoundStat = {
  exercise: string
  latest_weight: number
  latest_reps: number
  one_rm: number
  trend: 'up' | 'same' | 'down'
}

function TrendIcon({ trend }: { trend: 'up' | 'same' | 'down' }) {
  if (trend === 'up') return <TrendingUp size={14} className="text-green-500" />
  if (trend === 'down') return <TrendingDown size={14} className="text-red-400" />
  return <Minus size={14} className="text-gray-400" />
}

function MacroBar({ label, value, min, max, unit, warn }: {
  label: string; value: number; min: number; max: number; unit: string; warn?: boolean
}) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const isLow = warn && value < min
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium ${isLow ? 'text-red-500' : 'text-gray-600'}`}>
          {label} {isLow && '⚠️'}
        </span>
        <span className="text-gray-500">{value}{unit} / {max}{unit}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isLow ? 'bg-red-400' : pct >= 100 ? 'bg-green-500' : 'bg-blue-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function FitnessDashboard({ onTabChange }: { onTabChange?: (tab: string) => void }) {
  const [program, setProgram] = useState<FitnessProgram | null>(null)
  const [splits, setSplits] = useState<FitnessProgramSplit[]>([])
  const [weekSessions, setWeekSessions] = useState<FitnessSession[]>([])
  const [compounds, setCompounds] = useState<CompoundStat[]>([])
  const [dietHistory, setDietHistory] = useState<FitnessDiet[]>([])
  const [recentSessions, setRecentSessions] = useState<FitnessSession[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [prog, weekS, comps, diet, recent] = await Promise.all([
        getActiveProgram(),
        getThisWeekSessions(),
        getCompoundHighlights(),
        getDietHistory(7),
        getSessions(5),
      ])
      setWeekSessions(weekS)
      setCompounds(comps)
      setDietHistory(diet)
      setRecentSessions(recent)
      if (prog) {
        setProgram(prog)
        const sp = await getSplitsByProgram(prog.id)
        setSplits(sp)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-gray-400 text-sm">불러오는 중...</div>
  }

  // 이번 주 완료된 분할 이름 목록
  const doneSplitNames = new Set(weekSessions.filter(s => s.is_completed).map(s => s.split_name))

  // 오늘 식단
  const today = new Date().toISOString().split('T')[0]
  const todayDiet = dietHistory.find(d => d.date === today)

  return (
    <div className="space-y-5">
      {/* 이번 주 운동 현황 */}
      {program && (
        <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Dumbbell size={16} className="text-blue-500" />
              이번 주 운동
            </h3>
            <span className="text-xs text-gray-400">{doneSplitNames.size}/{splits.length} 완료</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {splits.map(split => {
              const done = doneSplitNames.has(split.name)
              const sessionForSplit = weekSessions.find(s => s.split_name === split.name && s.is_completed)
              return (
                <div
                  key={split.id}
                  className={`rounded-xl px-3 py-2.5 flex items-center justify-between ${done ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-100'}`}
                >
                  <span className={`text-sm font-medium break-keep ${done ? 'text-green-800' : 'text-gray-500'}`}>{split.name}</span>
                  {done ? (
                    <span className="text-xs text-green-600">{sessionForSplit ? formatDateShort(sessionForSplit.date) : '✓'}</span>
                  ) : (
                    <span className="text-xs text-gray-400">미완료</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 주요 컴파운드 1RM */}
      <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp size={16} className="text-orange-500" />
          주요 컴파운드 추정 1RM
        </h3>
        {compounds.filter(c => COMPOUND_HIGHLIGHTS.includes(c.exercise as typeof COMPOUND_HIGHLIGHTS[number])).length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">운동 기록이 없습니다. 운동을 시작해보세요!</p>
        ) : (
          <div className="space-y-2">
            {compounds.map(c => (
              c.one_rm > 0 && (
                <div key={c.exercise} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <span className="font-medium text-gray-700 flex-1">{c.exercise}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{c.latest_weight}×{c.latest_reps}</span>
                    <span className="font-bold text-gray-900 w-16 text-right">{c.one_rm}kg</span>
                    <TrendIcon trend={c.trend} />
                  </div>
                </div>
              )
            ))}
            <p className="text-[10px] text-gray-400">* Epley 공식 추정치 (실제 1RM과 다를 수 있음)</p>
          </div>
        )}
      </section>

      {/* 오늘 식단 */}
      <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Utensils size={16} className="text-purple-500" />
            오늘 식단
          </h3>
          <button onClick={() => onTabChange?.('diet')} className="text-xs text-blue-500 font-medium">기록하기 →</button>
        </div>
        {!todayDiet ? (
          <p className="text-xs text-gray-400 text-center py-2">오늘 식단 기록이 없습니다.</p>
        ) : (
          <div className="space-y-2.5">
            {todayDiet.protein_g < DIET_GOALS.protein_g.min && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-xl p-2.5">
                <AlertTriangle size={14} />
                <span className="font-medium">단백질 부족! 근비대에 단백질 섭취가 가장 중요합니다.</span>
              </div>
            )}
            <MacroBar label="칼로리" value={todayDiet.calories} min={DIET_GOALS.calories.min} max={DIET_GOALS.calories.max} unit="kcal" />
            <MacroBar label="단백질" value={todayDiet.protein_g} min={DIET_GOALS.protein_g.min} max={DIET_GOALS.protein_g.max} unit="g" warn />
            <MacroBar label="탄수화물" value={todayDiet.carbs_g} min={DIET_GOALS.carbs_g.min} max={DIET_GOALS.carbs_g.max} unit="g" />
            <MacroBar label="지방" value={todayDiet.fat_g} min={DIET_GOALS.fat_g.min} max={DIET_GOALS.fat_g.max} unit="g" />
          </div>
        )}
      </section>

      {/* 최근 세션 */}
      <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <h3 className="font-bold text-gray-900">최근 운동 기록</h3>
        {recentSessions.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">운동 기록이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {recentSessions.map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                <div>
                  <span className="font-medium text-gray-800">{s.split_name || '(분할 없음)'}</span>
                  {s.duration_min && <span className="text-xs text-gray-400 ml-2">{s.duration_min}분</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{formatDateShort(s.date)}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${s.is_completed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.is_completed ? '완료' : '미완료'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
