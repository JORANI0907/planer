'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PlanItem } from '@/lib/types'
import { getCurrentYear } from '@/lib/types'
import { getPlanItems, updatePlanItem } from '@/lib/api'
import { KanbanBoard } from '@/components/flowmap/KanbanBoard'
import { FlowMapToolbar } from '@/components/flowmap/FlowMapToolbar'
import { DrillDownModal } from '@/components/flowmap/DrillDownModal'

export default function FlowMapPage() {
  const [year, setYear] = useState(getCurrentYear())
  const [itemsByQuarter, setItemsByQuarter] = useState<Map<string, PlanItem[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [drillQuarter, setDrillQuarter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setDrillQuarter(null)
    const quarterKeys = [1, 2, 3, 4].map(q => `${year}-Q${q}`)

    Promise.all(quarterKeys.map(key => getPlanItems('quarterly', key)))
      .then(results => {
        const map = new Map<string, PlanItem[]>()
        quarterKeys.forEach((key, i) => map.set(key, results[i]))
        setItemsByQuarter(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [year])

  const handleMoveItem = useCallback(async (item: PlanItem, targetKey: string) => {
    if (item.period_key === targetKey) return
    const sourceKey = item.period_key

    setItemsByQuarter(prev => {
      const next = new Map(prev)
      next.set(sourceKey, (prev.get(sourceKey) ?? []).filter(i => i.id !== item.id))
      next.set(targetKey, [...(prev.get(targetKey) ?? []), { ...item, period_key: targetKey }])
      return next
    })

    await updatePlanItem(item.id, { period_key: targetKey }).catch(() => {
      setItemsByQuarter(prev => {
        const next = new Map(prev)
        next.set(targetKey, (prev.get(targetKey) ?? []).filter(i => i.id !== item.id))
        next.set(sourceKey, [...(prev.get(sourceKey) ?? []), item])
        return next
      })
    })
  }, [])

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
          <KanbanBoard
            year={year}
            itemsByQuarter={itemsByQuarter}
            searchQuery={searchQuery}
            filterStatus={filterStatus}
            onDrillDown={setDrillQuarter}
            onMoveItem={handleMoveItem}
          />
        )}
      </div>

      {drillQuarter && (
        <DrillDownModal
          quarterKey={drillQuarter}
          year={year}
          onClose={() => setDrillQuarter(null)}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
