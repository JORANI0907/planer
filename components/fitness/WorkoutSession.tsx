'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Plus, X, Trash2, Dumbbell, Play, Square } from 'lucide-react'
import type { FitnessExercise, FitnessProgram, FitnessProgramSplit, FitnessSession, FitnessSet, SplitExercise } from '@/lib/fitness-types'
import { calc1RM, getTodayKey } from '@/lib/fitness-types'
import {
  getActiveProgram, getSplitsByProgram, getExercisesBySplit,
  getPrevSessionSetsBulk, createSession, updateSession,
  deleteSession, createSet, deleteSet, getExercises, getProfile,
} from '@/lib/fitness-api'

const DRAFT_KEY = 'fitness-session-draft'
const TIMER_DEFAULT = 60

// ─── 적정 무게 추천 ───────────────────────────────────────────

const GOAL_INTENSITY: Record<string, number> = {
  '근비대': 0.85,
  '린벌크': 0.88,
  '컷팅':  0.78,
  '유지':  0.82,
}

function parseTargetRepsMid(targetReps: string): number {
  const m = targetReps.match(/^(\d+)(?:-(\d+))?$/)
  if (!m) return 10
  const lo = parseInt(m[1], 10)
  const hi = m[2] ? parseInt(m[2], 10) : lo
  return Math.round((lo + hi) / 2)
}

function calcRecommendedWeight(oneRM: number, targetReps: string, goal: string): number | null {
  if (oneRM <= 0) return null
  const reps = parseTargetRepsMid(targetReps)
  const theoreticalMax = oneRM / (1 + reps / 30)
  const factor = GOAL_INTENSITY[goal] ?? 0.85
  return Math.round(theoreticalMax * factor / 2.5) * 2.5
}

interface ExerciseEntry {
  exercise: SplitExercise
  savedSets: FitnessSet[]
  prevSets: FitnessSet[]
  pendingWeight: number
  pendingReps: number
  isExpanded: boolean
}

interface SessionDraft {
  session: FitnessSession
  startTime: number
  entries: ExerciseEntry[]
}

function saveDraft(session: FitnessSession, entries: ExerciseEntry[], startMs: number | null) {
  try {
    const d: SessionDraft = { session, entries, startTime: startMs ?? Date.now() }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
  } catch {}
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY) } catch {}
}

function loadDraft(): SessionDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as SessionDraft) : null
  } catch { return null }
}

// ─── Stepper ─────────────────────────────────────────────────

function Stepper({
  value, label, onDecrement, onIncrement, format, step,
}: {
  value: number; label: string; onDecrement: () => void; onIncrement: () => void
  format: (v: number) => string; step: number
}) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <span className="text-[10px] text-gray-400 font-medium">{label}</span>
      <div className="flex items-center gap-1 justify-center">
        <button
          onClick={onDecrement}
          className="w-11 h-11 flex items-center justify-center bg-gray-100 rounded-xl text-xl font-bold active:bg-gray-200 select-none"
        >−</button>
        <span className="w-14 text-center font-mono text-sm font-bold tabular-nums">{format(value)}</span>
        <button
          onClick={onIncrement}
          className="w-11 h-11 flex items-center justify-center bg-gray-100 rounded-xl text-xl font-bold active:bg-gray-200 select-none"
        >+</button>
      </div>
    </div>
  )
}

// ─── Rest Timer Bar ───────────────────────────────────────────

