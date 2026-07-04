'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronRight, ChevronDown, Plus, Trash2, Check } from 'lucide-react'
import type { PlanItem, PlanLevel } from '@/lib/types'
import { STATUS_CONFIG } from '@/lib/types'
import {
  getPlanItemsForYear,
  getDailyItemsForYear,
  createPlanItem,
  updatePlanItem,
  deletePlanItem,
} from '@/lib/api'
import {
  getChildPeriodKeys,
  formatPeriodLabel,
  getISOWeek,
} from '@/lib/flowmap-v2-utils'
import { getConnectionsForYear, type PlanConnection } from '@/lib/plan-connections'

interface AnnualDescendantsTreeProps {
  annualItemId: string
  year: number
  onChanged?: () => void
}

// ─── 레벨별 스타일 ──────────────────────────────────────────
// 좌측 세로 컬러바 + 헤더 배경으로 레벨 구분
const LEVEL_STYLE: Record<PlanLevel, { bar: string; headerBg: string; headerBgActive: string; text: string; badge: string }> = {
  annual:    { bar: '#7c3aed', headerBg: '#faf5ff', headerBgActive: '#ede9fe', text: '#5b21b6', badge: '#ede9fe' },
  quarterly: { bar: '#7c3aed', headerBg: '#faf5ff', headerBgActive: '#ede9fe', text: '#5b21b6', badge: '#ede9fe' },
  monthly:   { bar: '#ea580c', headerBg: '#fff7ed', headerBgActive: '#ffedd5', text: '#9a3412', badge: '#ffedd5' },
  weekly:    { bar: '#0891b2', headerBg: '#ecfeff', headerBgActive: '#cffafe', text: '#155e75', badge: '#cffafe' },
  daily:     { bar: '#db2777', headerBg: '#fdf2f8', headerBgActive: '#fce7f3', text: '#9d174d', badge: '#fce7f3' },
}

const LEVEL_ADD_LABEL: Record<PlanLevel, string> = {
  annual: '연간 추가',
  quarterly: '분기 계획 추가',
  monthly: '월 계획 추가',
  weekly: '주 계획 추가',
  daily: '일 계획 추가',
}

const STATUS_DOT: Record<string, string> = {
  completed: '#22c55e',
  in_progress: '#3b82f6',
  on_hold: '#f97316',
  pending: '#9ca3af',
}

// ─── 오늘 경로 계산 ─────────────────────────────────────────
interface TodayPath {
  quarter: string
  month: string
  week: string
  day: string
}

function computeTodayPath(year: number): TodayPath | null {
  const now = new Date()
  if (now.getFullYear() !== year) return null
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const d = now.getDate()
  const q = Math.ceil(m / 3)
  const w = getISOWeek(now)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    quarter: `${y}-Q${q}`,
    month: `${y}-${pad(m)}`,
    week: `${y}-W${pad(w)}`,
    day: `${y}-${pad(m)}-${pad(d)}`,
  }
}

// ─── 레벨 우선순위 (상위→하위) ─────────────────────────────
const LEVEL_PRIORITY: Record<PlanLevel, number> = {
  annual: 0,
  quarterly: 1,
  monthly: 2,
  weekly: 3,
  daily: 4,
}

