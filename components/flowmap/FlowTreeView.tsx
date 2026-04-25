'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { PlanItem, PlanLevel } from '@/lib/types'
import { STATUS_CONFIG, getMonthWeeks, getWeekDays, getISOWeekPublic } from '@/lib/types'
import { getPlanItems, createPlanItem, updatePlanItem, deletePlanItem } from '@/lib/api'
import { useUndo } from '@/lib/undo-stack'
import { formatPeriodKey } from '@/lib/flowmap-layout'
import { ChevronDown, ChevronRight, Plus, Loader2, Clipboard, ClipboardPaste, Pencil, Trash2, Check } from 'lucide-react'
import { DashboardItemCard } from './DashboardItemCard'
import { ConnectionContext, ConnectionDot, useConnection } from './ConnectionContext'
import { getConnectionsForYear, createConnection, deleteConnectionBetween, isConnected, buildColorMap } from '@/lib/plan-connections'
import type { PlanConnection } from '@/lib/plan-connections'

// ── Config ──────────────────────────────────────────

interface FlowTreeViewProps {
  year: number
  annualItems: PlanItem[]
  itemsByQuarter: Map<string, PlanItem[]>
  searchQuery: string
  filterStatus: string | null
  onTopLevelChanged: () => void
}

const STYLE_MAP: Record<string, { hBg: string; hColor: string; accent: string; leftBorder: string }> = {
  annual:   { hBg: '#0f172a', hColor: '#fff',     accent: '#334155', leftBorder: '#475569' },
  'q-Q1':   { hBg: '#1d4ed8', hColor: '#fff',     accent: '#bfdbfe', leftBorder: '#3b82f6' },
  'q-Q2':   { hBg: '#15803d', hColor: '#fff',     accent: '#bbf7d0', leftBorder: '#22c55e' },
  'q-Q3':   { hBg: '#b45309', hColor: '#fff',     accent: '#fde68a', leftBorder: '#f59e0b' },
  'q-Q4':   { hBg: '#6d28d9', hColor: '#fff',     accent: '#ddd6fe', leftBorder: '#8b5cf6' },
  monthly:  { hBg: '#374151', hColor: '#fff',     accent: '#d1d5db', leftBorder: '#eab308' },
  weekly:   { hBg: '#4b5563', hColor: '#fff',     accent: '#e5e7eb', leftBorder: '#f97316' },
  daily:    { hBg: '#6b7280', hColor: '#fff',     accent: '#f3f4f6', leftBorder: '#ef4444' },
}
function getStyle(level: string, periodKey: string) {
  if (level === 'quarterly') return STYLE_MAP[`q-${periodKey.split('-')[1]}`] ?? STYLE_MAP.monthly
  return STYLE_MAP[level] ?? STYLE_MAP.daily
}

const STATUS_DOT: Record<string, string> = { completed: '#22c55e', in_progress: '#3b82f6', on_hold: '#f97316', pending: '#9ca3af' }

// ── Child periods ───────────────────────────────────

function getChildPeriods(level: PlanLevel, periodKey: string): { level: PlanLevel; periodKey: string; label: string }[] {
  if (level === 'quarterly') {
    const [y, q] = periodKey.split('-')
    const s = (parseInt(q.replace('Q', '')) - 1) * 3 + 1
    return [0, 1, 2].map(i => ({ level: 'monthly', periodKey: `${y}-${String(s + i).padStart(2, '0')}`, label: `${s + i}월` }))
  }
  if (level === 'monthly') {
    const [y, m] = periodKey.split('-')
    return getMonthWeeks(parseInt(y), parseInt(m)).map(k => ({ level: 'weekly', periodKey: k, label: `${parseInt(k.split('-W')[1])}주차` }))
  }
  if (level === 'weekly') {
    const [y, w] = periodKey.split('-W')
    const DAY = ['일', '월', '화', '수', '목', '금', '토']
    return getWeekDays(parseInt(y), parseInt(w)).map(k => {
      const p = k.split('-').map(Number); const d = new Date(parseInt(y), p[1] - 1, p[2])
      return { level: 'daily' as PlanLevel, periodKey: k, label: `${p[1]}/${p[2]}(${DAY[d.getDay()]})` }
    })
  }
  return []
}

