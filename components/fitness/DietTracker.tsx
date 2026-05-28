'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react'
import type { FitnessDiet } from '@/lib/fitness-types'
import { DIET_GOALS, getTodayKey, formatDateShort } from '@/lib/fitness-types'
import { getDiet, upsertDiet, getDietHistory } from '@/lib/fitness-api'

type DietForm = {
  calories: string
  protein_g: string
  carbs_g: string
  fat_g: string
  water_l: string
  memo: string
}

function MacroBar({ label, value, min, max, unit, warn }: {
  label: string; value: number; min: number; max: number; unit: string; warn?: boolean
}) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const isLow = warn && value < min
  const isGood = value >= min && value <= max * 1.1
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className={`font-medium ${isLow ? 'text-red-500' : isGood ? 'text-green-600' : 'text-gray-700'}`}>
          {label} {isLow && '⚠️'} {isGood && value > 0 && '✓'}
        </span>
        <span className="text-xs text-gray-500">
          {value}{unit}
          <span className="text-gray-400"> / {min}~{max}{unit}</span>
        </span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isLow && value > 0 ? 'bg-red-400' : isGood ? 'bg-green-500' : 'bg-blue-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function NumInput({
  label, value, onChange, unit, step = 1,
}: {
  label: string; value: string; onChange: (v: string) => void; unit: string; step?: number
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const n = parseFloat(value || '0')
            onChange(Math.max(0, Math.round((n - step) * 10) / 10).toString())
          }}
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
          onClick={() => {
            const n = parseFloat(value || '0')
            onChange((Math.round((n + step) * 10) / 10).toString())
          }}
          className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg font-bold active:bg-gray-200"
        >+</button>
        <span className="text-xs text-gray-400 w-8">{unit}</span>
      </div>
    </div>
  )
}