// ─── 후손 관계 계산 ─────────────────────────────────────────
// 두 그래프를 병합해서 계산한다:
//  (1) parent_plan_item_id 링크 — 신규 v2 트리에서 만든 것
//  (2) plan_item_connections 링크 — 옛 플로우맵에서 만든 연결
// 각 링크는 상위 레벨(annual→quarterly→…→daily) 방향으로만 트리에 반영한다.
function buildDescendantSet(
  allItems: PlanItem[],
  connections: PlanConnection[],
  annualItemId: string,
): Set<string> {
  const itemById = new Map(allItems.map(i => [i.id, i]))
  const childrenOf = new Map<string, string[]>()

  const addChild = (parentId: string, childId: string) => {
    if (parentId === childId) return
    const list = childrenOf.get(parentId) ?? []
    if (!list.includes(childId)) list.push(childId)
    childrenOf.set(parentId, list)
  }

  // (1) parent_plan_item_id 그래프
  for (const it of allItems) {
    if (it.parent_plan_item_id) addChild(it.parent_plan_item_id, it.id)
  }

  // (2) plan_item_connections 그래프 — 레벨 낮은 쪽(상위)이 부모
  for (const c of connections) {
    const src = itemById.get(c.source_id)
    const tgt = itemById.get(c.target_id)
    if (!src || !tgt) continue
    const ps = LEVEL_PRIORITY[src.level]
    const pt = LEVEL_PRIORITY[tgt.level]
    if (ps < pt) addChild(src.id, tgt.id)
    else if (pt < ps) addChild(tgt.id, src.id)
    // 같은 레벨끼리는 트리에 반영하지 않는다 (형제 관계로 간주)
  }

  // BFS로 후손 수집
  const set = new Set<string>()
  const stack: string[] = [annualItemId]
  while (stack.length > 0) {
    const cur = stack.pop() as string
    const kids = childrenOf.get(cur) ?? []
    for (const kid of kids) {
      if (!set.has(kid)) {
        set.add(kid)
        stack.push(kid)
      }
    }
  }
  return set
}

// ─── 자식 레벨 매핑 ─────────────────────────────────────────
function childLevelOf(level: PlanLevel): PlanLevel | null {
  const map: Partial<Record<PlanLevel, PlanLevel>> = {
    quarterly: 'monthly',
    monthly: 'weekly',
    weekly: 'daily',
  }
  return map[level] ?? null
}

// ─── 부모 periodKey → 자식 periodKey 관계에서, 이 아이템이 속할 부모 결정 ──
// 특정 후손 아이템의 실제 parent_plan_item_id 를 사용하지만, 우리는 기간 트리에 배치할 때
// 아이템의 (level, period_key) 로만 그룹핑한다. parent_plan_item_id는 후손 집합 판정에만 사용.

// ─── 메인 컴포넌트 ─────────────────────────────────────────

export function AnnualDescendantsTree({
  annualItemId,
  year,
  onChanged,
}: AnnualDescendantsTreeProps) {
  const [allItems, setAllItems] = useState<PlanItem[]>([])
  const [connections, setConnections] = useState<PlanConnection[]>([])
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [nonDaily, daily, conns] = await Promise.all([
        getPlanItemsForYear(year),
        getDailyItemsForYear(year),
        getConnectionsForYear(year),
      ])
      setAllItems([...nonDaily, ...daily])
      setConnections(conns)
    } catch {
      // 조용히 실패
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleChanged = useCallback(() => {
    loadAll()
    onChanged?.()
  }, [loadAll, onChanged])

  const descendantSet = useMemo(
    () => buildDescendantSet(allItems, connections, annualItemId),
    [allItems, connections, annualItemId],
  )

  const itemsByKey = useMemo(() => {
    const map = new Map<string, PlanItem[]>()
    for (const it of allItems) {
      if (!descendantSet.has(it.id)) continue
      const key = `${it.level}:${it.period_key}`
      const list = map.get(key) ?? []
      list.push(it)
      map.set(key, list)
    }
    for (const [k, v] of map.entries()) {
      v.sort((a, b) => a.sort_order - b.sort_order)
      map.set(k, v)
    }
    return map
  }, [allItems, descendantSet])

  const todayPath = useMemo(() => computeTodayPath(year), [year])

  if (loading) {
    return (
      <div style={{ fontSize: 12, color: '#9ca3af', padding: '6px 4px' }}>
        불러오는 중...
      </div>
    )
  }

  const quarterKeys = [1, 2, 3, 4].map(q => `${year}-Q${q}`)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {quarterKeys.map(qKey => (
        <PeriodGroup
          key={qKey}
          level="quarterly"
          periodKey={qKey}
          annualItemId={annualItemId}
          itemsByKey={itemsByKey}
          todayPath={todayPath}
          defaultOpen={todayPath?.quarter === qKey}
          onChanged={handleChanged}
        />
      ))}
    </div>
  )
}

// ─── 기간 그룹 (재귀) ──────────────────────────────────────

