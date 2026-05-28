'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, TrendingUp } from 'lucide-react'
import type { FitnessProfile } from '@/lib/fitness-types'
import {
  GOAL_OPTIONS, EXPERIENCE_OPTIONS,
  calcBMR, calcTDEE, calcGoalCalories,
} from '@/lib/fitness-types'
import { getProfile, upsertProfile, getCompoundHighlights } from '@/lib/fitness-api'

type CompoundStat = {
  exercise: string
  latest_weight: number
  latest_reps: number
  one_rm: number
  trend: 'up' | 'same' | 'down'
}

type ProfileForm = {
  weight_kg: string
  height_cm: string
  age: string
  goal: string
  weekly_days: number
  experience_level: string
  notes: string
}

function StepButton({
  label, value, onChange, unit, step = 1, min = 0,
}: {
  label: string; value: string; onChange: (v: string) => void
  unit: string; step?: number; min?: number
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const n = parseFloat(value || '0')
            onChange(String(Math.max(min, Math.round((n - step) * 10) / 10)))
          }}
          className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg text-lg font-bold active:bg-gray-200"
        >−</button>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-20 text-center border border-gray-200 rounded-lg py-1.5 text-sm font-mono font-bold"
        />
        <button
          onClick={() => {
            const n = parseFloat(value || '0')
            onChange(String(Math.round((n + step) * 10) / 10))
          }}
          className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg text-lg font-bold active:bg-gray-200"
        >+</button>
        <span className="text-xs text-gray-400 w-8">{unit}</span>
      </div>
    </div>
  )
}

