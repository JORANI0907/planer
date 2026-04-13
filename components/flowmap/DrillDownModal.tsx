'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PlanItem } from '@/lib/types'
import { getMonthWeeks } from '@/lib/types'
import { getPlanItems } from '@/lib/api'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import { PlanCard } from './PlanCard'

interface DrillDownModalProps {
  quarterKey: string
  year: number
  onClose: () => void
}

const QUARTER_MONTHS: Record<string, number[]> = {
  'Q1': [1, 2, 3],
  'Q2': [4, 5, 6],
  'Q3': [7, 8, 9],
  'Q4': [10, 11, 12],
}

const QUARTER_LABELS: Record<string, string> = {
  'Q1': '1분기', 'Q2': '2분기', 'Q3': '3분기', 'Q4': '4분기',
}

const MONTH_LABELS = ['', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

const MONTH_COLORS: Array<{ bg: string; border: string; header: string } | string> = [
  '',  // index 0 unused
  { bg: '#eff6ff', border: '#bfdbfe', header: '#2563eb' },  // 1월
  { bg: '#f0f9ff', border: '#bae6fd', header: '#0284c7' },  // 2월
  { bg: '#ecfdf5', border: '#a7f3d0', header: '#059669' },  // 3월
  { bg: '#f0fdf4', border: '#bbf7d0', header: '#16a34a' },  // 4월
  { bg: '#fefce8', border: '#fef08a', header: '#ca8a04' },  // 5월
  { bg: '#fff7ed', border: '#fed7aa', header: '#ea580c' },  // 6월
  { bg: '#fef2f2', border: '#fecaca', header: '#dc2626' },  // 7월
  { bg: '#fdf4ff', border: '#e9d5ff', header: '#9333ea' },  // 8월
  { bg: '#faf5ff', border: '#ddd6fe', header: '#7c3aed' },  // 9월
  { bg: '#f8fafc', border: '#e2e8f0', header: '#475569' },  // 10월
  { bg: '#f1f5f9', border: '#cbd5e1', header: '#334155' },  // 11월
  { bg: '#f0f4f8', border: '#b0c4d8', header: '#1e3a5f' },  // 12월
]

type MonthColor = { bg: string; border: string; header: string }

function getMonthColor(month: number): MonthColor {
  const entry = MONTH_COLORS[month]
  if (typeof entry === 'object') return entry
  return { bg: '#f9fafb', border: '#e5e7eb', header: '#6b7280' }
}

export function DrillDownModal({ quarterKey, year, onClose }: DrillDownModalProps) {
  const q = quarterKey.split('-')[1]
  const months = QUARTER_MONTHS[q] ?? []
  const quarterLabel = QUARTER_LABELS[q] ?? q

  const [itemsByMonth, setItemsByMonth] = useState<Map<string, PlanItem[]>>(new Map())
  const [weeklyByMonth, setWeeklyByMonth] = useState<Map<string, PlanItem[]>>(new Map())
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const monthKeys = months.map(m => `${year}-${String(m).padStart(2, '0')}`)

    Promise.all(monthKeys.map(key => getPlanItems('monthly', key)))
      .then(results => {
        const map = new Map<string, PlanItem[]>()
        monthKeys.forEach((key, i) => map.set(key, results[i]))
        setItemsByMonth(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quarterKey, year])

  const toggleWeekly = useCallback(async (monthKey: string) => {
    const isExpanded = expandedMonths.has(monthKey)
    setExpandedMonths(prev => {
      const next = new Set(prev)
      if (isExpanded) next.delete(monthKey)
      else next.add(monthKey)
      return next
    })

    if (!isExpanded && !weeklyByMonth.has(monthKey)) {
      const [yearStr, monthStr] = monthKey.split('-')
      const weekKeys = getMonthWeeks(parseInt(yearStr), parseInt(monthStr))
      try {
        const results = await Promise.all(weekKeys.map(k => getPlanItems('weekly', k)))
        setWeeklyByMonth(prev => {
          const next = new Map(prev)
          next.set(monthKey, results.flat())
          return next
        })
      } catch {
        // silently fail
      }
    }
  }, [expandedMonths, weeklyByMonth])

  const toggleCollapse = useCallback((monthKey: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev)
      if (next.has(monthKey)) next.delete(monthKey)
      else next.add(monthKey)
      return next
    })
  }, [])

  const totalItems = [...itemsByMonth.values()].reduce((s, arr) => s + arr.length, 0)

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '92vw', maxWidth: 980, backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 50px rgba(0,0,0,0.15)', animation: 'slideIn 0.25s ease' }}>
        {/* Header */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>{year}년 · 분기 상세</div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#111827', margin: 0 }}>
              {quarterLabel} 월간 계획 ({totalItems}개)
            </h2>
          </div>
          <button onClick={onClose} style={{ padding: 8, borderRadius: 8, border: 'none', backgroundColor: '#f3f4f6', cursor: 'pointer', display: 'flex' }}>
            <X size={18} color="#6b7280" />
          </button>
        </div>

        {/* Month columns */}
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: 20, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {months.map(month => {
              const monthKey = `${year}-${String(month).padStart(2, '0')}`
              const monthItems = itemsByMonth.get(monthKey) ?? []
              const weekItems = weeklyByMonth.get(monthKey) ?? []
              const isWeekExpanded = expandedMonths.has(monthKey)
              const isCollapsed = collapsedMonths.has(monthKey)
              const mc = getMonthColor(month)

              return (
                <div key={monthKey} style={{ width: 240, flexShrink: 0, borderRadius: 12, border: `1.5px solid ${mc.border}`, backgroundColor: mc.bg, overflow: 'hidden' }}>
                  {/* Month header */}
                  <div style={{ padding: '10px 12px', backgroundColor: mc.header, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => toggleCollapse(monthKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#fff', display: 'flex' }}>
                      {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                    </button>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, flex: 1 }}>{MONTH_LABELS[month]}</span>
                    <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{monthItems.length}</span>
                    <button
                      onClick={() => toggleWeekly(monthKey)}
                      style={{ background: 'none', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, fontSize: 10, color: 'rgba(255,255,255,0.85)', padding: '2px 6px', cursor: 'pointer', flexShrink: 0 }}
                    >
                      {isWeekExpanded ? '주간 ▲' : '주간 ▼'}
                    </button>
                  </div>

                  {!isCollapsed && (
                    <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
                      {monthItems.length === 0 && !isWeekExpanded && (
                        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: '16px 0' }}>계획 없음</div>
                      )}

                      {monthItems.map(item => (
                        <PlanCard key={item.id} item={item} compact />
                      ))}

                      {isWeekExpanded && (
                        <>
                          {weekItems.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 11, padding: '8px 0', borderTop: '1px dashed #d1d5db', marginTop: 4 }}>주간 계획 없음</div>
                          ) : (
                            <>
                              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, padding: '4px 0', borderTop: '1px dashed #d1d5db', marginTop: 4 }}>주간 계획</div>
                              {weekItems.map(item => (
                                <PlanCard key={item.id} item={item} compact />
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
