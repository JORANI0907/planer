'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import type { PlanItem, PlanLevel } from '@/lib/types'
import { calculateLayout, getColumnX, NODE_WIDTH, NEXT_LEVEL } from '@/lib/flowmap-layout'
import { FlowNode } from './FlowNode'
import { FlowEdges } from './FlowEdges'
import { ColumnHeaders } from './ColumnHeaders'

const LEVELS: PlanLevel[] = ['annual', 'quarterly', 'monthly', 'weekly', 'daily']

interface FlowMapCanvasProps {
  annualItems: PlanItem[]
  childrenByParentId: Map<string, PlanItem[]>
  expandedIds: Set<string>
  loadingIds: Set<string>
  selectedId: string | null
  filterCategory: string | null
  filterStatus: string | null
  searchQuery: string
  onToggleExpand: (item: PlanItem, level: PlanLevel) => void
  onSelectNode: (item: PlanItem, level: PlanLevel) => void
  panX: number
  panY: number
  scale: number
  onPanChange: (dx: number, dy: number) => void
  onScaleChange: (scale: number) => void
  todayNodeId: string | null
}

export function FlowMapCanvas({
  annualItems,
  childrenByParentId,
  expandedIds,
  loadingIds,
  selectedId,
  filterCategory,
  filterStatus,
  searchQuery,
  onToggleExpand,
  onSelectNode,
  panX,
  panY,
  scale,
  onPanChange,
  onScaleChange,
  todayNodeId,
}: FlowMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const lastTouchDist = useRef<number | null>(null)

  // Build flat list of all visible items with their levels
  const allItems = buildFlatList(annualItems, childrenByParentId, expandedIds)

  // Calculate layout positions
  const positions = calculateLayout(annualItems, childrenByParentId, expandedIds)

  // Determine which levels are visible
  const visibleLevels = getVisibleLevels(annualItems, childrenByParentId, expandedIds)

  // Calculate canvas bounds
  let maxX = 200
  let maxY = 100
  for (const [, pos] of positions) {
    maxX = Math.max(maxX, pos.x + pos.width + 80)
    maxY = Math.max(maxY, pos.y + pos.height + 80)
  }

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-node]')) return
    isDragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setAttribute('style',
      (e.currentTarget as HTMLElement).style.cssText + 'cursor:grabbing;'
    )
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    onPanChange(dx, dy)
  }, [onPanChange])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  // Wheel zoom/scroll
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY > 0 ? 0.92 : 1.09
        onScaleChange(Math.max(0.25, Math.min(2.5, scale * factor)))
      } else {
        onPanChange(-e.deltaX, -e.deltaY)
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [scale, onPanChange, onScaleChange])

  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      isDragging.current = true
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      lastTouchDist.current = Math.sqrt(dx * dx + dy * dy)
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging.current) {
      const dx = e.touches[0].clientX - lastPos.current.x
      const dy = e.touches[0].clientY - lastPos.current.y
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      onPanChange(dx, dy)
    } else if (e.touches.length === 2 && lastTouchDist.current !== null) {
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const factor = dist / lastTouchDist.current
      lastTouchDist.current = dist
      onScaleChange(Math.max(0.25, Math.min(2.5, scale * factor)))
    }
  }, [onPanChange, onScaleChange, scale])

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false
    lastTouchDist.current = null
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#f8fafc',
        backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
        backgroundSize: `${24 * scale}px ${24 * scale}px`,
        backgroundPosition: `${panX}px ${panY}px`,
        cursor: isDragging.current ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Transform container */}
      <div
        style={{
          position: 'absolute',
          left: panX,
          top: panY,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
          width: maxX,
          height: maxY,
        }}
      >
        {/* Column headers */}
        <ColumnHeaders visibleLevels={visibleLevels} />

        {/* SVG edges */}
        <FlowEdges
          annualItems={annualItems}
          childrenByParentId={childrenByParentId}
          expandedIds={expandedIds}
          positions={positions}
          canvasWidth={maxX}
          canvasHeight={maxY}
        />

        {/* Nodes */}
        {allItems.map(({ item, level }) => {
          const pos = positions.get(item.id)
          if (!pos) return null

          const isExpanded = expandedIds.has(item.id)
          const isSelected = selectedId === item.id
          const isLoading = loadingIds.has(item.id)
          const children = childrenByParentId.get(item.id)
          const childCount = children?.length

          // Filter dimming
          let dimmed = false
          let highlighted = false

          if (searchQuery) {
            const matches = item.title.toLowerCase().includes(searchQuery.toLowerCase())
            dimmed = !matches
            highlighted = matches
          } else if (filterCategory || filterStatus) {
            const catMatch = !filterCategory || item.categories.includes(filterCategory)
            const statusMatch = !filterStatus || item.status === filterStatus
            dimmed = !(catMatch && statusMatch)
          }

          return (
            <div key={item.id} data-node="true">
              <FlowNode
                item={item}
                level={level}
                x={pos.x}
                y={pos.y}
                isExpanded={isExpanded}
                isSelected={isSelected}
                isLoading={isLoading}
                childCount={childCount}
                dimmed={dimmed}
                highlighted={highlighted}
                onToggleExpand={(e) => {
                  e.stopPropagation()
                  onToggleExpand(item, level)
                }}
                onSelect={(e) => {
                  e.stopPropagation()
                  onSelectNode(item, level)
                  // 카드 클릭 시 하위 계획도 함께 펼치기 (일일 제외)
                  if (level !== 'daily') {
                    onToggleExpand(item, level)
                  }
                }}
              />
            </div>
          )
        })}

        {/* Empty state */}
        {annualItems.length === 0 && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: '#9ca3af',
              pointerEvents: 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><ClipboardList size={40} /></div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
              연간 계획이 없습니다
            </div>
            <div style={{ fontSize: 13 }}>연간 계획 페이지에서 계획을 추가해보세요</div>
          </div>
        )}
      </div>
    </div>
  )
}

// Build flat list — 실제 item.level 사용 (분기 폴백 대응)
function buildFlatList(
  annualItems: PlanItem[],
  childrenByParentId: Map<string, PlanItem[]>,
  expandedIds: Set<string>
): { item: PlanItem; level: PlanLevel }[] {
  const result: { item: PlanItem; level: PlanLevel }[] = []

  function traverse(items: PlanItem[]) {
    for (const item of items) {
      const level = item.level as PlanLevel
      result.push({ item, level })
      if (expandedIds.has(item.id)) {
        const children = childrenByParentId.get(item.id) ?? []
        traverse(children)
      }
    }
  }

  traverse(annualItems)
  return result
}

function getVisibleLevels(
  annualItems: PlanItem[],
  childrenByParentId: Map<string, PlanItem[]>,
  expandedIds: Set<string>
): PlanLevel[] {
  const visible = new Set<PlanLevel>(['annual'])

  function traverse(items: PlanItem[]) {
    for (const item of items) {
      visible.add(item.level as PlanLevel)
      if (expandedIds.has(item.id)) {
        const children = childrenByParentId.get(item.id) ?? []
        traverse(children)
      }
    }
  }

  traverse(annualItems)
  return LEVELS.filter((l) => visible.has(l))
}