function ToggleGroup({
  label, options, value, onChange,
}: {
  label: string; options: readonly string[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="py-3 border-b border-gray-50 last:border-0">
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              value === opt
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function WeekdaySelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="py-3 border-b border-gray-50">
      <p className="text-sm font-medium text-gray-700 mb-2">주당 운동 일수</p>
      <div className="flex gap-1.5">
        {[2, 3, 4, 5, 6, 7].map(d => (
          <button
            key={d}
            onClick={() => onChange(d)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
              value === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {d}일
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ProfileSettings() {
  const [form, setForm] = useState<ProfileForm>({
    weight_kg: '', height_cm: '', age: '',
    goal: '근비대', weekly_days: 4,
    experience_level: '중급', notes: '',
  })
  const [compounds, setCompounds] = useState<CompoundStat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const load = useCallback(async () => {
    const [profile, comps] = await Promise.all([getProfile(), getCompoundHighlights()])
    setCompounds(comps.filter(c => c.one_rm > 0))
    if (profile) {
      setForm({
        weight_kg: profile.weight_kg?.toString() ?? '',
        height_cm: profile.height_cm?.toString() ?? '',
        age: profile.age?.toString() ?? '',
        goal: profile.goal ?? '근비대',
        weekly_days: profile.weekly_days ?? 4,
        experience_level: profile.experience_level ?? '중급',
        notes: profile.notes ?? '',
      })
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await upsertProfile({
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
        height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
        age: form.age ? parseInt(form.age) : null,
        goal: form.goal,
        weekly_days: form.weekly_days,
        experience_level: form.experience_level,
        notes: form.notes || null,
      })
      setSavedAt(new Date())
    } finally {
      setIsSaving(false)
    }
  }

  // 자동 계산
  const w = parseFloat(form.weight_kg || '0')
  const h = parseFloat(form.height_cm || '0')
  const a = parseInt(form.age || '0')
  const hasProfile = w > 0 && h > 0 && a > 0
  const bmi = hasProfile ? Math.round((w / Math.pow(h / 100, 2)) * 10) / 10 : null
  const bmiLabel = bmi == null ? null : bmi < 18.5 ? '저체중' : bmi < 23 ? '정상' : bmi < 25 ? '과체중' : '비만'
  const bmr = hasProfile ? calcBMR(w, h, a) : null
  const tdee = bmr ? calcTDEE(bmr, form.weekly_days) : null
  const goalCalories = tdee ? calcGoalCalories(tdee, form.goal) : null
  const proteinTarget = w > 0 ? Math.round(w * 2) : null

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-gray-400 text-sm">불러오는 중...</div>
  }

  return (
    <div className="md:grid md:grid-cols-2 md:gap-6 space-y-6 md:space-y-0">
      {/* 왼쪽: 기본 정보 입력 */}
      <section className="space-y-3">
        <h3 className="font-bold text-gray-900">기본 정보</h3>

        <div className="bg-white rounded-2xl border border-gray-100 px-4 space-y-0">
          <StepButton label="체중" value={form.weight_kg} onChange={v => setForm(p => ({ ...p, weight_kg: v }))} unit="kg" step={0.5} />
          <StepButton label="키" value={form.height_cm} onChange={v => setForm(p => ({ ...p, height_cm: v }))} unit="cm" step={1} min={100} />
          <StepButton label="나이" value={form.age} onChange={v => setForm(p => ({ ...p, age: v }))} unit="세" step={1} min={10} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 px-4 space-y-0">
          <ToggleGroup
            label="운동 목표"
            options={GOAL_OPTIONS}
            value={form.goal}
            onChange={v => setForm(p => ({ ...p, goal: v }))}
          />
          <WeekdaySelector value={form.weekly_days} onChange={v => setForm(p => ({ ...p, weekly_days: v }))} />
          <ToggleGroup
            label="운동 경력"
            options={EXPERIENCE_OPTIONS}
            value={form.experience_level}
            onChange={v => setForm(p => ({ ...p, experience_level: v }))}
          />
          <div className="py-3">
            <p className="text-sm font-medium text-gray-700 mb-2">특이사항 / 부상 이력</p>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="예: 오른쪽 무릎 통증, 어깨 충돌 증후군 등 (선택)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 bg-blue-600 text-white font-bold text-sm rounded-xl active:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '프로필 저장'}
          </button>
          {savedAt && (
            <span className="flex items-center gap-1 text-xs text-green-600 shrink-0">
              <CheckCircle size={13} /> 저장됨
            </span>
          )}
        </div>
      </section>

      {/* 오른쪽: 자동 분석 */}
      <section className="space-y-4">
        {/* 신체 분석 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <h3 className="font-bold text-gray-900 text-sm">자동 분석 결과</h3>
          {!hasProfile ? (
            <p className="text-xs text-gray-400 text-center py-4">왼쪽에서 체중, 키, 나이를 입력하면<br />자동으로 분석됩니다.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400">BMI</p>
                  <p className="font-bold text-gray-900">{bmi} <span className={`text-xs font-normal ${bmiLabel === '정상' ? 'text-green-600' : 'text-orange-500'}`}>{bmiLabel}</span></p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400">기초대사량(BMR)</p>
                  <p className="font-bold text-gray-900">{bmr?.toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">kcal</span></p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400">유지 칼로리(TDEE)</p>
                  <p className="font-bold text-gray-900">{tdee?.toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">kcal</span></p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400">권장 단백질</p>
                  <p className="font-bold text-gray-900">{proteinTarget} <span className="text-[10px] text-gray-400 font-normal">g/일</span></p>
                </div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-[10px] text-blue-500 font-medium mb-1">목표 칼로리 ({form.goal})</p>
                <p className="font-bold text-blue-700 text-lg">{goalCalories?.toLocaleString()} kcal</p>
                {tdee && goalCalories && (
                  <p className="text-[10px] text-blue-400 mt-0.5">
                    유지 {tdee.toLocaleString()} {goalCalories > tdee ? `+${goalCalories - tdee}` : goalCalories < tdee ? `-${tdee - goalCalories}` : '±0'}kcal
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 현재 1RM */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <TrendingUp size={14} className="text-orange-500" />
            현재 추정 1RM
          </h3>
          {compounds.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">운동 기록 탭에서 세트를 기록하면<br />자동으로 추정됩니다.</p>
          ) : (
            <div className="space-y-1">
              {compounds.map(c => (
                <div key={c.exercise} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-700">{c.exercise}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{c.latest_weight}×{c.latest_reps}</span>
                    <span className="font-bold text-gray-900 text-sm w-14 text-right">~{c.one_rm}kg</span>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-gray-400 pt-1">* Epley 공식 추정치 (최근 기록 기준)</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