// ── Today auto-expand keys ──────────────────────────

function getTodayKeys(year: number): { expandKeys: Set<string>; todayKey: string } {
  const now = new Date()
  const y = now.getFullYear()
  if (y !== year) return { expandKeys: new Set(), todayKey: '' }

  const m = now.getMonth() + 1
  const d = now.getDate()
  const q = Math.ceil(m / 3)

  const quarterKey = `${y}-Q${q}`
  const monthKey = `${y}-${String(m).padStart(2, '0')}`
  const dayKey = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  let todayWeekKey = ''
  try {
    const weekKeys = getMonthWeeks(y, m)
    for (const wk of weekKeys) {
      const [wy, ww] = wk.split('-W')
      const days = getWeekDays(parseInt(wy), parseInt(ww))
      if (days.includes(dayKey)) { todayWeekKey = wk; break }
    }
  } catch { /* ignore */ }

  const expandKeys = new Set([quarterKey, monthKey])
  if (todayWeekKey) {
    expandKeys.add(todayWeekKey)
    try {
      const [wy, ww] = todayWeekKey.split('-W')
      const days = getWeekDays(parseInt(wy), parseInt(ww))
      days.forEach(dk => expandKeys.add(dk))
    } catch { /* ignore */ }
  }

  return { expandKeys, todayKey: dayKey }
}

// ── Past period detection ───────────────────────────
function isPastPeriod(level: PlanLevel, periodKey: string): boolean {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const d = now.getDate()

  if (level === 'annual') return parseInt(periodKey) < y
  if (level === 'quarterly') {
    const [pyStr, qStr] = periodKey.split('-Q')
    const py = parseInt(pyStr), q = parseInt(qStr)
    if (py < y) return true
    if (py > y) return false
    return q < Math.ceil(m / 3)
  }
  if (level === 'monthly') {
    const parts = periodKey.split('-').map(Number)
    const py = parts[0], pm = parts[1]
    if (py < y) return true
    if (py > y) return false
    return pm < m
  }
  if (level === 'weekly') {
    const [pyStr, pwStr] = periodKey.split('-W')
    const py = parseInt(pyStr), pw = parseInt(pwStr)
    if (py < y) return true
    if (py > y) return false
    const currentWeek = getISOWeekPublic(now)
    return pw < currentWeek
  }
  if (level === 'daily') {
    const parts = periodKey.split('-').map(Number)
    const dt = new Date(parts[0], parts[1] - 1, parts[2])
    const todayD = new Date(y, m - 1, d)
    return dt.getTime() < todayD.getTime()
  }
  return false
}

