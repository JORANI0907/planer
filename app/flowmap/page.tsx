'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PlanItem } from '@/lib/types'
import { getCurrentYear } from '@/lib/types'
import { getPlanItems, updatePlanItem, deletePlanItem } from '@/lib/api'
import { formatPeriodKey } from '@/lib/flowmap-layout'
import { KanbanBoard } from '@/components/flowmap/KanbanBoard'
import { FlowMapToolbar } from '@/components/flowmap/FlowMapToolbar'
import { PlanPopup } from '@/components/flowmap/PlanPopup'
import type { PopupFrame } from '@/components/flowmap/PlanPopup'
import { PlanFormModal } from '@/components/flowmap/PlanFormModal'
import type { FormTarget } from '@/components/flowmap/PlanFormModal'

export default function FlowMapPage() {
  const [year, setYear] = useState(getCurrentYear())
  const [annualItems, setAnnualItems] = useState<PlanItem[]>([])
  const [itemsByQuarter, setItemsByQuarter] = useState<Map<string, PlanItem[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [popupFrames, setPopupFrames] = useState<PopupFrame[]>([])
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  // 연간 + 분기 데이터 로드
  useEffect(() => {
    setLoading(true)
    setPopupFrames([])
    const quarterKeys = [1, 2, 3, 4].map(q => `${year}-Q${q}`)

    Promise.all([
      getPlanItems('annual', `${year}`),
      ...quarterKeys.map(key => getPlanItems('quarterly', key)),
    ])
      .then(([annual, ...quarterly]) => {
        setAnnualItems(annual)
        const map = new Map<string, PlanItem[]>()
        quarterKeys.forEach((key, i) => map.set(key, quarterly[i]))
        setItemsByQuarter(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [year])

  const reloadAll = useCallback(() => {
    const quarterKeys = [1, 2, 3, 4].map(q => `${year}-Q${q}`)
    Promise.all([
      getPlanItems('annual', `${year}`),
      ...quarterKeys.map(key => getPlanItems('quarterly', key)),
    ])
      .then(([annual, ...quarterly]) => {
        setAnnualItems(annual)
        const map = new Map<string, PlanItem[]>()
        quarterKeys.forEach((key, i) => map.set(key, quarterly[i]))
        setItemsByQuarter(map)
      })
      .catch(() => {})
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

  // 카드 "하위 보기" 버튼 → 팝업 열기 (annual→quarterly, quarterly→monthly 등)
  const handleCardClick = useCallback((item: PlanItem) => {
    const NEXT: Partial<Record<string, string>> = {
      annual: 'quarterly',
      quarterly: 'monthly', monthly: 'weekly', weekly: 'daily',
    }
    const childLevel = NEXT[item.level]
    if (!childLevel) return
    setPopupFrames([{
      periodKey: item.period_key,
      childLevel: childLevel as PopupFrame['childLevel'],
      label: formatPeriodKey(item.period_key, item.level),
    }])
  }, [])

  // 연간 "+" 버튼
  const handleAddAnnual = useCallback(() => {
    setFormTarget({ mode: 'create', level: 'annual', periodKey: `${year}` })
  }, [year])

  // 분기 "+" 버튼
  const handleAddItem = useCallback((quarterKey: string) => {
    setFormTarget({ mode: 'create', level: 'quarterly', periodKey: quarterKey })
  }, [])

  // 편집 버튼
  const handleEditItem = useCallback((item: PlanItem) => {
    setFormTarget({ mode: 'edit', level: item.level, periodKey: item.period_key, editItem: item })
  }, [])

  // bulk 삭제 (연간 + 분기 통합 처리)
  const handleDeleteItems = useCallback(async (ids: string[]) => {
    setAnnualItems(prev => prev.filter(i => !ids.includes(i.id)))
    setItemsByQuarter(prev => {
      const next = new Map(prev)
      for (const [key, items] of prev.entries()) {
        const filtered = items.filter(i => !ids.includes(i.id))
        if (filtered.length !== items.length) next.set(key, filtered)
      }
      return next
    })
    await Promise.allSettled(ids.map(id => deletePlanItem(id)))
  }, [])

  const handlePushFrame = useCallback((frame: PopupFrame) => {
    setPopupFrames(prev => [...prev, frame])
  }, [])

  const handlePopTo = useCallback((index: number) => {
    setPopupFrames(prev => prev.slice(0, index + 1))
  }, [])

  // 폼 저장 → 연간/분기 모두 처리
  const handleFormSaved = useCallback((item: PlanItem) => {
    setFormTarget(null)
    if (item.level === 'annual') {
      setAnnualItems(prev => {
        const idx = prev.findIndex(i => i.id === item.id)
        return idx >= 0 ? prev.map(i => i.id === item.id ? item : i) : [...prev, item]
      })
    } else if (item.level === 'quarterly') {
      setItemsByQuarter(prev => {
        const next = new Map(prev)
        const existing = next.get(item.period_key) ?? []
        const idx = existing.findIndex(i => i.id === item.id)
        if (idx >= 0) {
          next.set(item.period_key, existing.map(i => i.id === item.id ? item : i))
        } else {
          next.set(item.period_key, [...existing, item])
        }
        return next
      })
    }
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
            annualItems={annualItems}
            itemsByQuarter={itemsByQuarter}
            searchQuery={searchQuery}
            filterStatus={filterStatus}
            onCardClick={handleCardClick}
            onAddAnnual={handleAddAnnual}
            onAddItem={handleAddItem}
            onMoveItem={handleMoveItem}
            onEditItem={handleEditItem}
            onDeleteItems={handleDeleteItems}
          />
        )}
      </div>

      {popupFrames.length > 0 && (
        <PlanPopup
          frames={popupFrames}
          onPush={handlePushFrame}
          onPopTo={handlePopTo}
          onClose={() => setPopupFrames([])}
          onQuarterlyCreated={reloadAll}
        />
      )}

      {formTarget && (
        <PlanFormModal
          target={formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={handleFormSaved}
          onDeleted={reloadAll}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
