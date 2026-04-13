'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PlanItem, PlanLevel } from '@/lib/types'
import { getCurrentYear, getMonthWeeks, getWeekDays } from '@/lib/types'
import { getPlanItems, getAllPlanItems } from '@/lib/api'
import { NEXT_LEVEL, calculateLayout, isTodayPeriod } from '@/lib/flowmap-layout'
import { FlowMapCanvas } from '@/components/flowmap/FlowMapCanvas'
import { FlowMapToolbar } from '@/components/flowmap/FlowMapToolbar'
import { NodeDetailPanel } from '@/components/flowmap/NodeDetailPanel'

export default function FlowMapPage() {
  const [year, setYear] = useState(getCurrentYear())
  const [annualItems, setAnnualItems] = useState<PlanItem[]>([])
  const [childrenByParentId, setChildrenByParentId] = useState<Map<string, PlanItem[]>>(new Map())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [selectedItem, setSelectedItem] = useState<PlanItem | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<PlanLevel | null>(null)
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [panX, setPanX] = useState(40)
  const [panY, setPanY] = useState(40)
  const [scale, setScale] = useState(1)

  // Load annual items
  useEffect(() => {
    setLoadingInitial(true)
    setAnnualItems([])
    setChildrenByParentId(new Map())
    setExpandedIds(new Set())
    setSelectedItem(null)

    // getAllPlanItems로 전체 조회 후 해당 연도만 필터링 (period_key 포맷 차이 대응)
    getAllPlanItems('annual')
      .then((items) => {
        const filtered = items.filter(
          (item) => item.period_key === String(year) || item.period_key.startsWith(String(year))
        )
        setAnnualItems(filtered)
      })
      .catch(() => {})
      .finally(() => setLoadingInitial(false))
  }, [year])

  // Load children for a node — 시간 계층 기반 (매핑 테이블 불필요)
  const loadChildren = useCallback(
    async (item: PlanItem, level: PlanLevel) => {
      const nextLevel = NEXT_LEVEL[level]
      if (!nextLevel) return

      if (childrenByParentId.has(item.id)) return

      setLoadingIds((prev) => new Set([...prev, item.id]))

      try {
        const childKeys = getChildPeriodKeys(item.period_key, level)
        const childArrays = await Promise.all(
          childKeys.map((pk) => getPlanItems(nextLevel, pk))
        )
        // 계획이 있는 기간만 표시
        const allChildren = childArrays.flat()

        setChildrenByParentId((prev) => new Map([...prev, [item.id, allChildren]]))
      } catch {
        // silently fail
      } finally {
        setLoadingIds((prev) => {
          const next = new Set(prev)
          next.delete(item.id)
          return next
        })
      }
    },
    [childrenByParentId]
  )

  // Toggle expand/collapse
  const handleToggleExpand = useCallback(
    async (item: PlanItem, level: PlanLevel) => {
      const isExpanded = expandedIds.has(item.id)

      if (isExpanded) {
        // Collapse: remove this node and all descendants from expandedIds
        setExpandedIds((prev) => {
          const next = new Set(prev)
          collapseSubtree(item.id, next, childrenByParentId)
          return next
        })
      } else {
        // Expand: load children first, then add to expanded
        await loadChildren(item, level)
        setExpandedIds((prev) => new Set([...prev, item.id]))
      }
    },
    [expandedIds, loadChildren, childrenByParentId]
  )

  // Select node
  const handleSelectNode = useCallback((item: PlanItem, level: PlanLevel) => {
    if (selectedItem?.id === item.id) {
      setSelectedItem(null)
      setSelectedLevel(null)
    } else {
      setSelectedItem(item)
      setSelectedLevel(level)
    }
  }, [selectedItem])

  // Go to today
  const handleGoToday = useCallback(() => {
    // Find the today node and pan to it
    const today = new Date()
    const currentYear = today.getFullYear()

    if (currentYear !== year) {
      setYear(currentYear)
      return
    }

    // Find first annual item that contains today (annual level)
    const todayAnnual = annualItems.find((item) => isTodayPeriod(item.period_key, 'annual'))
    if (todayAnnual) {
      const positions = calculateLayout(annualItems, childrenByParentId, expandedIds)
      const pos = positions.get(todayAnnual.id)
      if (pos) {
        setPanX(80 - pos.x * scale)
        setPanY(80 - pos.y * scale)
      }
    }
  }, [year, annualItems, childrenByParentId, expandedIds, scale])

  // Collapse all
  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set())
  }, [])

  // Fit view
  const handleFitView = useCallback(() => {
    if (annualItems.length === 0) return
    const positions = calculateLayout(annualItems, childrenByParentId, expandedIds)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const [, pos] of positions) {
      minX = Math.min(minX, pos.x)
      minY = Math.min(minY, pos.y)
      maxX = Math.max(maxX, pos.x + pos.width)
      maxY = Math.max(maxY, pos.y + pos.height)
    }
    if (minX === Infinity) return

    const containerEl = document.querySelector('[data-canvas-container]') as HTMLElement
    if (!containerEl) return
    const containerW = containerEl.clientWidth
    const containerH = containerEl.clientHeight

    const contentW = maxX - minX + 80
    const contentH = maxY - minY + 80

    const newScale = Math.min(
      containerW / contentW,
      containerH / contentH,
      1
    )

    setScale(Math.max(0.25, newScale))
    setPanX((containerW - contentW * newScale) / 2 - minX * newScale + 40)
    setPanY((containerH - contentH * newScale) / 2 - minY * newScale + 40)
  }, [annualItems, childrenByParentId, expandedIds])

  // Find today node ID for highlighting
  const todayNodeId = findTodayNode(annualItems, childrenByParentId, expandedIds)

  const selectedChildren =
    selectedItem && selectedLevel
      ? (childrenByParentId.get(selectedItem.id) ?? [])
      : []

  const isSelectedExpanded = selectedItem ? expandedIds.has(selectedItem.id) : false

  return (
    // fixed로 main의 padding을 벗어나 전체 화면 사용
    // 데스크탑: 사이드바 너비(256px) 만큼 왼쪽 여백
    // 모바일: 하단 BottomNav(56px) 만큼 여백
    <div
      className="fixed inset-0 z-[5] flex flex-col md:pl-64 pb-14 md:pb-0"
      style={{ backgroundColor: '#f8fafc' }}
    >
      {/* Toolbar */}
      <FlowMapToolbar
        year={year}
        scale={scale}
        filterCategory={filterCategory}
        filterStatus={filterStatus}
        searchQuery={searchQuery}
        onYearChange={(y) => {
          setYear(y)
          setPanX(40)
          setPanY(40)
          setScale(1)
        }}
        onGoToday={handleGoToday}
        onCollapseAll={handleCollapseAll}
        onFilterCategory={setFilterCategory}
        onFilterStatus={setFilterStatus}
        onSearchChange={setSearchQuery}
        onZoomIn={() => setScale((s) => Math.min(2.5, s * 1.15))}
        onZoomOut={() => setScale((s) => Math.max(0.25, s / 1.15))}
        onFitView={handleFitView}
      />

      {/* Canvas area */}
      <div
        data-canvas-container
        style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}
      >
        {loadingInitial ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              flexDirection: 'column',
              gap: 12,
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
        ) : (
          <FlowMapCanvas
            annualItems={annualItems}
            childrenByParentId={childrenByParentId}
            expandedIds={expandedIds}
            loadingIds={loadingIds}
            selectedId={selectedItem?.id ?? null}
            filterCategory={filterCategory}
            filterStatus={filterStatus}
            searchQuery={searchQuery}
            onToggleExpand={handleToggleExpand}
            onSelectNode={handleSelectNode}
            panX={panX}
            panY={panY}
            scale={scale}
            onPanChange={(dx, dy) => {
              setPanX((x) => x + dx)
              setPanY((y) => y + dy)
            }}
            onScaleChange={setScale}
            todayNodeId={todayNodeId}
          />
        )}

        {/* Detail panel */}
        {selectedItem && selectedLevel && (
          <NodeDetailPanel
            item={selectedItem}
            level={selectedLevel}
            children={selectedChildren}
            isExpanded={isSelectedExpanded}
            onClose={() => {
              setSelectedItem(null)
              setSelectedLevel(null)
            }}
            onExpandChild={(child) => {
              const nextLevel = NEXT_LEVEL[selectedLevel]
              if (nextLevel) {
                handleToggleExpand(child, nextLevel)
                handleSelectNode(child, nextLevel)
              }
            }}
          />
        )}
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function collapseSubtree(
  nodeId: string,
  expanded: Set<string>,
  childrenByParentId: Map<string, PlanItem[]>
) {
  expanded.delete(nodeId)
  const children = childrenByParentId.get(nodeId) ?? []
  for (const child of children) {
    collapseSubtree(child.id, expanded, childrenByParentId)
  }
}

