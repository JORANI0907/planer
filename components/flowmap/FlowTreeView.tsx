'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PlanItem, PlanLevel } from '@/lib/types'
import { STATUS_CONFIG, PRIORITY_CONFIG, getMonthWeeks, getWeekDays } from '@/lib/types'
import { getPlanItems, createPlanItem, updatePlanItem, deletePlanItem } from '@/lib/api'
import { formatPeriodKey } from '@/lib/flowmap-layout'
import { ChevronDown, ChevronRight, Plus, Loader2, Clipboard, ClipboardPaste, Pencil, Trash2, Check, X, BarChart3 } from 'lucide-react'

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
  monthly:  { hBg: '#374151', hColor: '#fff',     accent: '#d1d5db', leftBorder: '#6b7280' },
  weekly:   { hBg: '#4b5563', hColor: '#fff',     accent: '#e5e7eb', leftBorder: '#9ca3af' },
  daily:    { hBg: '#6b7280', hColor: '#fff',     accent: '#f3f4f6', leftBorder: '#d1d5db' },
}
function getStyle(level: string, periodKey: string) {
  if (level === 'quarterly') return STYLE_MAP[`q-${periodKey.split('-')[1]}`] ?? STYLE_MAP.monthly
  return STYLE_MAP[level] ?? STYLE_MAP.daily
}

const STATUS_DOT: Record<string, string> = { completed: '#22c55e', in_progress: '#3b82f6', on_hold: '#f97316', pending: '#9ca3af' }
const PROGRESS: Record<string, number> = { completed: 100, in_progress: 50, on_hold: 25, pending: 0 }

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

// ── Main ────────────────────────────────────────────

