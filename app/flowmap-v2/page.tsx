'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PlanItem, PlanLevel } from '@/lib/types'
import { getCurrentYear } from '@/lib/types'
import { getPlanItems } from '@/lib/api'
import { getChildPeriodKeys } from '@/lib/flowmap-v2-utils'
import { FlowMapV2Toolbar, type ViewMode } from '@/components/flowmap-v2/FlowMapV2Toolbar'
import { AnnualListView } from '@/components/flowmap-v2/AnnualListView'
import { PeriodFlatView } from '@/components/flowmap-v2/PeriodFlatView'

// 뷰모드별 데이터 레벨 & period_key 목록 설정
const VIEW_CONFIG: Record<
  Exclude<ViewMode, 'basic'>,
  { level: PlanLevel; getPeriodKeys: (year: number) => string[] }
> = {
  quarterly: {
    level: 'quarterly',
    getPeriodKeys: (year) => [1, 2, 3, 4].map(q => `${year}-Q${q}`),
  },
  monthly: {
    level: 'monthly',
    getPeriodKeys: (year) =>
      Array.from({ length: 12 }, (_, i) => {
        const m = i + 1
        return `${year}-${String(m).padStart(2, '0')}`
      }),
  },
  weekly: {
    level: 'weekly',
    getPeriodKeys: (year) => {
      const quarterKeys = [1, 2, 3, 4].map(q => `${year}-Q${q}`)
      const monthKeys = quarterKeys.flatMap(q => getChildPeriodKeys(q))
      return monthKeys.flatMap(m => getChildPeriodKeys(m))
    },
  },
}

export default function FlowMapV2Page() {
  const [year, setYear] = useState(getCurrentYear())
  const [viewMode, setViewMode] = useState<ViewMode>('basic')
  const [annualItems, setAnnualItems] = useState<PlanItem[]>([])
  const [allItems, setAllItems] = useState<PlanItem[]>([])
  const [itemsByPeriod, setItemsByPeriod] = useState<Map<string, PlanItem[]>>(new Map())
  const [loading, setLoading] = useState(true)

  // 연간 목록 로드
  const loadAnnual = useCallback(async () => {
    const items = await getPlanItems('annual', `${year}`)
    setAnnualItems(items)
    return items
  }, [year])

  // 평면보기(분기/월/주) 로드
  const loadFlatView = useCallback(async (mode: Exclude<ViewMode, 'basic'>) => {
    const config = VIEW_CONFIG[mode]
    const keys = config.getPeriodKeys(year)

    const results = await Promise.all(
      keys.map(key => getPlanItems(config.level, key))
    )

    const map = new Map<string, PlanItem[]>()
    keys.forEach((key, i) => map.set(key, results[i]))
    setItemsByPeriod(map)
    return keys
  }, [year])

  // 연간 + 전체 아이템 (배지 표시용) 로드
  const loadAllForBadge = useCallback(async () => {
    const [annual, quarterly, monthly] = await Promise.all([
      getPlanItems('annual', `${year}`),
      Promise.all(
        [1, 2, 3, 4].map(q => getPlanItems('quarterly', `${year}-Q${q}`))
      ).then(res => res.flat()),
      Promise.all(
        Array.from({ length: 12 }, (_, i) => {
          const m = i + 1
          return getPlanItems('monthly', `${year}-${String(m).padStart(2, '0')}`)
        })
      ).then(res => res.flat()),
    ])
    setAllItems([...annual, ...quarterly, ...monthly])
    return annual
  }, [year])

  // 메인 로드
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      if (viewMode === 'basic') {
        await loadAnnual()
      } else {
        await Promise.all([loadFlatView(viewMode), loadAllForBadge()])
      }
    } catch {
      // 조용히 실패 처리
    } finally {
      setLoading(false)
    }
  }, [viewMode, loadAnnual, loadFlatView, loadAllForBadge])

  useEffect(() => {
    reload()
  }, [reload])

  const periodKeys =
    viewMode !== 'basic' ? VIEW_CONFIG[viewMode].getPeriodKeys(year) : []

  return (
    <div
      className="fixed inset-0 z-[5] flex flex-col md:pl-64 pb-14 md:pb-0"
      style={{ backgroundColor: '#f8fafc' }}
    >
      <FlowMapV2Toolbar
        year={year}
        viewMode={viewMode}
        onYearChange={y => setYear(y)}
        onViewModeChange={m => setViewMode(m)}
      />

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <LoadingSpinner />
        ) : viewMode === 'basic' ? (
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 20px',
            }}
          >
            <AnnualListView
              year={year}
              items={annualItems}
              onChanged={loadAnnual}
            />
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              overflowX: 'auto',
              overflowY: 'auto',
              padding: '16px 20px',
            }}
          >
            <PeriodFlatView
              level={VIEW_CONFIG[viewMode].level}
              periodKeys={periodKeys}
              itemsByPeriod={itemsByPeriod}
              allItems={allItems}
              onAddItem={() => reload()}
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        flexDirection: 'column',
        gap: 12,
        color: '#9ca3af',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: '3px solid #e5e7eb',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span style={{ fontSize: 14 }}>계획 불러오는 중...</span>
    </div>
  )
}