interface PeriodGroupProps {
  level: PlanLevel
  periodKey: string
  annualItemId: string
  itemsByKey: Map<string, PlanItem[]>
  todayPath: TodayPath | null
  defaultOpen: boolean
  onChanged: () => void
}

function PeriodGroup({
  level,
  periodKey,
  annualItemId,
  itemsByKey,
  todayPath,
  defaultOpen,
  onChanged,
}: PeriodGroupProps) {
  const [open, setOpen] = useState(defaultOpen)

  const items = itemsByKey.get(`${level}:${periodKey}`) ?? []
  const childLevel = childLevelOf(level)
  const childKeys = childLevel ? getChildPeriodKeys(periodKey) : []

  // 후손 건수 (자기 + 하위)
  const totalCount = useMemo(() => {
    if (!childLevel) return items.length
    let count = items.length
    const walk = (lvl: PlanLevel, keys: string[]) => {
      const next = childLevelOf(lvl)
      for (const k of keys) {
        const list = itemsByKey.get(`${lvl}:${k}`) ?? []
        count += list.length
        if (next) {
          walk(next, getChildPeriodKeys(k))
        }
      }
    }
    walk(childLevel, childKeys)
    return count
  }, [items.length, level, childLevel, childKeys, itemsByKey])

  const isTodayGroup =
    (level === 'quarterly' && todayPath?.quarter === periodKey) ||
    (level === 'monthly' && todayPath?.month === periodKey) ||
    (level === 'weekly' && todayPath?.week === periodKey) ||
    (level === 'daily' && todayPath?.day === periodKey)

  const style = LEVEL_STYLE[level]
  const label = formatPeriodLabel(periodKey)

  return (
    <div
      style={{
        borderLeft: `3px solid ${style.bar}`,
        borderRadius: 6,
        overflow: 'hidden',
        backgroundColor: '#fff',
      }}
    >
      {/* 헤더 */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 8px',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: open ? style.headerBgActive : style.headerBg,
          transition: 'background-color 0.12s',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {open ? (
            <ChevronDown size={13} color={style.bar} />
          ) : (
            <ChevronRight size={13} color={style.bar} />
          )}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: style.text,
            minWidth: 42,
            flexShrink: 0,
          }}
        >
          {label}
        </span>
        {isTodayGroup && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: '#fff',
              backgroundColor: style.bar,
              borderRadius: 8,
              padding: '1px 6px',
              flexShrink: 0,
              letterSpacing: 0.3,
            }}
          >
            오늘
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: style.text,
            backgroundColor: style.badge,
            borderRadius: 10,
            padding: '1px 7px',
            flexShrink: 0,
          }}
        >
          {totalCount}건
        </span>
      </div>

      {/* 본문 */}
      {open && (
        <div style={{ padding: '4px 6px 6px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* 이 기간의 계획 아이템들 */}
          {items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {items.map(it => (
                <ItemCard key={it.id} item={it} onChanged={onChanged} />
              ))}
            </div>
          )}

          {/* 인라인 추가 */}
          <AddInline
            level={level}
            periodKey={periodKey}
            parentId={annualItemId}
            sortOrder={items.length}
            onAdded={onChanged}
          />

          {/* 자식 기간 그룹 */}
          {childLevel && childKeys.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
              {childKeys.map(ck => {
                const isTodayChild =
                  (childLevel === 'monthly' && todayPath?.month === ck) ||
                  (childLevel === 'weekly' && todayPath?.week === ck) ||
                  (childLevel === 'daily' && todayPath?.day === ck)
                return (
                  <PeriodGroup
                    key={ck}
                    level={childLevel}
                    periodKey={ck}
                    annualItemId={annualItemId}
                    itemsByKey={itemsByKey}
                    todayPath={todayPath}
                    defaultOpen={isTodayChild}
                    onChanged={onChanged}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 아이템 카드 ────────────────────────────────────────────

function ItemCard({ item, onChanged }: { item: PlanItem; onChanged: () => void }) {
  const [hovered, setHovered] = useState(false)
  const dot = STATUS_DOT[item.status] ?? STATUS_DOT.pending
  const statusLabel = STATUS_CONFIG[item.status]?.label ?? item.status
  const isDone = item.status === 'completed'

  const handleToggleDone = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await updatePlanItem(item.id, { status: isDone ? 'pending' : 'completed' })
      onChanged()
    } catch {
      // 조용히 실패
    }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`"${item.title}" 항목을 삭제하시겠습니까?`)) return
    try {
      await deletePlanItem(item.id)
      onChanged()
    } catch {
      // 조용히 실패
    }
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        borderRadius: 6,
        border: '1px solid #e5e7eb',
        backgroundColor: hovered ? '#f9fafb' : '#fff',
        transition: 'background-color 0.1s',
      }}
    >
      {/* 완료 체크 */}
      <button
        onClick={handleToggleDone}
        title={isDone ? '미완료로 변경' : '완료 처리'}
        style={{
          flexShrink: 0,
          width: 14,
          height: 14,
          borderRadius: '50%',
          border: `1.5px solid ${isDone ? '#22c55e' : '#d1d5db'}`,
          backgroundColor: isDone ? '#22c55e' : '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        {isDone && <Check size={9} color="#fff" strokeWidth={3} />}
      </button>

      {/* 상태점 */}
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: dot,
          flexShrink: 0,
        }}
      />

      {/* 제목 */}
      <span
        style={{
          flex: 1,
          fontSize: 12.5,
          fontWeight: 500,
          color: isDone ? '#9ca3af' : '#111827',
          textDecoration: isDone ? 'line-through' : 'none',
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}
      >
        {item.title}
      </span>

      {/* 상태 배지 */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: dot,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {statusLabel}
      </span>

      {/* 삭제 (hover 시만) */}
      <button
        onClick={handleDelete}
        title="삭제"
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          borderRadius: 4,
          color: '#f87171',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.12s',
        }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

// ─── 인라인 추가 ────────────────────────────────────────────

interface AddInlineProps {
  level: PlanLevel
  periodKey: string
  parentId: string
  sortOrder: number
  onAdded: () => void
}

function AddInline({ level, periodKey, parentId, sortOrder, onAdded }: AddInlineProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const style = LEVEL_STYLE[level]

  const handleAdd = async () => {
    const t = title.trim()
    if (!t) return
    try {
      await createPlanItem({
        level,
        period_key: periodKey,
        title: t,
        description: null,
        categories: [],
        status: 'pending',
        priority: 'medium',
        sort_order: sortOrder,
        parent_plan_item_id: parentId,
        section_id: null,
      })
      setTitle('')
      setOpen(false)
      onAdded()
    } catch {
      // 조용히 실패
    }
  }

  if (open) {
    return (
      <div
        style={{
          display: 'flex',
          gap: 4,
          alignItems: 'center',
          padding: '3px 4px',
        }}
      >
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleAdd()
            if (e.key === 'Escape') { setOpen(false); setTitle('') }
          }}
          placeholder="제목 입력 후 Enter"
          style={{
            flex: 1,
            fontSize: 12,
            padding: '4px 8px',
            border: `1px solid ${style.bar}`,
            borderRadius: 5,
            outline: 'none',
            color: '#111827',
          }}
        />
        <button
          onClick={handleAdd}
          style={{
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 5,
            border: 'none',
            backgroundColor: style.bar,
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          추가
        </button>
        <button
          onClick={() => { setOpen(false); setTitle('') }}
          style={{
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 5,
            border: '1px solid #e5e7eb',
            backgroundColor: '#fff',
            cursor: 'pointer',
            color: '#6b7280',
          }}
        >
          취소
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setOpen(true)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 500,
        color: style.text,
        padding: '3px 8px',
        borderRadius: 5,
        border: `1px dashed ${style.bar}55`,
        background: 'transparent',
        cursor: 'pointer',
        alignSelf: 'flex-start',
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = style.headerBgActive
        e.currentTarget.style.borderColor = style.bar
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'transparent'
        e.currentTarget.style.borderColor = `${style.bar}55`
      }}
    >
      <Plus size={11} />
      {LEVEL_ADD_LABEL[level]}
    </button>
  )
}
