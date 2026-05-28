'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, CheckCircle, X, Bot, Sparkles, AlertTriangle } from 'lucide-react'
import type { FitnessDietPlan } from '@/lib/fitness-types'
import { DIET_GOALS } from '@/lib/fitness-types'
import { getDietPlan, upsertDietPlan } from '@/lib/fitness-api'

// ─── Form state ───────────────────────────────────────────────

type PlanForm = {
  calories: string
  protein_g: string
  carbs_g: string
  fat_g: string
  water_l: string
  breakfast: string
  lunch: string
  dinner: string
  snack: string
  memo: string
}

const EMPTY_FORM: PlanForm = {
  calories: '0', protein_g: '0', carbs_g: '0', fat_g: '0', water_l: '0',
  breakfast: '', lunch: '', dinner: '', snack: '', memo: '',
}

function formFromPlan(p: FitnessDietPlan): PlanForm {
  return {
    calories:  p.calories.toString(),
    protein_g: p.protein_g.toString(),
    carbs_g:   p.carbs_g.toString(),
    fat_g:     p.fat_g.toString(),
    water_l:   p.water_l.toString(),
    breakfast: p.breakfast ?? '',
    lunch:     p.lunch ?? '',
    dinner:    p.dinner ?? '',
    snack:     p.snack ?? '',
    memo:      p.memo ?? '',
  }
}

// ─── Meal types ───────────────────────────────────────────────

const MEAL_TYPES = [
  { key: 'breakfast' as const, label: '아침', emoji: '🌅', placeholder: '예) 닭가슴살 200g, 현미밥 100g, 계란 2개' },
  { key: 'lunch'     as const, label: '점심', emoji: '☀️', placeholder: '예) 소불고기 150g, 현미밥 200g, 채소 샐러드' },
  { key: 'dinner'    as const, label: '저녁', emoji: '🌙', placeholder: '예) 연어 200g, 고구마 100g, 브로콜리' },
  { key: 'snack'     as const, label: '간식', emoji: '🍎', placeholder: '예) 유청단백질 쉐이크, 바나나 1개, 견과류' },
]

// ─── MacroBar ─────────────────────────────────────────────────

function MacroBar({ label, value, min, max, unit, warn }: {
  label: string; value: number; min: number; max: number; unit: string; warn?: boolean
}) {
  const pct   = Math.min(100, Math.round((value / max) * 100))
  const isLow  = warn && value > 0 && value < min
  const isGood = value >= min && value <= max * 1.1
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className={`font-medium ${isLow ? 'text-red-500' : isGood ? 'text-green-600' : 'text-gray-700'}`}>
          {label} {isLow && '⚠️'}{isGood && value > 0 && ' ✓'}
        </span>
        <span className="text-xs text-gray-500">
          {value}{unit}<span className="text-gray-400"> / {min}~{max}{unit}</span>
        </span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isLow && value > 0 ? 'bg-red-400' : isGood ? 'bg-green-500' : 'bg-blue-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── NumInput ─────────────────────────────────────────────────

function NumInput({ label, value, onChange, unit, step = 1 }: {
  label: string; value: string; onChange: (v: string) => void; unit: string; step?: number
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, Math.round((parseFloat(value || '0') - step) * 10) / 10).toString())}
          className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg font-bold active:bg-gray-200"
        >−</button>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-20 text-center border border-gray-200 rounded-lg py-1.5 text-sm font-mono font-bold"
        />
        <button
          onClick={() => onChange((Math.round((parseFloat(value || '0') + step) * 10) / 10).toString())}
          className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg font-bold active:bg-gray-200"
        >+</button>
        <span className="text-xs text-gray-400 w-8">{unit}</span>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────