// ── Past Group (collapsible wrapper for past periods) ──
function PastSectionGroup({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: 6 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none',
          padding: '6px 10px', borderRadius: 6, color: '#6b7280',
          borderLeft: '3px solid #d1d5db',
          backgroundColor: '#f8fafc',
          transition: 'background-color 0.1s',
        }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9' }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8fafc' }}
      >
        {open ? <ChevronDown size={13} style={{ flexShrink: 0 }} /> : <ChevronRight size={13} style={{ flexShrink: 0 }} />}
        <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{label}</span>
        <span style={{ fontSize: 10, opacity: 0.7, flexShrink: 0 }}>{count}개 숨김</span>
      </div>
      {open && (
        <div style={{ marginLeft: 10, paddingLeft: 8, borderLeft: '1px solid #e5e7eb', animation: 'flowFadeIn 0.15s ease', marginTop: 4 }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Main ────────────────────────────────────────────

export function FlowTreeView({ year, annualItems, itemsByQuarter, searchQuery, filterStatus, onTopLevelChanged }: FlowTreeViewProps) {
  const [copiedItem, setCopiedItem] = useState<PlanItem | null>(null)
  const [connections, setConnections] = useState<PlanConnection[]>([])
  const [colorMap, setColorMap] = useState<Map<string, string>>(new Map())
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [lines, setLines] = useState<Array<{ id: string; source_id: string; target_id: string; x1: number; y1: number; x2: number; y2: number; color: string }>>([])
  const [svgHeight, setSvgHeight] = useState(0)
  const { expandKeys, todayKey } = getTodayKeys(year)

  useEffect(() => {
    getConnectionsForYear(year).then(data => setConnections(data)).catch(() => {})
  }, [year])

  useEffect(() => { setColorMap(buildColorMap(connections)) }, [connections])

  const highlightedIds = useMemo<Set<string>>(() => {
    if (!connectingId) return new Set()
    const s = new Set<string>()
    for (const c of connections) {
      if (c.source_id === connectingId) s.add(c.target_id)
      if (c.target_id === connectingId) s.add(c.source_id)
    }
    return s
  }, [connectingId, connections])

  const updateLines = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const cRect = container.getBoundingClientRect()
    const sTop = container.scrollTop
    const nl: Array<{ id: string; source_id: string; target_id: string; x1: number; y1: number; x2: number; y2: number; color: string }> = []
    for (const conn of connections) {
      const srcEl = container.querySelector<HTMLElement>(`[data-dot-id="${conn.source_id}"]`)
      const tgtEl = container.querySelector<HTMLElement>(`[data-dot-id="${conn.target_id}"]`)
      if (!srcEl || !tgtEl) continue
      const sr = srcEl.getBoundingClientRect()
      const tr = tgtEl.getBoundingClientRect()
      nl.push({
        id: conn.id, source_id: conn.source_id, target_id: conn.target_id,
        x1: sr.left - cRect.left + sr.width / 2,
        y1: sr.top - cRect.top + sTop + sr.height / 2,
        x2: tr.left - cRect.left + tr.width / 2,
        y2: tr.top - cRect.top + sTop + tr.height / 2,
        color: colorMap.get(conn.source_id) ?? '#d1d5db',
      })
    }
    setLines(nl)
    setSvgHeight(container.scrollHeight)
  }, [connections, colorMap])

  useEffect(() => {
    const rafId = requestAnimationFrame(updateLines)
    return () => cancelAnimationFrame(rafId)
  }, [updateLines])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    let rafId = 0
    const schedule = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(updateLines) }
    const obs = new MutationObserver(schedule)
    obs.observe(container, { subtree: true, childList: true })
    container.addEventListener('scroll', schedule, { passive: true })
    return () => { obs.disconnect(); container.removeEventListener('scroll', schedule); cancelAnimationFrame(rafId) }
  }, [updateLines])

  const handleConnectClick = async (itemId: string) => {
    if (connectingId === null) { setConnectingId(itemId); return }
    if (connectingId === itemId) { setConnectingId(null); return }
    const fromId = connectingId
    setConnectingId(null)
    if (isConnected(connections, fromId, itemId)) {
      await deleteConnectionBetween(fromId, itemId)
      const [s, t] = fromId < itemId ? [fromId, itemId] : [itemId, fromId]
      setConnections(prev => prev.filter(c => !(c.source_id === s && c.target_id === t)))
    } else {
      try {
        const conn = await createConnection(fromId, itemId)
        setConnections(prev => [...prev, conn])
      } catch { /* ignore */ }
    }
  }

  // 오늘 섹션으로 자동 스크롤
  useEffect(() => {
    if (!todayKey) return
    const timer = setTimeout(() => {
      const el = scrollRef.current?.querySelector('[data-today="true"]')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 600)
    return () => clearTimeout(timer)
  }, [todayKey])

  return (
    <ConnectionContext.Provider value={{ colorMap, connectingId, highlightedIds, onConnectClick: handleConnectClick }}>
    <div ref={scrollRef} style={{ height: '100%', overflowY: 'auto', position: 'relative' }}>
      {lines.length > 0 && (
        <svg ref={svgRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: svgHeight || '100%', pointerEvents: 'none', zIndex: 5, overflow: 'visible' }}>
          {lines.map(line => {
            const isHL = connectingId ? (line.source_id === connectingId || line.target_id === connectingId) : false
            const isDim = !!connectingId && !isHL
            return (
              <line key={line.id}
                x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                stroke={line.color} strokeWidth={isHL ? 2.5 : 1.5}
                strokeDasharray={isHL ? undefined : '5 4'}
                strokeOpacity={isDim ? 0.12 : isHL ? 0.9 : 0.5}
                strokeLinecap="round"
              />
            )
          })}
        </svg>
      )}
      <div className="mx-auto w-full md:max-w-3xl px-4 pt-3 pb-20">
      <SectionNode
        key={`${year}-annual`} level="annual" periodKey={`${year}`}
        label={`${year}년 연간계획`} depth={0} initialItems={annualItems}
        searchQuery={searchQuery} filterStatus={filterStatus}
        onTopLevelChanged={onTopLevelChanged}
        copiedItem={copiedItem} onCopy={setCopiedItem}
        autoExpandKeys={expandKeys} todayKey={todayKey}
      />
      {(() => {
        const quarters = ['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => ({
          q, i, key: `${year}-${q}`,
          label: `${i + 1}분기 (${[(i * 3) + 1, (i * 3) + 2, (i * 3) + 3].join('·')}월)`,
          past: isPastPeriod('quarterly', `${year}-${q}`),
        }))
        const pastQ = quarters.filter(e => e.past)
        const activeQ = quarters.filter(e => !e.past)
        const renderQuarter = (e: typeof quarters[number]) => (
          <SectionNode key={e.key} level="quarterly" periodKey={e.key}
            label={e.label}
            depth={0} initialItems={itemsByQuarter.get(e.key)}
            searchQuery={searchQuery} filterStatus={filterStatus}
            onTopLevelChanged={onTopLevelChanged}
            copiedItem={copiedItem} onCopy={setCopiedItem}
            autoExpandKeys={expandKeys} todayKey={todayKey}
          />
        )
        return (
          <>
            {pastQ.length > 0 && (
              <PastSectionGroup label="지난 분기" count={pastQ.length}>
                {pastQ.map(renderQuarter)}
              </PastSectionGroup>
            )}
            {activeQ.map(renderQuarter)}
          </>
        )
      })()}
      </div>

      {/* 복사 알림 배너 */}
      {copiedItem && (
        <div style={{
          position: 'fixed', bottom: 56, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#1e293b', color: '#fff', padding: '8px 16px', borderRadius: 10,
          fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 50, maxWidth: 400,
          animation: 'flowFadeIn 0.15s ease',
        }}>
          <Clipboard size={14} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            &quot;{copiedItem.title}&quot; 복사됨
          </span>
          <button onClick={() => setCopiedItem(null)}
            style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 10 }}>
            취소
          </button>
        </div>
      )}

      {/* 연결 모드 배너 */}
      {connectingId && (
        <div style={{
          position: 'fixed', bottom: copiedItem ? 100 : 56, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#3b82f6', color: '#fff', padding: '8px 16px', borderRadius: 10,
          fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 8px 24px rgba(59,130,246,0.35)', zIndex: 50,
          animation: 'flowFadeIn 0.15s ease',
        }}>
          <span>🔗 연결할 항목의 점을 클릭하세요</span>
          <button onClick={() => setConnectingId(null)}
            style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 10 }}>취소</button>
        </div>
      )}

      <style>{`
        @keyframes flowSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes flowFadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes connPulse { 0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,0.4)} 50%{box-shadow:0 0 0 4px rgba(59,130,246,0.1)} }
      `}</style>
    </div>
    </ConnectionContext.Provider>
  )
}