// 시간 계층 기반으로 하위 period_key 목록 계산
function getChildPeriodKeys(periodKey: string, level: PlanLevel): string[] {
  if (level === 'annual') {
    // 연간 → 분기 (Q1~Q4)
    const year = parseInt(periodKey)
    return [1, 2, 3, 4].map((q) => `${year}-Q${q}`)
  }

  if (level === 'quarterly') {
    // 분기 → 월간 (해당 분기의 3개월)
    const [yearStr, qPart] = periodKey.split('-Q')
    const year = parseInt(yearStr)
    const q = parseInt(qPart)
    const startMonth = (q - 1) * 3 + 1
    return [startMonth, startMonth + 1, startMonth + 2].map(
      (m) => `${year}-${String(m).padStart(2, '0')}`
    )
  }

  if (level === 'monthly') {
    // 월간 → 주간 (해당 월의 주차들)
    const [yearStr, monthStr] = periodKey.split('-')
    return getMonthWeeks(parseInt(yearStr), parseInt(monthStr))
  }

  if (level === 'weekly') {
    // 주간 → 일일 (해당 주의 7일)
    const [yearStr, weekPart] = periodKey.split('-W')
    return getWeekDays(parseInt(yearStr), parseInt(weekPart))
  }

  return []
}

function findTodayNode(
  annualItems: PlanItem[],
  childrenByParentId: Map<string, PlanItem[]>,
  expandedIds: Set<string>
): string | null {
  function traverse(items: PlanItem[], level: PlanLevel): string | null {
    for (const item of items) {
      if (isTodayPeriod(item.period_key, level)) return item.id
      if (expandedIds.has(item.id)) {
        const nextLevel = NEXT_LEVEL[level]
        if (nextLevel) {
          const children = childrenByParentId.get(item.id) ?? []
          const found = traverse(children, nextLevel)
          if (found) return found
        }
      }
    }
    return null
  }

  return traverse(annualItems, 'annual')
}
