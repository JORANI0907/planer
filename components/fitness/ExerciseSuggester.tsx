'use client'

import { useState, useEffect } from 'react'
import { Loader2, Sparkles, Plus, CheckCircle, AlertCircle } from 'lucide-react'
import type { SuggestedExercise, SuggestResult } from '@/app/api/fitness/coach/suggest-exercises/route'
import type { ExerciseMuscleGroup } from '@/lib/fitness-types'
import { getExercises, createExercise } from '@/lib/fitness-api'

const MUSCLE_COLOR: Record<string, string> = {
  가슴: 'bg-rose-100 text-rose-700',
  등: 'bg-sky-100 text-sky-700',
  어깨: 'bg-violet-100 text-violet-700',
  하체: 'bg-emerald-100 text-emerald-700',
  삼두: 'bg-orange-100 text-orange-700',
  이두: 'bg-amber-100 text-amber-700',
  복근: 'bg-teal-100 text-teal-700',
  기타: 'bg-gray-100 text-gray-600',
}

export default function ExerciseSuggester() {
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SuggestResult | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [savedNames, setSavedNames] = useState<string[]>([])
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set())

  useEffect(() => {
    getExercises()
      .then((exs) => setExistingNames(new Set(exs.map((e) => e.name.toLowerCase()))))
      .catch(() => {})
  }, [])

  const handleSuggest = async () => {
    if (!description.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    setSelected(new Set())
    setSavedNames([])
    try {
      const res = await fetch('/api/fitness/coach/suggest-exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? '추천 실패')
      }
      const data: SuggestResult = await res.json()
      setResult(data)
      // 이미 없는 종목만 기본 선택
      const initialSelected = new Set<number>()
      data.exercises.forEach((ex, i) => {
        if (!existingNames.has(ex.name.toLowerCase())) initialSelected.add(i)
      })
      setSelected(initialSelected)
    } catch (e) {
      setError(e instanceof Error ? e.message : '종목 추천에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const handleAdd = async () => {
    if (!result || selected.size === 0) return
    setSaving(true)
    try {
      const toAdd = result.exercises.filter((_, i) => selected.has(i))
      const names: string[] = []
      for (const ex of toAdd) {
        if (existingNames.has(ex.name.toLowerCase())) continue
        await createExercise({
          name: ex.name,
          muscle_group: ex.muscle_group as ExerciseMuscleGroup,
          is_compound: ex.is_compound,
          sort_order: 999,
        })
        names.push(ex.name)
        setExistingNames((prev) => new Set([...prev, ex.name.toLowerCase()]))
      }
      setSavedNames(names)
      setSelected(new Set())
    } catch {
      setError('종목 추가에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const selectedNew = result
    ? result.exercises.filter((ex, i) => selected.has(i) && !existingNames.has(ex.name.toLowerCase()))
    : []

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-100 rounded-2xl px-3 py-2">
        <p className="text-xs text-green-700">운동을 설명하면 AI가 종목을 추천하고 목록에 추가합니다</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">운동 설명</p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="예: 가슴 안쪽을 집중적으로 자극하는 운동&#10;예: 케이블로 할 수 있는 이두 운동&#10;예: 런지와 비슷한데 균형 잡기 어려운 하체 운동"
          rows={3}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-200 resize-none text-gray-800 placeholder-gray-400 leading-relaxed"
        />
      </div>

      <button
        onClick={handleSuggest}
        disabled={loading || !description.trim()}
        className="w-full py-3 bg-green-600 text-white rounded-2xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2 active:bg-green-700 transition-colors"
      >
        {loading
          ? <><Loader2 size={16} className="animate-spin" /> AI 분석 중...</>
          : <><Sparkles size={16} /> 종목 추천받기</>
        }
      </button>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-16 bg-gray-100 rounded-2xl" />
          <div className="h-16 bg-gray-100 rounded-2xl" />
          <div className="h-16 bg-gray-100 rounded-2xl" />
        </div>
      )}

      {savedNames.length > 0 && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
          <CheckCircle size={14} className="text-green-600 shrink-0 mt-0.5" />
          <p className="text-xs text-green-800 leading-relaxed">
            <span className="font-semibold">{savedNames.join(', ')}</span> 이(가) 종목 목록에 추가되었습니다
          </p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-3">
          {result.summary && (
            <div className="bg-gray-50 rounded-xl px-3 py-2">
              <p className="text-xs text-gray-600 leading-relaxed">{result.summary}</p>
            </div>
          )}

          <div className="space-y-2">
            {result.exercises.map((ex, i) => {
              const alreadyExists = existingNames.has(ex.name.toLowerCase())
              const isSelected = selected.has(i)

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => !alreadyExists && toggleSelect(i)}
                  disabled={alreadyExists}
                  className={`w-full text-left p-3 rounded-2xl border transition-all ${
                    alreadyExists
                      ? 'bg-gray-50 border-gray-100 opacity-60 cursor-default'
                      : isSelected
                      ? 'bg-green-50 border-green-300 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-green-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{ex.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${MUSCLE_COLOR[ex.muscle_group] ?? MUSCLE_COLOR['기타']}`}>
                          {ex.muscle_group}
                        </span>
                        {ex.is_compound && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700">
                            복합
                          </span>
                        )}
                        {alreadyExists && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-500">
                            이미 있음
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{ex.reason}</p>
                    </div>
                    {!alreadyExists && (
                      <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'border-green-500 bg-green-500' : 'border-gray-300'
                      }`}>
                        {isSelected && <CheckCircle size={12} className="text-white fill-white" />}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {selectedNew.length > 0 && (
            <button
              onClick={handleAdd}
              disabled={saving}
              className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2 active:bg-green-700 transition-colors"
            >
              {saving
                ? <><Loader2 size={14} className="animate-spin" /> 추가 중...</>
                : <><Plus size={14} /> 선택한 {selectedNew.length}개 종목 추가하기</>
              }
            </button>
          )}
        </div>
      )}
    </div>
  )
}