export default function DietTracker() {
  const [plan, setPlan]       = useState<FitnessDietPlan | null>(null)
  const [form, setForm]       = useState<PlanForm>(EMPTY_FORM)
  const [editMode, setEditMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving]   = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const loadPlan = useCallback(async () => {
    setIsLoading(true)
    try {
      const p = await getDietPlan()
      setPlan(p)
      if (p) setForm(formFromPlan(p))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadPlan() }, [loadPlan])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const payload = {
        calories:  parseInt(form.calories  || '0'),
        protein_g: parseInt(form.protein_g || '0'),
        carbs_g:   parseInt(form.carbs_g   || '0'),
        fat_g:     parseInt(form.fat_g     || '0'),
        water_l:   parseFloat(form.water_l || '0'),
        breakfast: form.breakfast || undefined,
        lunch:     form.lunch     || undefined,
        dinner:    form.dinner    || undefined,
        snack:     form.snack     || undefined,
        memo:      form.memo      || undefined,
      }
      const saved = await upsertDietPlan(payload, plan?.id)
      setPlan(saved)
      setForm(formFromPlan(saved))
      setEditMode(false)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2500)
    } finally {
      setIsSaving(false)
    }
  }, [form, plan])

  const handleCancel = () => {
    if (plan) setForm(formFromPlan(plan))
    setEditMode(false)
  }

  const caloriesVal = plan?.calories ?? 0
  const proteinVal  = plan?.protein_g ?? 0
  const carbsVal    = plan?.carbs_g ?? 0
  const fatVal      = plan?.fat_g ?? 0
  const waterVal    = plan?.water_l ?? 0
  const hasPlan     = !!plan && caloriesVal > 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-gray-400">식단 플랜 불러오는 중...</p>
      </div>
    )
  }

  // ── 플랜 없음: 빈 상태 ──────────────────────────────────────
  if (!hasPlan && !editMode) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center">
          <Sparkles size={28} className="text-purple-400" />
        </div>
        <div>
          <p className="font-bold text-gray-800 mb-1">아직 식단 플랜이 없어요</p>
          <p className="text-sm text-gray-400 leading-relaxed">
            AI 코치 탭에서 &quot;식단 플랜&quot; 버튼을 눌러<br />
            맞춤 식단을 생성하거나, 직접 입력해보세요.
          </p>
        </div>
        <button
          onClick={() => setEditMode(true)}
          className="mt-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold active:bg-blue-700"
        >
          직접 입력하기
        </button>
      </div>
    )
  }

  // ── 수정 모드 ──────────────────────────────────────────────
  if (editMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">식단 플랜 수정</h3>
          <button onClick={handleCancel} className="p-2 rounded-xl active:bg-gray-100">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-1">
          <h4 className="text-sm font-bold text-gray-700 mb-3">매크로 목표</h4>
          <NumInput label="칼로리"   value={form.calories}  onChange={v => setForm(p => ({ ...p, calories: v }))}  unit="kcal" step={50} />
          <NumInput label="단백질"   value={form.protein_g} onChange={v => setForm(p => ({ ...p, protein_g: v }))} unit="g"    step={5} />
          <NumInput label="탄수화물" value={form.carbs_g}   onChange={v => setForm(p => ({ ...p, carbs_g: v }))}   unit="g"    step={10} />
          <NumInput label="지방"     value={form.fat_g}     onChange={v => setForm(p => ({ ...p, fat_g: v }))}     unit="g"    step={5} />
          <NumInput label="수분"     value={form.water_l}   onChange={v => setForm(p => ({ ...p, water_l: v }))}   unit="L"    step={0.25} />
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <h4 className="text-sm font-bold text-gray-700">식단 구성</h4>
          {MEAL_TYPES.map(meal => (
            <div key={meal.key} className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                <span>{meal.emoji}</span>{meal.label}
              </label>
              <textarea
                value={form[meal.key]}
                onChange={e => setForm(p => ({ ...p, [meal.key]: e.target.value }))}
                placeholder={meal.placeholder}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none placeholder-gray-400 focus:outline-none focus:border-blue-300 transition-colors"
              />
            </div>
          ))}
        </section>

        <div className="flex gap-3 pb-2">
          <button
            onClick={handleCancel}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm active:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm active:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>
    )
  }

  // ── 보기 모드 (기본) ─────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900">내 식단 플랜</h3>
          {plan?.memo && (
            <span className="flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 rounded-full px-2 py-0.5 font-medium">
              <Bot size={10} />AI 코치 생성
            </span>
          )}
          {savedFlash && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle size={12} />저장됨
            </span>
          )}
        </div>
        <button
          onClick={() => setEditMode(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold active:bg-gray-200"
        >
          <Pencil size={12} />수정
        </button>
      </div>

      {/* 매크로 달성률 */}
      <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">일일 매크로 목표</h4>
        {proteinVal > 0 && proteinVal < DIET_GOALS.protein_g.min && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-xl p-2.5">
            <AlertTriangle size={13} />
            <span className="font-medium">단백질 {DIET_GOALS.protein_g.min - proteinVal}g 더 설정이 필요합니다</span>
          </div>
        )}
        <MacroBar label="칼로리"   value={caloriesVal} min={DIET_GOALS.calories.min}  max={DIET_GOALS.calories.max}  unit="kcal" />
        <MacroBar label="단백질"   value={proteinVal}  min={DIET_GOALS.protein_g.min} max={DIET_GOALS.protein_g.max} unit="g" warn />
        <MacroBar label="탄수화물" value={carbsVal}    min={DIET_GOALS.carbs_g.min}   max={DIET_GOALS.carbs_g.max}   unit="g" />
        <MacroBar label="지방"     value={fatVal}      min={DIET_GOALS.fat_g.min}     max={DIET_GOALS.fat_g.max}     unit="g" />
        <MacroBar label="수분"     value={waterVal}    min={DIET_GOALS.water_l.min}   max={DIET_GOALS.water_l.max}   unit="L" />
      </section>

      {/* 식단 구성 */}
      <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">식단 구성</h4>
        {MEAL_TYPES.map(meal => {
          const text = plan?.[meal.key]
          return (
            <div key={meal.key} className="space-y-1">
              <p className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                <span>{meal.emoji}</span>{meal.label}
              </p>
              {text ? (
                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2.5 leading-relaxed whitespace-pre-line">
                  {text}
                </p>
              ) : (
                <p className="text-xs text-gray-300 px-1">—</p>
              )}
            </div>
          )
        })}
      </section>

      {/* AI 코치 메모 */}
      {plan?.memo && (
        <section className="bg-purple-50 rounded-2xl border border-purple-100 p-4">
          <p className="text-xs font-semibold text-purple-500 flex items-center gap-1 mb-2">
            <Bot size={12} />AI 코치 노트
          </p>
          <p className="text-sm text-purple-700 leading-relaxed whitespace-pre-line">{plan.memo}</p>
        </section>
      )}

      <p className="text-center text-xs text-gray-300 pb-2">
        이 식단은 수정 전까지 영구 유지됩니다
      </p>
    </div>
  )
}
