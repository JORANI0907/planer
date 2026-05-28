'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Plus, X, Trash2, Dumbbell } from 'lucide-react'
import type { FitnessExercise, FitnessProgram, FitnessProgramSplit, FitnessSession, FitnessSet, SplitExercise } from '@/lib/fitness-types'
import { calc1RM, getTodayKey } from '@/lib/fitness-types'
import {
  getActiveProgram, getSplitsByProgram, getExercisesBySplit,
  getPrevSessionSetsBulk, createSession, updateSession,
  deleteSession, createSet, deleteSet, getExercises,
} from '@/lib/fitness-api'

interface ExerciseEntry {
  exercise: SplitExercise
  savedSets: FitnessSet[]
  prevSets: FitnessSet[]
  pendingWeight: number
  pendingReps: number
  isExpanded: boolean
}

function Stepper({
  value, label, onDecrement, onIncrement, format, step,
}: {
  value: number
  label: string
  onDecrement: () => void
  onIncrement: () => void
  format: (v: number) => string
  step: number
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] text-gray-400 font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={onDecrement}
          className="w-11 h-11 flex items-center justify-center bg-gray-100 rounded-xl text-xl font-bold active:bg-gray-200 select-none"
        >−</button>
        <span className="w-16 text-center font-mono text-sm font-bold tabular-nums">{format(value)}</span>
        <button
          onClick={onIncrement}
          className="w-11 h-11 flex items-center justify-center bg-gray-100 rounded-xl text-xl font-bold active:bg-gray-200 select-none"
        >+</button>
      </div>
    </div>
  )
}

