'use client'

import { useState, useEffect } from 'react'
import {
  Dumbbell, Loader2, Save, CheckCircle, Sparkles,
  ThumbsUp, AlertCircle, Zap, ChevronDown, ChevronUp, Trash2, PlusCircle,
} from 'lucide-react'
import type { ExerciseMuscleGroup, FitnessFeedback, FeedbackType, FeedbackFocus } from '@/lib/fitness-types'
import {
  getExercises, createProgram, createSplit, addExerciseToSplit, createExercise,
  saveFeedback, getFeedbacks, deleteFeedback,
} from '@/lib/fitness-api'
import type { GeneratedProgram } from '@/app/api/fitness/coach/generate-program/route'
import type { GeneratedFeedback } from '@/app/api/fitness/coach/generate-feedback/route'
import ExerciseSuggester from './ExerciseSuggester'

// ─── 타입 ─────────────────────────────────────────────────────

type Tab = 'program' | 'feedback' | 'suggest'

type ProgramForm = {
  goal: string
  weekly_days: number
  split_type: string
  focus_muscle: string
  duration_weeks: number
  extra_note: string
}

type FeedbackForm = {
  type: FeedbackType
  focus: FeedbackFocus
  extra_note: string
}

// ─── 상수 ─────────────────────────────────────────────────────

const GOAL_OPTIONS = ['근비대', '린벌크', '컷팅', '체력향상']
const WEEKLY_DAYS = [3, 4, 5, 6]
const SPLIT_OPTIONS = ['자동추천', '상하체', 'PPL', '3분할', '4분할']
const FOCUS_OPTIONS = ['전체', '가슴', '등', '하체', '어깨']
const DURATION_OPTIONS = [4, 8, 12]

const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  today: '오늘 운동',
  week: '이번 주 총평',
  trend: '전체 트렌드',
}

const FEEDBACK_FOCUS_LABELS: Record<FeedbackFocus, string> = {
  overall: '전반적',
  volume: '볼륨 분석',
  strength: '근력 추세',
  fatigue: '피로 관리',
}

const DEFAULT_PROGRAM_FORM: ProgramForm = {
  goal: '근비대',
  weekly_days: 5,
  split_type: '자동추천',
  focus_muscle: '전체',
  duration_weeks: 8,
  extra_note: '',
}

const DEFAULT_FEEDBACK_FORM: FeedbackForm = {
  type: 'week',
  focus: 'overall',
  extra_note: '',
}

// ─── 헬퍼 ─────────────────────────────────────────────────────

function inferMuscleGroup(name: string): ExerciseMuscleGroup {
  if (/벤치|체스트|가슴|플라이/.test(name)) return '가슴'
  if (/데드|로우|풀업|랫|등/.test(name)) return '등'
  if (/오버헤드|숄더|어깨|레터럴|프론트/.test(name)) return '어깨'
  if (/스쿼트|레그|하체|런지|힙|글루트/.test(name)) return '하체'
  if (/트라이셉|삼두/.test(name)) return '삼두'
  if (/바이셉|이두|컬/.test(name)) return '이두'
  if (/크런치|플랭크|복근/.test(name)) return '복근'
  return '기타'
}

const COMPOUND_PATTERN = /벤치프레스|데드리프트|스쿼트|오버헤드프레스|바벨로우|풀업|딥스/

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

// ─── 선택 버튼 ────────────────────────────────────────────────