export function FlowTreeView({ year, annualItems, itemsByQuarter, searchQuery, filterStatus, onTopLevelChanged }: FlowTreeViewProps) {
  const [copiedItem, setCopiedItem] = useState<PlanItem | null>(null)

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '12px 16px 80px', position: 'relative' }}>
      <SectionNode
        key={`${year}-annual`} level="annual" periodKey={`${year}`}
        label={`${year}년 연간계획`} depth={0} initialItems={annualItems}
        searchQuery={searchQuery} filterStatus={filterStatus}
        onTopLevelChanged={onTopLevelChanged}
        copiedItem={copiedItem} onCopy={setCopiedItem}
      />
      {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => {
        const key = `${year}-${q}`
        return (
          <SectionNode key={key} level="quarterly" periodKey={key}
            label={`${i + 1}분기 (${[(i * 3) + 1, (i * 3) + 2, (i * 3) + 3].join('·')}월)`}
            depth={0} initialItems={itemsByQuarter.get(key)}
            searchQuery={searchQuery} filterStatus={filterStatus}
            onTopLevelChanged={onTopLevelChanged}
            copiedItem={copiedItem} onCopy={setCopiedItem}
          />
        )
      })}

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

      <style>{`
        @keyframes flowSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes flowFadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}

// ── Section Node ────────────────────────────────────

interface SectionNodeProps {
  level: PlanLevel; periodKey: string; label: string; depth: number
  initialItems?: PlanItem[]; searchQuery: string; filterStatus: string | null
  onTopLevelChanged: () => void
  copiedItem: PlanItem | null; onCopy: (item: PlanItem | null) => void
}

function SectionNode({ level, periodKey, label, depth, initialItems, searchQuery, filterStatus, onTopLevelChanged, copiedItem, onCopy }: SectionNodeProps) {
  const [expanded, setExpanded] = useState(depth === 0)
  const [items, setItems] = useState<PlanItem[]>(initialItems ?? [])
  const [loaded, setLoaded] = useState(!!initialItems)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [addingNew, setAddingNew] = useState(false)
  const [pasting, setPasting] = useState(false)

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
  const isAnnual = level === 'annual'

  const handleBulkDelete = async () => {
    const ids = [...selectedIds].filter(id => items.some(i => i.id === id))
    setDeletingBulk(true); setItems(p => p.filter(i => !ids.includes(i.id)))
    setSelectedIds(new Set()); setShowDeleteConfirm(false); setDeletingBulk(false)
    await Promise.allSettled(ids.map(id => deletePlanItem(id)))
    if (depth === 0) onTopLevelChanged()
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
    <div style={{ marginBottom: isTop ? 12 : depth === 1 ? 6 : 3 }}>
      {/* Header */}
      <div onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none',
          padding: isTop ? '9px 14px' : depth === 1 ? '6px 10px' : '4px 8px',
          borderRadius: isTop ? 10 : 6,
          backgroundColor: isTop ? st.hBg : 'transparent',
          color: isTop ? st.hColor : st.hBg,
          borderLeft: !isTop ? `3px solid ${st.leftBorder}` : 'none',
          transition: 'background-color 0.1s',
        }}
        onMouseEnter={e => { if (!isTop) e.currentTarget.style.backgroundColor = '#f3f4f6' }}
        onMouseLeave={e => { if (!isTop) e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        {expanded ? <ChevronDown size={isTop ? 15 : 13} style={{ flexShrink: 0 }} /> : <ChevronRight size={isTop ? 15 : 13} style={{ flexShrink: 0 }} />}
        <span style={{ fontWeight: isTop ? 700 : 600, fontSize: isTop ? 13 : depth === 1 ? 12 : 11, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {loaded && <span style={{ fontSize: 10, opacity: 0.6, flexShrink: 0 }}>{items.length}개</span>}
        {selCount > 0 && (
          <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 8, backgroundColor: isTop ? 'rgba(255,255,255,0.2)' : '#dbeafe', color: isTop ? '#fff' : '#1d4ed8', flexShrink: 0 }}>
            {selCount}선택
          </span>
        )}
        <button onClick={e => { e.stopPropagation(); selCount > 0 && setShowDeleteConfirm(true) }} style={{ ...actionBtn(isTop, selCount > 0, true), flexShrink: 0 }}>−</button>
        <button onClick={e => { e.stopPropagation(); setAddingNew(true); setExpanded(true) }} style={{ ...actionBtn(isTop, true, false), flexShrink: 0 }}><Plus size={isTop ? 12 : 10} /></button>
        {/* 붙여넣기 */}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: isAnnual ? 8 : 3, padding: '6px 0' }}>
              {filteredItems.map(item =>
                isAnnual ? (
                  <AnnualItemCard key={item.id} item={item} isSelected={selectedIds.has(item.id)}
                    onSelect={id => setSelectedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })}
                    onUpdated={u => { setItems(p => p.map(i => i.id === u.id ? u : i)); onTopLevelChanged() }}
                    onDeleted={id => { setItems(p => p.filter(i => i.id !== id)); setSelectedIds(p => { const n = new Set(p); n.delete(id); return n }); onTopLevelChanged() }}
                    onCopy={onCopy} />
                ) : (
                  <ItemCard key={item.id} item={item} isSelected={selectedIds.has(item.id)} compact={depth >= 2}
                    onSelect={id => setSelectedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })}
                    onUpdated={u => { setItems(p => p.map(i => i.id === u.id ? u : i)); if (depth === 0) onTopLevelChanged() }}
                    onDeleted={id => { setItems(p => p.filter(i => i.id !== id)); setSelectedIds(p => { const n = new Set(p); n.delete(id); return n }); if (depth === 0) onTopLevelChanged() }}
                    onCopy={onCopy} />
                )
              )}
            </div>
          )}
          {childPeriods.length > 0 && (
            <div style={{ paddingTop: 2 }}>
              {childPeriods.map(child => (
                <SectionNode key={child.periodKey} level={child.level} periodKey={child.periodKey} label={child.label}
                  depth={depth + 1} searchQuery={searchQuery} filterStatus={filterStatus}
                  onTopLevelChanged={onTopLevelChanged} copiedItem={copiedItem} onCopy={onCopy} />
              ))}
            </div>
          )}
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

// ── Annual Dashboard Card ───────────────────────────

const FLOW_STEPS = [
  { key: 'pending', label: '계획', color: '#9ca3af' },
  { key: 'in_progress', label: '진행', color: '#3b82f6' },
  { key: 'on_hold', label: '검토', color: '#f97316' },
  { key: 'completed', label: '완료', color: '#22c55e' },
]

function AnnualItemCard({ item, isSelected, onSelect, onUpdated, onDeleted, onCopy }: {
  item: PlanItem; isSelected: boolean
  onSelect: (id: string) => void; onUpdated: (item: PlanItem) => void; onDeleted: (id: string) => void
  onCopy: (item: PlanItem | null) => void
}) {
  const [showDash, setShowDash] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [status, setStatus] = useState<string>(item.status)
  const [priority, setPriority] = useState<string>(item.priority)
  const [desc, setDesc] = useState(item.description ?? '')
  const [saving, setSaving] = useState(false)
  const [savingDesc, setSavingDesc] = useState(false)

  const dot = STATUS_DOT[item.status] ?? '#9ca3af'
  const progress = PROGRESS[item.status] ?? 0
  const stepIdx = FLOW_STEPS.findIndex(s => s.key === item.status)

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const u = await updatePlanItem(item.id, { title: title.trim(), status: status as PlanItem['status'], priority: priority as PlanItem['priority'] })
      onUpdated(u); setEditing(false)
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  const handleSaveDesc = async () => {
    if (desc === (item.description ?? '')) return
    setSavingDesc(true)
    try { const u = await updatePlanItem(item.id, { description: desc || null }); onUpdated(u) }
    catch { /* ignore */ } finally { setSavingDesc(false) }
  }

  const handleDelete = async () => {
    try { await deletePlanItem(item.id); onDeleted(item.id) } catch { /* ignore */ }
  }

  return (
    <div style={{
      border: `2px solid ${isSelected ? '#3b82f6' : '#1e293b'}`,
      borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff',
      boxShadow: isSelected ? '0 0 0 2px rgba(59,130,246,0.2)' : '0 2px 8px rgba(0,0,0,0.06)',
      transition: 'all 0.12s',
    }}>
      {/* Compact header */}
      <div onClick={() => onSelect(item.id)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer', backgroundColor: '#fafbfc' }}>
        {isSelected && (
          <div style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 9, fontWeight: 900 }}>✓</span>
          </div>
        )}
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dot, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
        <span style={{ fontSize: 10, color: dot, fontWeight: 600, flexShrink: 0 }}>{STATUS_CONFIG[item.status]?.label}</span>
        <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>{PRIORITY_CONFIG[item.priority]?.label}</span>
        {/* 복사 */}
        <button onClick={e => { e.stopPropagation(); onCopy(item) }} title="복사"
          style={{ padding: '3px 5px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, color: '#6b7280' }}>
          <Clipboard size={10} /> 복사
        </button>
        {/* 대시보드 토글 */}
        <button onClick={e => { e.stopPropagation(); setShowDash(d => !d) }} title="대시보드"
          style={{ padding: '3px 6px', border: `1px solid ${showDash ? '#3b82f6' : '#e5e7eb'}`, background: showDash ? '#eff6ff' : '#fff', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, color: showDash ? '#1d4ed8' : '#6b7280', fontWeight: showDash ? 600 : 400 }}>
          <BarChart3 size={10} /> 대시보드
        </button>
        <button onClick={e => { e.stopPropagation(); setEditing(true) }} title="수정"
          style={{ padding: '3px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex' }}>
          <Pencil size={11} color="#9ca3af" />
        </button>
      </div>

      {/* 인라인 편집 */}
      {editing && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid #e5e7eb', backgroundColor: '#eff6ff', display: 'flex', flexDirection: 'column', gap: 6, animation: 'flowFadeIn 0.12s ease' }}>
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #bfdbfe', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ flex: 1, padding: '4px', borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 11 }}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={priority} onChange={e => setPriority(e.target.value)} style={{ flex: 1, padding: '4px', borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 11 }}>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={handleDelete} style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #fca5a5', background: '#fff', color: '#ef4444', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Trash2 size={10} />삭제
            </button>
            <button onClick={() => { setEditing(false); setTitle(item.title); setStatus(item.status); setPriority(item.priority) }}
              style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid #e5e7eb', background: '#fff', fontSize: 10, cursor: 'pointer' }}>취소</button>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader2 size={10} style={{ animation: 'flowSpin 1s linear infinite' }} /> : <Check size={10} />} 저장
            </button>
          </div>
        </div>
      )}

      {/* 대시보드 */}
      {showDash && (
        <div style={{ padding: '14px', borderTop: '1px solid #e5e7eb', animation: 'flowFadeIn 0.15s ease' }}>
          {/* 진행률 바 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>진행률</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: dot }}>{progress}%</span>
            </div>
            <div style={{ height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, backgroundColor: dot, borderRadius: 4, transition: 'width 0.4s ease' }} />
            </div>
          </div>

          {/* 플랜 플로우 */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 8 }}>플랜 플로우</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {FLOW_STEPS.map((step, idx) => {
                const reached = idx <= stepIdx
                const isCurrent = idx === stepIdx
                return (
                  <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative', zIndex: 1 }}>
                      <div style={{
                        width: isCurrent ? 28 : 20, height: isCurrent ? 28 : 20, borderRadius: '50%',
                        backgroundColor: reached ? step.color : '#e5e7eb',
                        border: isCurrent ? `3px solid ${step.color}40` : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.3s', boxShadow: isCurrent ? `0 0 12px ${step.color}40` : 'none',
                      }}>
                        {reached && <Check size={isCurrent ? 14 : 10} color="#fff" strokeWidth={3} />}
                      </div>
                      <span style={{ fontSize: 9, fontWeight: isCurrent ? 700 : 400, color: reached ? step.color : '#9ca3af' }}>{step.label}</span>
                    </div>
                    {idx < FLOW_STEPS.length - 1 && (
                      <div style={{ flex: 1, height: 3, backgroundColor: idx < stepIdx ? FLOW_STEPS[idx + 1].color : '#e5e7eb', borderRadius: 2, marginTop: -16, transition: 'background-color 0.3s' }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 진행 메모 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>진행 메모</span>
              {savingDesc && <span style={{ fontSize: 9, color: '#3b82f6' }}>저장 중...</span>}
            </div>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              onBlur={handleSaveDesc}
              placeholder="계획 진행 상황을 기록하세요..."
              style={{
                width: '100%', minHeight: 60, padding: '8px 10px', borderRadius: 8,
                border: '1.5px solid #e5e7eb', fontSize: 12, lineHeight: 1.5,
                outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Item Card ───────────────────────────────────────

function ItemCard({ item, isSelected, compact, onSelect, onUpdated, onDeleted, onCopy }: {
  item: PlanItem; isSelected: boolean; compact: boolean
  onSelect: (id: string) => void; onUpdated: (item: PlanItem) => void; onDeleted: (id: string) => void
  onCopy: (item: PlanItem | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [status, setStatus] = useState<string>(item.status)
  const [priority, setPriority] = useState<string>(item.priority)
  const [saving, setSaving] = useState(false)
  const dot = STATUS_DOT[item.status] ?? '#9ca3af'

  const handleSave = async () => {
    if (!title.trim()) return; setSaving(true)
    try { const u = await updatePlanItem(item.id, { title: title.trim(), status: status as PlanItem['status'], priority: priority as PlanItem['priority'] }); onUpdated(u); setEditing(false) }
    catch { /* ignore */ } finally { setSaving(false) }
  }

  if (editing) {
    return (
      <div style={{ border: '1.5px solid #3b82f6', borderRadius: 8, padding: '8px 10px', backgroundColor: '#eff6ff', display: 'flex', flexDirection: 'column', gap: 6, animation: 'flowFadeIn 0.12s ease' }}>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditing(false); setTitle(item.title) } }}
          style={{ width: '100%', padding: '5px 8px', borderRadius: 5, border: '1px solid #bfdbfe', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: '3px 4px', borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 11, flex: 1, minWidth: 60 }}>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={priority} onChange={e => setPriority(e.target.value)} style={{ padding: '3px 4px', borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 11, flex: 1, minWidth: 60 }}>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={async () => { try { await deletePlanItem(item.id); onDeleted(item.id) } catch {} }}
            style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #fca5a5', background: '#fff', color: '#ef4444', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}><Trash2 size={10} />삭제</button>
          <button onClick={() => { setEditing(false); setTitle(item.title); setStatus(item.status); setPriority(item.priority) }}
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
        border: `1.5px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
        backgroundColor: isSelected ? '#eff6ff' : '#fff',
        cursor: 'pointer', userSelect: 'none', transition: 'all 0.1s',
        boxShadow: isSelected ? '0 0 0 1px rgba(59,130,246,0.2)' : 'none',
      }}
      onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)' } }}
      onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none' } }}
    >
      {isSelected && <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ color: '#fff', fontSize: 8, fontWeight: 900 }}>✓</span></div>}
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dot, flexShrink: 0 }} />
      <span style={{ fontSize: compact ? 11 : 12, fontWeight: 500, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
      <span style={{ fontSize: 9, color: dot, fontWeight: 600, flexShrink: 0 }}>{STATUS_CONFIG[item.status]?.label}</span>
      <span style={{ fontSize: 9, color: '#9ca3af', flexShrink: 0 }}>{PRIORITY_CONFIG[item.priority]?.label}</span>
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
  const [status, setStatus] = useState('pending')
  const [priority, setPriority] = useState('medium')
  const [saving, setSaving] = useState(false)
  const handleSave = async () => {
    if (!title.trim()) return; setSaving(true)
    try {
      const item = await createPlanItem({ level, period_key: periodKey, title: title.trim(), description: null, categories: [], status: status as PlanItem['status'], priority: priority as PlanItem['priority'], sort_order: 0 })
      onSaved(item)
    } catch { /* ignore */ } finally { setSaving(false) }
  }
  return (
    <div style={{ border: '1.5px dashed #3b82f6', borderRadius: 8, padding: '8px 10px', backgroundColor: '#f0f7ff', margin: '6px 0', display: 'flex', flexDirection: 'column', gap: 6, animation: 'flowFadeIn 0.12s ease' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#3b82f6' }}>새 {formatPeriodKey(periodKey, level)} 계획 추가</div>
      <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel() }}
        placeholder="계획 제목 입력" style={{ width: '100%', padding: '6px 8px', borderRadius: 5, border: '1px solid #bfdbfe', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ padding: '3px 4px', borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 11, flex: 1 }}>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value)} style={{ padding: '3px 4px', borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 11, flex: 1 }}>
          {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
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