export default function DietTracker() {
  const [selectedDate, setSelectedDate] = useState(getTodayKey())
  const [form, setForm] = useState<DietForm>({
    calories: '', protein_g: '', carbs_g: '', fat_g: '', water_l: '', memo: '',
  })
  const [history, setHistory] = useState<FitnessDiet[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const loadDate = useCallback(async (date: string) => {
    setIsLoading(true)
    try {
      const [record, hist] = await Promise.all([getDiet(date), getDietHistory(7)])
      setHistory(hist)
      if (record) {
        setForm({
          calories: record.calories.toString(),
          protein_g: record.protein_g.toString(),
          carbs_g: record.carbs_g.toString(),
          fat_g: record.fat_g.toString(),
          water_l: record.water_l.toString(),
          memo: record.memo ?? '',
        })
      } else {
        setForm({ calories: '', protein_g: '', carbs_g: '', fat_g: '', water_l: '', memo: '' })
      }
      setSavedAt(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadDate(selectedDate) }, [selectedDate, loadDate])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await upsertDiet({
        date: selectedDate,
        calories: parseInt(form.calories || '0'),
        protein_g: parseFloat(form.protein_g || '0'),
        carbs_g: parseFloat(form.carbs_g || '0'),
        fat_g: parseFloat(form.fat_g || '0'),
        water_l: parseFloat(form.water_l || '0'),
        memo: form.memo,
      })
      setSavedAt(new Date())
      const hist = await getDietHistory(7)
      setHistory(hist)
    } finally {
      setIsSaving(false)
    }
  }, [form, selectedDate])

  const shiftDate = (delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  const caloriesVal = parseInt(form.calories || '0')
  const proteinVal = parseFloat(form.protein_g || '0')
  const carbsVal = parseFloat(form.carbs_g || '0')
  const fatVal = parseFloat(form.fat_g || '0')
  const waterVal = parseFloat(form.water_l || '0')
  const isToday = selectedDate === getTodayKey()

  return (
    <div className="space-y-5">
      {/* 날짜 선택 */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-3">
        <button onClick={() => shiftDate(-1)} className="p-2 rounded-xl active:bg-gray-100">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <div className="text-center">
          <p className="font-bold text-gray-900 text-sm">{selectedDate}</p>
          {isToday && <p className="text-xs text-blue-500 font-medium">오늘</p>}
        </div>
        <button
          onClick={() => shiftDate(1)}
          disabled={isToday}
          className="p-2 rounded-xl active:bg-gray-100 disabled:opacity-30"
        >
          <ChevronRight size={20} className="text-gray-500" />
        </button>
      </div>

      {/* 목표 대비 현황 */}
      {(caloriesVal > 0 || proteinVal > 0) && (
        <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <h3 className="font-bold text-gray-900 text-sm">목표 달성률</h3>
          {proteinVal < DIET_GOALS.protein_g.min && proteinVal > 0 && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-xl p-2.5">
              <AlertTriangle size={13} />
              <span className="font-medium">단백질 {DIET_GOALS.protein_g.min - proteinVal}g 더 필요합니다 (근비대 필수!)</span>
            </div>
          )}
          <MacroBar label="칼로리" value={caloriesVal} min={DIET_GOALS.calories.min} max={DIET_GOALS.calories.max} unit="kcal" />
          <MacroBar label="단백질" value={proteinVal} min={DIET_GOALS.protein_g.min} max={DIET_GOALS.protein_g.max} unit="g" warn />
          <MacroBar label="탄수화물" value={carbsVal} min={DIET_GOALS.carbs_g.min} max={DIET_GOALS.carbs_g.max} unit="g" />
          <MacroBar label="지방" value={fatVal} min={DIET_GOALS.fat_g.min} max={DIET_GOALS.fat_g.max} unit="g" />
          <MacroBar label="수분" value={waterVal} min={DIET_GOALS.water_l.min} max={DIET_GOALS.water_l.max} unit="L" />
        </section>
      )}

      {/* 입력 폼 */}
      <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-1">
        <h3 className="font-bold text-gray-900 text-sm mb-3">식단 입력</h3>
        {isLoading ? (
          <p className="text-xs text-gray-400 text-center py-4">불러오는 중...</p>
        ) : (
          <>
            <NumInput label="칼로리" value={form.calories} onChange={v => setForm(p => ({ ...p, calories: v }))} unit="kcal" step={50} />
            <NumInput label="단백질" value={form.protein_g} onChange={v => setForm(p => ({ ...p, protein_g: v }))} unit="g" step={5} />
            <NumInput label="탄수화물" value={form.carbs_g} onChange={v => setForm(p => ({ ...p, carbs_g: v }))} unit="g" step={10} />
            <NumInput label="지방" value={form.fat_g} onChange={v => setForm(p => ({ ...p, fat_g: v }))} unit="g" step={5} />
            <NumInput label="수분" value={form.water_l} onChange={v => setForm(p => ({ ...p, water_l: v }))} unit="L" step={0.25} />
            <div className="pt-2">
              <input
                type="text"
                placeholder="메모 (선택)"
                value={form.memo}
                onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
              />
            </div>
          </>
        )}
        <div className="pt-3 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm active:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
          {savedAt && (
            <span className="flex items-center gap-1 text-xs text-green-600 shrink-0">
              <CheckCircle size={13} /> 저장됨
            </span>
          )}
        </div>
      </section>

      {/* 최근 7일 기록 */}
      <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
        <h3 className="font-bold text-gray-900 text-sm">최근 기록</h3>
        {history.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">기록이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[320px]">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-1.5 font-medium">날짜</th>
                  <th className="text-right pb-1.5 font-medium">칼로리</th>
                  <th className="text-right pb-1.5 font-medium">단백질</th>
                  <th className="text-right pb-1.5 font-medium">탄수</th>
                  <th className="text-right pb-1.5 font-medium">지방</th>
                </tr>
              </thead>
              <tbody>
                {history.map(d => (
                  <tr
                    key={d.date}
                    onClick={() => setSelectedDate(d.date)}
                    className={`border-b border-gray-50 last:border-0 cursor-pointer ${d.date === selectedDate ? 'bg-blue-50' : ''}`}
                  >
                    <td className="py-2 font-medium text-gray-700">{formatDateShort(d.date)}</td>
                    <td className="py-2 text-right text-gray-600">{d.calories}</td>
                    <td className={`py-2 text-right font-medium ${d.protein_g < DIET_GOALS.protein_g.min ? 'text-red-500' : 'text-green-600'}`}>{d.protein_g}g</td>
                    <td className="py-2 text-right text-gray-500">{d.carbs_g}g</td>
                    <td className="py-2 text-right text-gray-500">{d.fat_g}g</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