function OptionChip({
  label, selected, onClick,
}: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
        selected
          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
      }`}
    >
      {label}
    </button>
  )
}

// ─── 프로그램 결과 카드 ───────────────────────────────────────

function ProgramResultCard({
  data, onSave,
}: { data: GeneratedProgram; onSave: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(); setSaved(true) } finally { setSaving(false) }
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Dumbbell size={15} className="text-blue-600" />
        <span className="font-bold text-gray-900 text-sm">{data.name}</span>
      </div>
      {data.description && <p className="text-xs text-gray-500">{data.description}</p>}
      {data.coaching_note && (
        <div className="bg-blue-100/60 rounded-xl px-3 py-2">
          <p className="text-xs text-blue-800 leading-relaxed">{data.coaching_note}</p>
        </div>
      )}
      <div className="space-y-2">
        {data.splits.map((split, i) => (
          <div key={i} className="bg-white rounded-xl p-3 space-y-1.5">
            <p className="text-xs font-semibold text-gray-700">{split.name}</p>
            <div className="flex flex-col gap-1">
              {split.exercises.map((ex, j) => (
                <div key={j} className="flex items-center justify-between text-[11px] px-2 py-1 bg-blue-50 rounded-lg">
                  <span className="text-blue-800 font-medium">{ex.name}</span>
                  <span className="text-blue-500 font-mono shrink-0 ml-2">
                    {ex.target_sets}세트 × {ex.target_reps}회
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {saved ? (
        <div className="flex items-center gap-2 text-green-600 text-sm font-medium py-1">
          <CheckCircle size={14} /> 프로그램 탭에 저장되었습니다 ✓
        </div>
      ) : (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold active:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? '저장 중...' : '프로그램 탭에 저장하기'}
        </button>
      )}
    </div>
  )
}

// ─── 피드백 결과 카드 ─────────────────────────────────────────

function FeedbackResultCard({
  data, onSave,
}: { data: GeneratedFeedback; onSave: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(); setSaved(true) } finally { setSaving(false) }
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-4 space-y-3">
      <div className="bg-white rounded-xl px-3 py-2.5">
        <p className="text-sm text-gray-800 leading-relaxed font-medium">{data.summary}</p>
      </div>
      {data.good_points.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-green-700 flex items-center gap-1">
            <ThumbsUp size={11} /> 잘한 점
          </p>
          {data.good_points.map((p, i) => (
            <div key={i} className="flex gap-2 bg-green-50 rounded-xl px-3 py-2">
              <span className="text-green-500 text-xs shrink-0 mt-0.5">✓</span>
              <p className="text-xs text-green-800 leading-relaxed">{p}</p>
            </div>
          ))}
        </div>
      )}
      {data.improve_points.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-orange-700 flex items-center gap-1">
            <AlertCircle size={11} /> 개선할 점
          </p>
          {data.improve_points.map((p, i) => (
            <div key={i} className="flex gap-2 bg-orange-50 rounded-xl px-3 py-2">
              <span className="text-orange-400 text-xs shrink-0 mt-0.5">!</span>
              <p className="text-xs text-orange-800 leading-relaxed">{p}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 bg-indigo-50 rounded-xl px-3 py-2.5 items-start">
        <Zap size={13} className="text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-xs text-indigo-800 leading-relaxed font-medium">{data.next_action}</p>
      </div>
      {saved ? (
        <div className="flex items-center gap-2 text-green-600 text-sm font-medium py-1">
          <CheckCircle size={14} /> 피드백이 저장되었습니다 ✓
        </div>
      ) : (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold active:bg-purple-700 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? '저장 중...' : '피드백 저장하기'}
        </button>
      )}
    </div>
  )
}

// ─── 저장된 피드백 목록 ──────────────────────────────────────

function FeedbackHistory({
  feedbacks, onDelete,
}: { feedbacks: FitnessFeedback[]; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  if (feedbacks.length === 0) return null

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-500 font-medium hover:text-gray-700"
      >
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        저장된 피드백 {feedbacks.length}개
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {feedbacks.map(fb => (
            <div key={fb.id} className="bg-white border border-gray-100 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                    {FEEDBACK_TYPE_LABELS[fb.type]}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">
                    {FEEDBACK_FOCUS_LABELS[fb.focus]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">{formatDate(fb.created_at)}</span>
                  <button
                    onClick={() => onDelete(fb.id)}
                    className="p-1 text-gray-300 hover:text-red-400 rounded-lg transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed line-clamp-2">{fb.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────

export default function FitnessCoach({ onTabChange }: { onTabChange?: (tab: string) => void } = {}) {
  const [activeTab, setActiveTab] = useState<Tab>('program')

  // 프로그램 생성 상태
  const [programForm, setProgramForm] = useState<ProgramForm>(DEFAULT_PROGRAM_FORM)
  const [programResult, setProgramResult] = useState<GeneratedProgram | null>(null)
  const [programLoading, setProgramLoading] = useState(false)
  const [programError, setProgramError] = useState('')

  // 피드백 상태
  const [feedbackForm, setFeedbackForm] = useState<FeedbackForm>(DEFAULT_FEEDBACK_FORM)
  const [feedbackResult, setFeedbackResult] = useState<GeneratedFeedback | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')
  const [feedbackHistory, setFeedbackHistory] = useState<FitnessFeedback[]>([])

  useEffect(() => {
    getFeedbacks().then(setFeedbackHistory).catch(() => {})
  }, [])

  // ─ 프로그램 생성 ─
  const handleGenerateProgram = async () => {
    setProgramLoading(true)
    setProgramError('')
    setProgramResult(null)
    try {
      const res = await fetch('/api/fitness/coach/generate-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(programForm),
      })
      if (!res.ok) throw new Error()
      const data: GeneratedProgram = await res.json()
      setProgramResult(data)
    } catch {
      setProgramError('프로그램 생성에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setProgramLoading(false)
    }
  }

  const handleSaveProgram = async () => {
    if (!programResult) return
    const allExercises = await getExercises()
    const exMap = new Map(allExercises.map(e => [e.name.toLowerCase(), e]))
    const program = await createProgram({ name: programResult.name, description: programResult.description, is_active: false })
    for (let i = 0; i < programResult.splits.length; i++) {
      const split = programResult.splits[i]
      const newSplit = await createSplit({ program_id: program.id, name: split.name, sort_order: i })
      for (let j = 0; j < split.exercises.length; j++) {
        const exData = split.exercises[j]
        let exercise = exMap.get(exData.name.toLowerCase())
        if (!exercise) {
          exercise = await createExercise({
            name: exData.name,
            muscle_group: inferMuscleGroup(exData.name),
            is_compound: COMPOUND_PATTERN.test(exData.name),
            sort_order: 999,
          })
          exMap.set(exData.name.toLowerCase(), exercise)
        }
        await addExerciseToSplit(newSplit.id, exercise.id, j, exData.target_sets, exData.target_reps)
      }
    }
    setTimeout(() => onTabChange?.('program'), 1500)
  }

  // ─ 피드백 생성 ─
  const handleGenerateFeedback = async () => {
    setFeedbackLoading(true)
    setFeedbackError('')
    setFeedbackResult(null)
    try {
      const res = await fetch('/api/fitness/coach/generate-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackForm),
      })
      if (!res.ok) throw new Error()
      const data: GeneratedFeedback = await res.json()
      setFeedbackResult(data)
    } catch {
      setFeedbackError('피드백 생성에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setFeedbackLoading(false)
    }
  }

  const handleSaveFeedback = async () => {
    if (!feedbackResult) return
    const content = [
      feedbackResult.summary,
      ...feedbackResult.good_points,
      ...feedbackResult.improve_points,
      feedbackResult.next_action,
    ].join('\n')
    const saved = await saveFeedback(feedbackForm.type, feedbackForm.focus, content)
    setFeedbackHistory(prev => [saved, ...prev])
  }

  const handleDeleteFeedback = async (id: string) => {
    await deleteFeedback(id).catch(() => {})
    setFeedbackHistory(prev => prev.filter(f => f.id !== id))
  }

  // ─ 렌더링 ─
  return (
    <div className="space-y-4">

      {/* 탭 */}
      <div className="flex gap-1.5 bg-gray-100 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab('program')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'program'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Dumbbell size={13} />
          프로그램
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'feedback'
              ? 'bg-white text-purple-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Sparkles size={13} />
          피드백
        </button>
        <button
          onClick={() => setActiveTab('suggest')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'suggest'
              ? 'bg-white text-green-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <PlusCircle size={13} />
          종목 생성
        </button>
      </div>

      {/* 프로그램 생성 탭 */}
      {activeTab === 'program' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-3 py-2">
            <p className="text-xs text-blue-700">내 정보(체중·경력·1RM)가 자동으로 반영됩니다</p>
          </div>

          <FormSection label="목표">
            <div className="flex flex-wrap gap-2">
              {GOAL_OPTIONS.map(opt => (
                <OptionChip key={opt} label={opt} selected={programForm.goal === opt}
                  onClick={() => setProgramForm(f => ({ ...f, goal: opt }))} />
              ))}
            </div>
          </FormSection>

          <FormSection label="주 운동 일수">
            <div className="flex gap-2">
              {WEEKLY_DAYS.map(d => (
                <OptionChip key={d} label={`${d}일`} selected={programForm.weekly_days === d}
                  onClick={() => setProgramForm(f => ({ ...f, weekly_days: d }))} />
              ))}
            </div>
          </FormSection>

          <FormSection label="분할 방식">
            <div className="flex flex-wrap gap-2">
              {SPLIT_OPTIONS.map(opt => (
                <OptionChip key={opt} label={opt} selected={programForm.split_type === opt}
                  onClick={() => setProgramForm(f => ({ ...f, split_type: opt }))} />
              ))}
            </div>
          </FormSection>

          <FormSection label="집중 부위">
            <div className="flex flex-wrap gap-2">
              {FOCUS_OPTIONS.map(opt => (
                <OptionChip key={opt} label={opt} selected={programForm.focus_muscle === opt}
                  onClick={() => setProgramForm(f => ({ ...f, focus_muscle: opt }))} />
              ))}
            </div>
          </FormSection>

          <FormSection label="기간">
            <div className="flex gap-2">
              {DURATION_OPTIONS.map(d => (
                <OptionChip key={d} label={`${d}주`} selected={programForm.duration_weeks === d}
                  onClick={() => setProgramForm(f => ({ ...f, duration_weeks: d }))} />
              ))}
            </div>
          </FormSection>

          <FormSection label="추가 요청 (선택)">
            <textarea
              value={programForm.extra_note}
              onChange={e => setProgramForm(f => ({ ...f, extra_note: e.target.value }))}
              placeholder="예: 홈짐이라 바벨만 있음, 어깨 부상 있음 등"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 resize-none text-gray-800 placeholder-gray-400"
            />
          </FormSection>

          <button
            onClick={handleGenerateProgram}
            disabled={programLoading}
            className="w-full py-3 bg-blue-600 text-white rounded-2xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2 active:bg-blue-700 transition-colors"
          >
            {programLoading
              ? <><Loader2 size={16} className="animate-spin" /> AI 분석 중...</>
              : <><Sparkles size={16} /> 프로그램 생성하기</>
            }
          </button>

          {programError && (
            <p className="text-xs text-red-500 text-center">{programError}</p>
          )}

          {programLoading && (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-gray-200 rounded-xl w-3/4" />
              <div className="h-24 bg-gray-100 rounded-2xl" />
              <div className="h-24 bg-gray-100 rounded-2xl" />
            </div>
          )}

          {programResult && !programLoading && (
            <ProgramResultCard data={programResult} onSave={handleSaveProgram} />
          )}
        </div>
      )}

      {/* 운동 피드백 탭 */}
      {activeTab === 'feedback' && (
        <div className="space-y-4">
          <div className="bg-purple-50 border border-purple-100 rounded-2xl px-3 py-2">
            <p className="text-xs text-purple-700">운동 기록 데이터를 자동으로 분석합니다</p>
          </div>

          <FormSection label="분석 범위">
            <div className="flex flex-wrap gap-2">
              {(Object.entries(FEEDBACK_TYPE_LABELS) as [FeedbackType, string][]).map(([key, label]) => (
                <OptionChip key={key} label={label} selected={feedbackForm.type === key}
                  onClick={() => setFeedbackForm(f => ({ ...f, type: key }))} />
              ))}
            </div>
          </FormSection>

          <FormSection label="포커스">
            <div className="flex flex-wrap gap-2">
              {(Object.entries(FEEDBACK_FOCUS_LABELS) as [FeedbackFocus, string][]).map(([key, label]) => (
                <OptionChip key={key} label={label} selected={feedbackForm.focus === key}
                  onClick={() => setFeedbackForm(f => ({ ...f, focus: key }))} />
              ))}
            </div>
          </FormSection>

          <FormSection label="추가 메모 (선택)">
            <textarea
              value={feedbackForm.extra_note}
              onChange={e => setFeedbackForm(f => ({ ...f, extra_note: e.target.value }))}
              placeholder="예: 최근 피로감이 심함, 특정 부위가 안 느껴짐 등"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-200 resize-none text-gray-800 placeholder-gray-400"
            />
          </FormSection>

          <button
            onClick={handleGenerateFeedback}
            disabled={feedbackLoading}
            className="w-full py-3 bg-purple-600 text-white rounded-2xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2 active:bg-purple-700 transition-colors"
          >
            {feedbackLoading
              ? <><Loader2 size={16} className="animate-spin" /> 분석 중...</>
              : <><Sparkles size={16} /> 피드백 받기</>
            }
          </button>

          {feedbackError && (
            <p className="text-xs text-red-500 text-center">{feedbackError}</p>
          )}

          {feedbackLoading && (
            <div className="space-y-2 animate-pulse">
              <div className="h-12 bg-gray-100 rounded-2xl" />
              <div className="h-16 bg-green-50 rounded-2xl" />
              <div className="h-16 bg-orange-50 rounded-2xl" />
            </div>
          )}

          {feedbackResult && !feedbackLoading && (
            <FeedbackResultCard data={feedbackResult} onSave={handleSaveFeedback} />
          )}

          <FeedbackHistory feedbacks={feedbackHistory} onDelete={handleDeleteFeedback} />
        </div>
      )}

      {/* 종목 생성 탭 */}
      {activeTab === 'suggest' && <ExerciseSuggester />}
    </div>
  )
}

// ─── 폼 섹션 래퍼 ─────────────────────────────────────────────

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      {children}
    </div>
  )
}