function RestTimerBar({
  remainSecs, setRemainSecs, running, onStart, onStop,
}: {
  remainSecs: number
  setRemainSecs: (v: number) => void
  running: boolean
  onStart: () => void
  onStop: () => void
}) {
  const mm = String(Math.floor(remainSecs / 60)).padStart(2, '0')
  const ss = String(remainSecs % 60).padStart(2, '0')

  const adjust = (delta: number) => {
    if (running) return
    setRemainSecs(Math.min(600, Math.max(20, remainSecs + delta)))
  }

  return (
    <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
      <div className="max-w-lg mx-auto flex items-center px-4 py-3 gap-3">
        <span className="text-[11px] font-semibold text-gray-400 shrink-0 hidden xs:block">휴식 타이머</span>
        <div className="flex items-center gap-2 flex-1 justify-center">
          <button
            onClick={() => adjust(-20)}
            disabled={running}
            className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-xl text-base font-bold active:bg-gray-200 disabled:opacity-40 select-none"
          >−</button>
          <span className={`font-mono font-black text-2xl w-20 text-center tabular-nums transition-colors ${running ? 'text-blue-600' : 'text-gray-900'}`}>
            {mm}:{ss}
          </span>
          <button
            onClick={() => adjust(20)}
            disabled={running}
            className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-xl text-base font-bold active:bg-gray-200 disabled:opacity-40 select-none"
          >+</button>
        </div>
        {running ? (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold active:bg-red-600 shrink-0"
          >
            <Square size={12} fill="currentColor" />
            종료
          </button>
        ) : (
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold active:bg-blue-700 shrink-0"
          >
            <Play size={12} fill="currentColor" />
            시작
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Timer Complete Overlay ───────────────────────────────────

function TimerCompleteOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/92 flex flex-col items-center justify-center gap-10 px-8 select-none">
      {/* 회전 링 애니메이션 */}
      <div className="relative w-60 h-60 flex items-center justify-center">
        <div
          className="absolute inset-0 rounded-full border-[8px] border-transparent border-t-green-400 border-r-green-400/50 animate-spin"
          style={{ animationDuration: '1.6s' }}
        />
        <div
          className="absolute inset-4 rounded-full border-[6px] border-transparent border-b-emerald-300 border-l-emerald-300/60 animate-spin"
          style={{ animationDuration: '1s', animationDirection: 'reverse' }}
        />
        <div
          className="absolute inset-9 rounded-full border-4 border-transparent border-t-teal-400 border-r-teal-400/40 animate-spin"
          style={{ animationDuration: '0.65s' }}
        />
        <div className="relative z-10 text-center">
          <p className="text-5xl font-black text-green-400 leading-none tracking-tight">완료!</p>
          <p className="text-gray-400 text-sm mt-2 font-medium">휴식 종료</p>
        </div>
      </div>

      <div className="text-center space-y-2">
        <p className="text-white text-xl font-bold">운동 시작할 준비 됐나요?</p>
        <p className="text-gray-400 text-sm">다음 세트를 진행하세요 💪</p>
      </div>

      <button
        onClick={onClose}
        className="w-56 py-5 bg-green-500 text-white text-2xl font-black rounded-3xl active:bg-green-600 shadow-2xl shadow-green-500/30 active:scale-95 transition-transform"
      >
        확인 ✓
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────

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
  const [userGoal, setUserGoal] = useState<string>('근비대')

  // 타이머 상태
  const [timerSecs, setTimerSecs] = useState(TIMER_DEFAULT)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerComplete, setTimerComplete] = useState(false)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 프로그램 로드 + 드래프트 복원
  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const [prog, allEx, profile] = await Promise.all([getActiveProgram(), getExercises(), getProfile()])
        setAllExercises(allEx)
        if (profile?.goal) setUserGoal(profile.goal)
        if (prog) {
          const sp = await getSplitsByProgram(prog.id)
          setProgram(prog)
          setSplits(sp)
        }
        const draft = loadDraft()
        if (draft) {
          setSession(draft.session)
          setEntries(draft.entries)
          startTimeRef.current = new Date(draft.startTime)
          setStep('recording')
        }
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  // 세션 드래프트 자동 저장
  useEffect(() => {
    if (step !== 'recording' || !session) return
    saveDraft(session, entries, startTimeRef.current?.getTime() ?? null)
  }, [entries, session, step])

  // 타이머 카운트다운
  useEffect(() => {
    if (!timerRunning) return
    timerIntervalRef.current = setInterval(() => {
      setTimerSecs(prev => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current!)
          setTimerRunning(false)
          setTimerComplete(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current) }
  }, [timerRunning])

  // 언마운트 시 타이머 정리
  useEffect(() => () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current) }, [])

  const handleStartTimer = useCallback(() => {
    if (timerSecs <= 0) { setTimerSecs(TIMER_DEFAULT); return }
    setTimerRunning(true)
  }, [timerSecs])

  const handleStopTimer = useCallback(() => {
    setTimerRunning(false)
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    setTimerSecs(TIMER_DEFAULT)
  }, [])

  const handleCloseComplete = useCallback(() => {
    setTimerComplete(false)
    setTimerSecs(TIMER_DEFAULT)
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
      const newEntries = exercises.map(ex => {
        const prev = prevMap.get(ex.name) ?? []
        return {
          exercise: ex,
          savedSets: [],
          prevSets: prev,
          pendingWeight: prev[0]?.weight_kg ?? 60,
          pendingReps: prev[0]?.reps ?? 10,
          isExpanded: true,
        }
      })
      setSession(newSession)
      setEntries(newEntries)
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

  const applyRecommended = useCallback((idx: number, weight: number) => {
    setEntries(prev => prev.map((e, i) => i !== idx ? e : { ...e, pendingWeight: weight }))
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
    clearDraft()
    setStep('select'); setSession(null); setEntries([])
  }, [session])

  const handleCancel = useCallback(async () => {
    if (session) await deleteSession(session.id)
    clearDraft()
    setStep('select'); setSession(null); setEntries([])
  }, [session])

  // ─── 렌더링 ───────────────────────────────────────────────────

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
    <>
      {timerComplete && <TimerCompleteOverlay onClose={handleCloseComplete} />}

      {/* 타이머 바 공간 + 하단 네비 공간 확보 */}
      <div className="space-y-3 pb-36">
        {/* 헤더 */}
        <div className="flex items-center justify-between bg-white py-2">
          <div className="min-w-0 flex-1 mr-3">
            <p className="text-xs text-gray-400">{session?.date}</p>
            <h2 className="text-base font-bold text-gray-900 truncate">{session?.split_name}</h2>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleCancel}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 active:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleComplete}
              className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold active:bg-green-700"
            >
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
              <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1 mr-2">
                <span className="font-semibold text-gray-900 break-keep">{entry.exercise.name}</span>
                {entry.exercise.is_compound && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-medium shrink-0">컴파운드</span>
                )}
                {entry.savedSets.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium shrink-0">{entry.savedSets.length}세트 완료</span>
                )}
              </div>
              {entry.isExpanded
                ? <ChevronUp size={18} className="text-gray-400 shrink-0" />
                : <ChevronDown size={18} className="text-gray-400 shrink-0" />}
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
                    <span className="ml-auto text-blue-400 shrink-0">
                      {entry.savedSets.length}/{entry.exercise.target_sets} 완료
                    </span>
                  )}
                </div>

                {entry.prevSets.length > 0 && (() => {
                  const oneRM = Math.max(...entry.prevSets.map(s => calc1RM(s.weight_kg, s.reps)))
                  const rec = calcRecommendedWeight(oneRM, entry.exercise.target_reps, userGoal)
                  return (
                    <>
                      {/* 추천 무게 */}
                      {rec !== null && (
                        <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                          <span className="text-amber-500 shrink-0">💡</span>
                          <span className="text-amber-700 font-semibold shrink-0">추천 무게</span>
                          <span className="font-black text-amber-900 font-mono text-sm">{rec}kg</span>
                          <span className="text-amber-400 text-[10px] min-w-0 truncate">
                            1RM {oneRM}kg · {userGoal} 기준
                          </span>
                          <button
                            onClick={() => applyRecommended(idx, rec)}
                            className="ml-auto shrink-0 text-[10px] px-2 py-1 bg-amber-500 text-white rounded-lg font-bold active:bg-amber-600"
                          >
                            적용
                          </button>
                        </div>
                      )}
                      {/* 지난 세션 */}
                      <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-2.5 leading-relaxed">
                        <span className="font-medium">지난번:</span>{' '}
                        {entry.prevSets.map(s => `${s.weight_kg}×${s.reps}`).join(', ')}
                        {' '}·{' '}추정 1RM {oneRM}kg
                      </div>
                    </>
                  )
                })()}

                {entry.savedSets.length > 0 && (
                  <div className="space-y-1.5">
                    {entry.savedSets.map(s => (
                      <div key={s.id} className="flex items-center text-sm px-3 py-2 bg-green-50 rounded-xl gap-2">
                        <span className="text-gray-500 text-xs w-10 shrink-0">{s.set_number}세트</span>
                        <span className="font-bold text-gray-800 flex-1 text-center">{s.weight_kg}kg × {s.reps}회</span>
                        <span className="text-xs text-gray-400 shrink-0">~{calc1RM(s.weight_kg, s.reps)}kg</span>
                        <button
                          onClick={() => handleDeleteSet(idx, s.id)}
                          className="p-1 text-gray-300 hover:text-red-400 active:text-red-500 shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3 pt-1">
                  <p className="text-xs text-gray-500 font-medium">{entry.savedSets.length + 1}번째 세트 입력</p>
                  <div className="flex items-end gap-2">
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
                <button onClick={() => setShowAddExercise(false)}>
                  <X size={20} className="text-gray-500" />
                </button>
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
                      {ex.is_compound && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded">컴파운드</span>
                      )}
                      <span className="text-xs text-gray-400">{ex.muscle_group}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 하단 고정 휴식 타이머 바 */}
      <RestTimerBar
        remainSecs={timerSecs}
        setRemainSecs={setTimerSecs}
        running={timerRunning}
        onStart={handleStartTimer}
        onStop={handleStopTimer}
      />
    </>
  )
}