export default function WorkoutSession() {
  const [step, setStep] = useState<'select' | 'recording'>('select')
  const [program, setProgram] = useState<FitnessProgram | null>(null)
  const [splits, setSplits] = useState<FitnessProgramSplit[]>([])
  const [session, setSession] = useState<FitnessSession | null>(null)
  const [entries, setEntries] = useState<ExerciseEntry[]>([])
  const [allExercises, setAllExercises] = useState<FitnessExercise[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [exerciseSearch, setExerciseSearch] = useState('')
  const startTimeRef = useRef<Date | null>(null)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const [prog, allEx] = await Promise.all([getActiveProgram(), getExercises()])
        setAllExercises(allEx)
        if (prog) {
          const sp = await getSplitsByProgram(prog.id)
          setProgram(prog)
          setSplits(sp)
        }
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const handleSelectSplit = useCallback(async (split: FitnessProgramSplit) => {
    if (!program || isSaving) return
    setIsSaving(true)
    try {
      const newSession = await createSession({
        date: getTodayKey(),
        split_id: split.id,
        split_name: split.name,
        program_name: program.name,
        duration_min: null,
        condition: null,
        memo: '',
        is_completed: false,
      })
      startTimeRef.current = new Date()
      const exercises = await getExercisesBySplit(split.id)
      const prevMap = await getPrevSessionSetsBulk(exercises.map(e => e.name))
      setSession(newSession)
      setEntries(exercises.map(ex => {
        const prev = prevMap.get(ex.name) ?? []
        return {
          exercise: ex,
          savedSets: [],
          prevSets: prev,
          pendingWeight: prev[0]?.weight_kg ?? 60,
          pendingReps: prev[0]?.reps ?? 10,
          isExpanded: true,
        }
      }))
      setStep('recording')
    } finally {
      setIsSaving(false)
    }
  }, [program, isSaving])

  const handleAddSet = useCallback(async (idx: number) => {
    if (!session || isSaving) return
    const entry = entries[idx]
    setIsSaving(true)
    try {
      const saved = await createSet({
        session_id: session.id,
        exercise_id: entry.exercise.id,
        exercise_name: entry.exercise.name,
        set_number: entry.savedSets.length + 1,
        weight_kg: entry.pendingWeight,
        reps: entry.pendingReps,
        rpe: null,
      })
      setEntries(prev => prev.map((e, i) =>
        i === idx ? { ...e, savedSets: [...e.savedSets, saved] } : e
      ))
    } finally {
      setIsSaving(false)
    }
  }, [entries, session, isSaving])

  const handleDeleteSet = useCallback(async (entryIdx: number, setId: string) => {
    await deleteSet(setId)
    setEntries(prev => prev.map((e, i) =>
      i !== entryIdx ? e : {
        ...e,
        savedSets: e.savedSets
          .filter(s => s.id !== setId)
          .map((s, j) => ({ ...s, set_number: j + 1 })),
      }
    ))
  }, [])

  const updatePending = useCallback((idx: number, field: 'weight' | 'reps', delta: number) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== idx) return e
      if (field === 'weight') {
        const next = Math.round((e.pendingWeight + delta) * 10) / 10
        return { ...e, pendingWeight: Math.max(0, next) }
      }
      return { ...e, pendingReps: Math.max(1, e.pendingReps + delta) }
    }))
  }, [])

  const handleAddExercise = useCallback(async (exercise: FitnessExercise) => {
    const already = entries.some(e => e.exercise.id === exercise.id)
    if (already) { setShowAddExercise(false); return }
    const prevMap = await getPrevSessionSetsBulk([exercise.name])
    const prev = prevMap.get(exercise.name) ?? []
    const splitEx: SplitExercise = { ...exercise, target_sets: 3, target_reps: '8-12' }
    setEntries(p => [...p, {
      exercise: splitEx,
      savedSets: [],
      prevSets: prev,
      pendingWeight: prev[0]?.weight_kg ?? 60,
      pendingReps: prev[0]?.reps ?? 10,
      isExpanded: true,
    }])
    setShowAddExercise(false)
    setExerciseSearch('')
  }, [entries])

  const handleComplete = useCallback(async () => {
    if (!session) return
    const mins = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current.getTime()) / 60000)
      : null
    await updateSession(session.id, { is_completed: true, duration_min: mins })
    setStep('select'); setSession(null); setEntries([])
  }, [session])

  const handleCancel = useCallback(async () => {
    if (session) await deleteSession(session.id)
    setStep('select'); setSession(null); setEntries([])
  }, [session])

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-gray-400 text-sm">불러오는 중...</div>
  }

  if (!program) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Dumbbell size={40} className="mx-auto mb-3 text-gray-300" />
        <p className="font-medium text-gray-600">활성 프로그램이 없습니다</p>
        <p className="text-sm mt-1">⚙️ 프로그램 탭에서 프로그램을 만들고 활성화하세요.</p>
      </div>
    )
  }

  if (step === 'select') {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">{program.name}</p>
          <h2 className="text-lg font-bold text-gray-900">오늘 어떤 분할을 하실 건가요?</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {splits.map(split => (
            <button
              key={split.id}
              onClick={() => handleSelectSplit(split)}
              disabled={isSaving}
              className="p-5 rounded-2xl border-2 border-gray-200 bg-white text-left hover:border-blue-400 hover:bg-blue-50 active:scale-95 transition-all disabled:opacity-50 min-h-[72px]"
            >
              <span className="block text-sm font-bold text-gray-800 break-keep">{split.name}</span>
            </button>
          ))}
        </div>
        {isSaving && <p className="text-center text-xs text-gray-400">세션 시작 중...</p>}
      </div>
    )
  }

  const filteredEx = allExercises.filter(ex =>
    ex.name.includes(exerciseSearch) && !entries.some(e => e.exercise.id === ex.id)
  )

  return (
    <div className="space-y-3 pb-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between bg-white py-2">
        <div>
          <p className="text-xs text-gray-400">{session?.date}</p>
          <h2 className="text-base font-bold text-gray-900">{session?.split_name}</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCancel} className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 active:bg-gray-50">
            취소
          </button>
          <button onClick={handleComplete} className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold active:bg-green-700">
            완료 ✓
          </button>
        </div>
      </div>

      {/* 운동 카드 목록 */}
      {entries.map((entry, idx) => (
        <div key={entry.exercise.id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-4 text-left"
            onClick={() => setEntries(prev => prev.map((e, i) => i === idx ? { ...e, isExpanded: !e.isExpanded } : e))}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">{entry.exercise.name}</span>
              {entry.exercise.is_compound && (
                <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-medium">컴파운드</span>
              )}
              {entry.savedSets.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">{entry.savedSets.length}세트 완료</span>
              )}
            </div>
            {entry.isExpanded ? <ChevronUp size={18} className="text-gray-400 shrink-0" /> : <ChevronDown size={18} className="text-gray-400 shrink-0" />}
          </button>

          {entry.isExpanded && (
            <div className="border-t border-gray-100 p-4 space-y-3">
              {/* 목표 가이드 */}
              <div className="flex items-center gap-2 text-xs bg-blue-50 rounded-xl px-3 py-2">
                <span className="text-blue-500 font-semibold shrink-0">목표</span>
                <span className="text-blue-700 font-mono font-bold">
                  {entry.exercise.target_sets}세트 × {entry.exercise.target_reps}회
                </span>
                {entry.savedSets.length > 0 && (
                  <span className="ml-auto text-blue-400">
                    {entry.savedSets.length}/{entry.exercise.target_sets} 완료
                  </span>
                )}
              </div>

              {entry.prevSets.length > 0 && (
                <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-2.5 leading-relaxed">
                  <span className="font-medium">지난번:</span>{' '}
                  {entry.prevSets.map(s => `${s.weight_kg}×${s.reps}`).join(', ')}
                  {' '}·{' '}추정 1RM {Math.max(...entry.prevSets.map(s => calc1RM(s.weight_kg, s.reps)))}kg
                </div>
              )}

              {entry.savedSets.length > 0 && (
                <div className="space-y-1.5">
                  {entry.savedSets.map(s => (
                    <div key={s.id} className="flex items-center justify-between text-sm px-3 py-2 bg-green-50 rounded-xl">
                      <span className="text-gray-500 w-12 text-xs">{s.set_number}세트</span>
                      <span className="font-bold text-gray-800 flex-1 text-center">{s.weight_kg}kg × {s.reps}회</span>
                      <span className="text-xs text-gray-400 w-20 text-right">~{calc1RM(s.weight_kg, s.reps)}kg</span>
                      <button onClick={() => handleDeleteSet(idx, s.id)} className="ml-2 p-1 text-gray-300 hover:text-red-400 active:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 pt-1">
                <p className="text-xs text-gray-500 font-medium">{entry.savedSets.length + 1}번째 세트 입력</p>
                <div className="flex items-end gap-4">
                  <Stepper
                    label="무게 (kg)"
                    value={entry.pendingWeight}
                    step={2.5}
                    onDecrement={() => updatePending(idx, 'weight', -2.5)}
                    onIncrement={() => updatePending(idx, 'weight', 2.5)}
                    format={v => v.toFixed(1)}
                  />
                  <Stepper
                    label="횟수"
                    value={entry.pendingReps}
                    step={1}
                    onDecrement={() => updatePending(idx, 'reps', -1)}
                    onIncrement={() => updatePending(idx, 'reps', 1)}
                    format={v => `${v}회`}
                  />
                </div>
                <button
                  onClick={() => handleAddSet(idx)}
                  disabled={isSaving}
                  className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm active:bg-blue-700 disabled:opacity-50"
                >
                  세트 저장 +
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={() => setShowAddExercise(true)}
        className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-400 flex items-center justify-center gap-2 active:bg-gray-50"
      >
        <Plus size={16} /> 운동 추가
      </button>

      {/* 운동 추가 오버레이 */}
      {showAddExercise && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setShowAddExercise(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-bold text-gray-900">운동 추가</span>
              <button onClick={() => setShowAddExercise(false)}><X size={20} className="text-gray-500" /></button>
            </div>
            <div className="px-4 py-2">
              <input
                type="text"
                placeholder="종목 검색..."
                value={exerciseSearch}
                onChange={e => setExerciseSearch(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1 px-2 pb-6">
              {filteredEx.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => handleAddExercise(ex)}
                  className="w-full flex items-center justify-between px-3 py-3.5 rounded-xl hover:bg-gray-50 active:bg-gray-100"
                >
                  <span className="text-sm font-medium text-gray-800">{ex.name}</span>
                  <div className="flex items-center gap-1.5">
                    {ex.is_compound && <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded">컴파운드</span>}
                    <span className="text-xs text-gray-400">{ex.muscle_group}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