// ── Section Node ────────────────────────────────────

interface SectionNodeProps {
  level: PlanLevel; periodKey: string; label: string; depth: number
  initialItems?: PlanItem[]; searchQuery: string; filterStatus: string | null
  onTopLevelChanged: () => void
  copiedItem: PlanItem | null; onCopy: (item: PlanItem | null) => void
  autoExpandKeys: Set<string>; todayKey: string
}

function SectionNode({ level, periodKey, label, depth, initialItems, searchQuery, filterStatus, onTopLevelChanged, copiedItem, onCopy, autoExpandKeys, todayKey }: SectionNodeProps) {
  const isPast = isPastPeriod(level, periodKey)
  const [expanded, setExpanded] = useState(
    autoExpandKeys.has(periodKey) || (!isPast && depth === 0)
  )
  const isToday = level === 'daily' && periodKey === todayKey
  const [items, setItems] = useState<PlanItem[]>(initialItems ?? [])
  const [loaded, setLoaded] = useState(!!initialItems)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [addingNew, setAddingNew] = useState(false)
  const [pasting, setPasting] = useState(false)
  const { push: pushUndo } = useUndo()

  const restorePlanItem = useCallback(async (src: PlanItem) => {
    return createPlanItem({
      title: src.title,
      description: src.description,
      categories: src.categories,
      status: src.status,
      priority: src.priority,
      level: src.level,
      period_key: src.period_key,
      sort_order: src.sort_order,
    })
  }, [])

  const onItemDeleted = useCallback((deleted: PlanItem) => {
    setItems(p => p.filter(i => i.id !== deleted.id))
    setSelectedIds(p => { const n = new Set(p); n.delete(deleted.id); return n })
    if (depth === 0) onTopLevelChanged()
    pushUndo({
      label: `"${deleted.title}" 계획 삭제됨`,
      restore: async () => {
        const restored = await restorePlanItem(deleted)
        setItems(p => [...p, restored])
        if (depth === 0) onTopLevelChanged()
      },
    })
  }, [depth, onTopLevelChanged, pushUndo, restorePlanItem])

  useEffect(() => { if (initialItems) { setItems(initialItems); setLoaded(true) } }, [initialItems])

  useEffect(() => {
    if (expanded && !loaded && !loading) {
      setLoading(true)
      getPlanItems(level, periodKey)
        .then(r => { setItems(r); setLoaded(true) })
        .catch(() => setLoaded(true))
        .finally(() => setLoading(false))
    }
  }, [expanded, loaded, loading, level, periodKey])

  const childPeriods = expanded ? getChildPeriods(level, periodKey) : []
  const st = getStyle(level, periodKey)
  const filteredItems = items.filter(item => {
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (filterStatus && item.status !== filterStatus) return false
    return true
  })
  const selCount = [...selectedIds].filter(id => filteredItems.some(i => i.id === id)).length
  const isTop = depth === 0
  const useDashboard = level === 'annual' || level === 'quarterly' || level === 'monthly'

  const handleBulkDelete = async () => {
    const targets = items.filter(i => selectedIds.has(i.id))
    const ids = targets.map(t => t.id)
    setDeletingBulk(true); setItems(p => p.filter(i => !ids.includes(i.id)))
    setSelectedIds(new Set()); setShowDeleteConfirm(false); setDeletingBulk(false)
    await Promise.allSettled(ids.map(id => deletePlanItem(id)))
    if (depth === 0) onTopLevelChanged()
    if (targets.length > 0) {
      pushUndo({
        label: targets.length === 1
          ? `"${targets[0].title}" 계획 삭제됨`
          : `${targets.length}개 계획 삭제됨`,
        restore: async () => {
          const restored = await Promise.all(targets.map(restorePlanItem))
          setItems(p => [...p, ...restored])
          if (depth === 0) onTopLevelChanged()
        },
      })
    }
  }

  const handlePaste = async () => {
    if (!copiedItem) return
    setPasting(true)
    try {
      const item = await createPlanItem({
        level, period_key: periodKey, title: copiedItem.title,
        description: copiedItem.description, categories: copiedItem.categories,
        status: 'pending', priority: copiedItem.priority, sort_order: 0,
      })
      setItems(p => [...p, item])
      if (depth === 0) onTopLevelChanged()
    } catch { /* ignore */ } finally { setPasting(false) }
  }

  return (
    <div style={{ marginBottom: isTop ? 12 : depth === 1 ? 6 : 3 }} data-today={isToday ? 'true' : undefined}>
      {/* Header */}
      <div onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none',
          padding: isTop ? '9px 14px' : depth === 1 ? '6px 10px' : '4px 8px',
          borderRadius: isTop ? 10 : 6,
          backgroundColor: isToday ? '#fef3c7' : (isTop ? st.hBg : 'transparent'),
          color: isToday ? '#92400e' : (isTop ? st.hColor : st.hBg),
          borderLeft: !isTop ? `3px solid ${isToday ? '#f59e0b' : st.leftBorder}` : 'none',
          border: isToday ? '2px solid #f59e0b' : 'none',
          transition: 'background-color 0.1s',
          boxShadow: isToday ? '0 0 12px rgba(245,158,11,0.25)' : 'none',
        }}
        onMouseEnter={e => { if (!isTop && !isToday) e.currentTarget.style.backgroundColor = '#f3f4f6' }}
        onMouseLeave={e => { if (!isTop && !isToday) e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        {expanded ? <ChevronDown size={isTop ? 15 : 13} style={{ flexShrink: 0 }} /> : <ChevronRight size={isTop ? 15 : 13} style={{ flexShrink: 0 }} />}
        <span style={{ fontWeight: isTop ? 700 : 600, fontSize: isTop ? 13 : depth === 1 ? 12 : 11, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
          {isToday && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, backgroundColor: '#f59e0b', color: '#fff', padding: '1px 6px', borderRadius: 8 }}>오늘</span>}
        </span>
        {loaded && <span style={{ fontSize: 10, opacity: 0.6, flexShrink: 0 }}>{items.length}개</span>}
        {selCount > 0 && (
          <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 8, backgroundColor: isTop ? 'rgba(255,255,255,0.2)' : '#dbeafe', color: isTop ? '#fff' : '#1d4ed8', flexShrink: 0 }}>
            {selCount}선택
          </span>
        )}
        <button onClick={e => { e.stopPropagation(); selCount > 0 && setShowDeleteConfirm(true) }} style={{ ...actionBtn(isTop, selCount > 0, true), flexShrink: 0 }}>−</button>
        <button onClick={e => { e.stopPropagation(); setAddingNew(true); setExpanded(true) }} style={{ ...actionBtn(isTop, true, false), flexShrink: 0 }}><Plus size={isTop ? 12 : 10} /></button>
        {copiedItem && (
          <button onClick={e => { e.stopPropagation(); handlePaste() }} disabled={pasting}
            title={`"${copiedItem.title}" 붙여넣기`}
            style={{
              padding: isTop ? '3px 7px' : '2px 5px', borderRadius: 4, flexShrink: 0,
              border: `1px solid ${isTop ? 'rgba(255,255,255,0.3)' : '#86efac'}`,
              background: isTop ? 'rgba(34,197,94,0.2)' : '#f0fdf4',
              color: isTop ? '#86efac' : '#15803d',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, fontWeight: 600,
            }}>
            {pasting ? <Loader2 size={9} style={{ animation: 'flowSpin 1s linear infinite' }} /> : <ClipboardPaste size={9} />}
            붙여넣기
          </button>
        )}
      </div>

      {/* Content */}
      {expanded && (
        <div style={{ marginLeft: isTop ? 0 : 10, paddingLeft: isTop ? 12 : 8, borderLeft: !isTop ? `1px solid ${st.accent}` : 'none', animation: 'flowFadeIn 0.15s ease' }}>
          {addingNew && (
            <InlineAddForm level={level} periodKey={periodKey}
              onSaved={item => { setItems(p => [...p, item]); setAddingNew(false); if (depth === 0) onTopLevelChanged() }}
              onCancel={() => setAddingNew(false)} />
          )}
          {loading && (
            <div style={{ padding: '10px 0', display: 'flex', alignItems: 'center', gap: 6, color: '#9ca3af', fontSize: 11 }}>
              <Loader2 size={14} style={{ animation: 'flowSpin 1s linear infinite' }} /> 불러오는 중...
            </div>
          )}
          {!loading && filteredItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: useDashboard ? 8 : 3, padding: '6px 0' }}>
              {filteredItems.map(item =>
                useDashboard ? (
                  <DashboardItemCard key={item.id} item={item} isSelected={selectedIds.has(item.id)}
                    showProgress={level === 'annual'}
                    onSelect={id => setSelectedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })}
                    onUpdated={u => { setItems(p => p.map(i => i.id === u.id ? u : i)); if (depth === 0) onTopLevelChanged() }}
                    onDeleted={onItemDeleted}
                    onCopy={onCopy} />
                ) : (
                  <ItemCard key={item.id} item={item} isSelected={selectedIds.has(item.id)} compact={depth >= 2}
                    onSelect={id => setSelectedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })}
                    onUpdated={u => { setItems(p => p.map(i => i.id === u.id ? u : i)); if (depth === 0) onTopLevelChanged() }}
                    onDeleted={onItemDeleted}
                    onCopy={onCopy} />
                )
              )}
            </div>
          )}
          {childPeriods.length > 0 && (() => {
            const renderChild = (child: typeof childPeriods[number]) => (
              <SectionNode key={child.periodKey} level={child.level} periodKey={child.periodKey} label={child.label}
                depth={depth + 1} searchQuery={searchQuery} filterStatus={filterStatus}
                onTopLevelChanged={onTopLevelChanged} copiedItem={copiedItem} onCopy={onCopy}
                autoExpandKeys={autoExpandKeys} todayKey={todayKey} />
            )
            const shouldGroup = (level === 'quarterly' || level === 'monthly') && !isPast
            if (!shouldGroup) {
              return <div style={{ paddingTop: 2 }}>{childPeriods.map(renderChild)}</div>
            }
            const pastChildren = childPeriods.filter(c => isPastPeriod(c.level, c.periodKey))
            const activeChildren = childPeriods.filter(c => !isPastPeriod(c.level, c.periodKey))
            const groupLabel = level === 'quarterly' ? '지난 월' : '지난 주차'
            return (
              <div style={{ paddingTop: 2 }}>
                {pastChildren.length > 0 && (
                  <PastSectionGroup label={groupLabel} count={pastChildren.length}>
                    {pastChildren.map(renderChild)}
                  </PastSectionGroup>
                )}
                {activeChildren.map(renderChild)}
              </div>
            )
          })()}
        </div>
      )}
      {showDeleteConfirm && <DeleteConfirm count={selCount} deleting={deletingBulk} onConfirm={handleBulkDelete} onCancel={() => setShowDeleteConfirm(false)} />}
    </div>
  )
}

