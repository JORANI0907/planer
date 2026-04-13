'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PlanItem } from '@/lib/types'
import { getCurrentYear } from '@/lib/types'
import { getPlanItems } from '@/lib/api'
import { FlowMapToolbar } from '@/components/flowmap/FlowMapToolbar'
import { FlowTreeView } from '@/components/flowmap/FlowTreeView'

export default function FlowMapPage() {
  const [year, setYear] = useState(getCurrentYear())
  const [annualItems, setAnnualItems] = useState<PlanItem[]>([])
  const [itemsByQuarter, setItemsByQuarter] = useState<Map<string, PlanItem[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  const loadTopLevel = useCallback(() => {
    const quarterKeys = [1, 2, 3, 4].map(q => `${year}-Q${q}`)
    return Promise.all([
      getPlanItems('annual', `${year}`),
      ...quarterKeys.map(key => getPlanItems('quarterly', key)),
    ]).then(([annual, ...quarterly]) => {
      setAnnualItems(annual)
      const map = new Map<string, PlanItem[]>()
      quarterKeys.forEach((key, i) => map.set(key, quarterly[i]))
      setItemsByQuarter(map)
    }).catch(() => {})
  }, [year])

  useEffect(() => {
    setLoading(true)
    loadTopLevel().finally(() => setLoading(false))
  }, [loadTopLevel])

  return (
    <div className="fixed inset-0 z-[5] flex flex-col md:pl-64 pb-14 md:pb-0" style={{ backgroundColor: '#f8fafc' }}>
      <FlowMapToolbar
        year={year}
        searchQuery={searchQuery}
        filterStatus={filterStatus}
        onYearChange={setYear}
        onSearchChange={setSearchQuery}
        onFilterStatus={setFilterStatus}
      />

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12, color: '#9ca3af' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 14 }}>계획 불러오는 중...</span>
          </div>
        ) : (
          <FlowTreeView
            year={year}
            annualItems={annualItems}
            itemsByQuarter={itemsByQuarter}
            searchQuery={searchQuery}
            filterStatus={filterStatus}
            onTopLevelChanged={loadTopLevel}
          />
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