function actionBtn(isTop: boolean, active: boolean, isDel: boolean): React.CSSProperties {
  const s = isTop ? 22 : 18
  return {
    width: s, height: s, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${active ? (isDel ? (isTop ? 'rgba(255,100,100,0.5)' : '#fca5a5') : (isTop ? 'rgba(255,255,255,0.3)' : '#bfdbfe')) : (isTop ? 'rgba(255,255,255,0.15)' : '#e5e7eb')}`,
    background: active ? (isDel ? (isTop ? 'rgba(255,80,80,0.15)' : '#fff5f5') : (isTop ? 'rgba(255,255,255,0.1)' : '#eff6ff')) : 'transparent',
    color: active ? (isDel ? (isTop ? '#fca5a5' : '#ef4444') : (isTop ? '#fff' : '#1d4ed8')) : (isTop ? 'rgba(255,255,255,0.2)' : '#d1d5db'),
    cursor: active ? 'pointer' : 'default', fontSize: isTop ? 14 : 12, fontWeight: 700, lineHeight: 1, padding: 0,
  }
}

// ── Item Card ───────────────────────────────────────

function ItemCard({ item, isSelected, compact, onSelect, onUpdated, onDeleted, onCopy }: {
  item: PlanItem; isSelected: boolean; compact: boolean
  onSelect: (id: string) => void; onUpdated: (item: PlanItem) => void; onDeleted: (item: PlanItem) => void
  onCopy: (item: PlanItem | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [saving, setSaving] = useState(false)
  const dot = STATUS_DOT[item.status] ?? '#9ca3af'
  const { colorMap: connMap, highlightedIds: hlIds } = useConnection()
  const connColor = connMap.get(item.id)
  const isConnHL = hlIds.has(item.id)

  const handleSave = async () => {
    if (!title.trim()) return; setSaving(true)
    try { const u = await updatePlanItem(item.id, { title: title.trim() }); onUpdated(u); setEditing(false) }
    catch { /* ignore */ } finally { setSaving(false) }
  }

  if (editing) {
    return (
      <div style={{ border: '1.5px solid #3b82f6', borderRadius: 8, padding: '8px 10px', backgroundColor: '#eff6ff', display: 'flex', flexDirection: 'column', gap: 6, animation: 'flowFadeIn 0.12s ease' }}>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditing(false); setTitle(item.title) } }}
          style={{ width: '100%', padding: '5px 8px', borderRadius: 5, border: '1px solid #bfdbfe', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
          <button onClick={async () => { try { await deletePlanItem(item.id); onDeleted(item) } catch { /* ignore */ } }}
            style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #fca5a5', background: '#fff', color: '#ef4444', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}><Trash2 size={10} />삭제</button>
          <button onClick={() => { setEditing(false); setTitle(item.title) }}
            style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid #e5e7eb', background: '#fff', fontSize: 10, cursor: 'pointer' }}>취소</button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={10} style={{ animation: 'flowSpin 1s linear infinite' }} /> : <Check size={10} />} 저장
          </button>
        </div>
      </div>
    )
  }

  return (
    <div onClick={() => onSelect(item.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: compact ? '4px 7px' : '6px 10px', borderRadius: 7,
        border: `1.5px solid ${isSelected ? '#3b82f6' : isConnHL ? (connColor ?? '#22c55e') : connColor ? connColor + '50' : '#e5e7eb'}`,
        backgroundColor: isSelected ? '#eff6ff' : isConnHL ? `${connColor ?? '#22c55e'}12` : '#fff',
        cursor: 'pointer', userSelect: 'none', transition: 'all 0.1s',
        boxShadow: isConnHL ? `inset 3px 0 0 ${connColor ?? '#22c55e'}, 0 0 0 2px ${connColor ?? '#22c55e'}25` : isSelected ? '0 0 0 1px rgba(59,130,246,0.2)' : 'none',
      }}
      onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)' } }}
      onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' } }}
    >
      <ConnectionDot itemId={item.id} />
      {isSelected && <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ color: '#fff', fontSize: 8, fontWeight: 900 }}>✓</span></div>}
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dot, flexShrink: 0 }} />
      <span style={{ fontSize: compact ? 11 : 12, fontWeight: 500, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
      <span style={{ fontSize: 9, color: dot, fontWeight: 600, flexShrink: 0 }}>{STATUS_CONFIG[item.status]?.label}</span>
      <button onClick={e => { e.stopPropagation(); onCopy(item) }} title="복사"
        style={{ padding: '2px 4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', borderRadius: 3, flexShrink: 0 }}>
        <Clipboard size={compact ? 9 : 10} color="#9ca3af" />
      </button>
      <button onClick={e => { e.stopPropagation(); setEditing(true) }} title="수정"
        style={{ padding: '2px 4px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', borderRadius: 3, flexShrink: 0 }}>
        <Pencil size={compact ? 9 : 10} color="#9ca3af" />
      </button>
    </div>
  )
}

// ── Inline Add Form ─────────────────────────────────

function InlineAddForm({ level, periodKey, onSaved, onCancel }: { level: PlanLevel; periodKey: string; onSaved: (item: PlanItem) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const handleSave = async () => {
    if (!title.trim()) return; setSaving(true)
    try {
      const item = await createPlanItem({ level, period_key: periodKey, title: title.trim(), description: null, categories: [], status: 'pending', priority: 'medium', sort_order: 0 })
      onSaved(item)
    } catch { /* ignore */ } finally { setSaving(false) }
  }
  return (
    <div style={{ border: '1.5px dashed #3b82f6', borderRadius: 8, padding: '8px 10px', backgroundColor: '#f0f7ff', margin: '6px 0', display: 'flex', flexDirection: 'column', gap: 6, animation: 'flowFadeIn 0.12s ease' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#3b82f6' }}>새 {formatPeriodKey(periodKey, level)} 계획 추가</div>
      <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel() }}
        placeholder="계획 제목 입력" style={{ width: '100%', padding: '6px 8px', borderRadius: 5, border: '1px solid #bfdbfe', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid #e5e7eb', background: '#fff', fontSize: 10, cursor: 'pointer' }}>취소</button>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: '3px 10px', borderRadius: 4, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 size={10} style={{ animation: 'flowSpin 1s linear infinite' }} /> : <Plus size={10} />} 추가
        </button>
      </div>
    </div>
  )
}

// ── Delete Confirm ──────────────────────────────────

function DeleteConfirm({ count, deleting, onConfirm, onCancel }: { count: number; deleting: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 14, padding: '20px 24px', boxShadow: '0 16px 48px rgba(0,0,0,0.2)', maxWidth: 300, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>🗑️</div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>계획 삭제</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}><strong style={{ color: '#ef4444' }}>{count}개</strong> 계획을 삭제하시겠습니까?</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer' }}>취소</button>
          <button onClick={onConfirm} disabled={deleting}
            style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}>삭제</button>
        </div>
      </div>
    </div>
  )
}
