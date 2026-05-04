'use client'

import { useState, useEffect, useMemo } from 'react'
import type { PlanItem, PlanLevel } from '@/lib/types'
import type { PlanConnection } from '@/lib/plan-connections'
import { createPlanItem, updatePlanItem, deletePlanItem } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { X, Link2, ChevronRight, Plus, Pencil, Trash2, Check, Loader2 } from 'lucide-react'
import { SubTaskPanel } from '@/components/SubTaskPanel'

const LEVEL_ORDER: PlanLevel[] = ['annual', 'quarterly', 'monthly', 'weekly', 'daily']

const LEVEL_BADGE: Record<PlanLevel, { bg: string; color: string }> = {
  annual:    { bg: '#0f172a', color: '#fff' },
  quarterly: { bg: '#1d4ed8', color: '#fff' },
  monthly:   { bg: '#374151', color: '#fff' },
  weekly:    { bg: '#4b5563', color: '#fff' },
  daily:     { bg: '#6b7280', color: '#fff' },
}

const STATUS_DOT: Record<string, string> = {
  completed: '#22c55e', in_progress: '#3b82f6', on_hold: '#f97316', pending: '#9ca3af',
}
const STATUS_LABEL: Record<string, string> = {
  completed: '완료', in_progress: '진행중', on_hold: '보류', pending: '미시작',
}
const DAY_KR = ['일', '월', '화', '수', '목', '금', '토']

const PROGRESS: Record<string, number> = { completed: 100, in_progress: 50, on_hold: 25, pending: 0 }
const DEFAULT_FLOW_STEPS = ['계획 수립', '진행 중', '검토', '완료']
const STEP_COLORS = ['#9ca3af', '#3b82f6', '#f97316', '#22c55e', '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444']

function parseFlowSteps(item: PlanItem): { labels: string[]; currentIdx: number } {
  const labels = item.categories && item.categories.length > 0 ? item.categories : DEFAULT_FLOW_STEPS
  const progress = PROGRESS[item.status] ?? 0
  const currentIdx = Math.min(Math.round((progress / 100) * (labels.length - 1)), labels.length - 1)
  return { labels, currentIdx }
}

function statusForStepIdx(idx: number, totalSteps: number): PlanItem['status'] {
  if (totalSteps <= 1) return idx >= 0 ? 'completed' : 'pending'
  const pct = (idx / (totalSteps - 1)) * 100
  if (pct <= 12.5) return 'pending'
  if (pct <= 37.5) return 'on_hold'
  if (pct <= 75) return 'in_progress'
  return 'completed'
}

function formatPeriodLabel(level: PlanLevel, periodKey: string): string {
  if (level === 'annual') return `${periodKey}년`
  if (level === 'quarterly') {
    const q = periodKey.split('-')[1]?.replace('Q', '')
    return q ? `${q}분기` : periodKey
  }
  if (level === 'monthly') {
    const m = periodKey.split('-')[1]
    return m ? `${parseInt(m)}월` : periodKey
  }
  if (level === 'weekly') {
    const w = periodKey.split('-W')[1]
    return w ? `${parseInt(w)}주차` : periodKey
  }
  if (level === 'daily') {
    const parts = periodKey.split('-').map(Number)
    if (parts.length >= 3) {
      const dt = new Date(parts[0], parts[1] - 1, parts[2])
      return `${parts[1]}/${parts[2]}(${DAY_KR[dt.getDay()]})`
    }
    return periodKey
  }
  return periodKey
}

interface ConnectedChainPanelProps {
  targetItem: PlanItem
  connections: PlanConnection[]
  onClose: () => void
}

async function fetchItemsByIds(ids: string[]): Promise<PlanItem[]> {
  if (ids.length === 0) return []
  const { data } = await supabase.from('plan_items').select('*').in('id', ids)
  return (data ?? []) as PlanItem[]
}

function collectConnectedIds(rootId: string, connections: PlanConnection[]): Set<string> {
  const visited = new Set<string>([rootId])
  const queue = [rootId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const conn of connections) {
      const other =
        conn.source_id === current ? conn.target_id :
        conn.target_id === current ? conn.source_id : null
      if (other && !visited.has(other)) {
        visited.add(other)
        queue.push(other)
      }
    }
  }
  visited.delete(rootId)
  return visited
}

type GroupKey = string // `${level}::${periodKey}`

interface Group {
  level: PlanLevel
  periodKey: string
  label: string
  entries: { item: PlanItem; isRoot: boolean }[]
}

export function ConnectedChainPanel({ targetItem, connections, onClose }: ConnectedChainPanelProps) {
  const [allItems, setAllItems] = useState<{ item: PlanItem; isRoot: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [addingGroup, setAddingGroup] = useState<GroupKey | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [addingSaving, setAddingSaving] = useState(false)

  // 확장 패널 상태
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandTitle, setExpandTitle] = useState('')
  const [expandTitleSaving, setExpandTitleSaving] = useState(false)
  const [expandingFlow, setExpandingFlow] = useState(false)
  const [expandFlowDraft, setExpandFlowDraft] = useState<string[]>([])

  useEffect(() => {
    const relatedIds = collectConnectedIds(targetItem.id, connections)
    setLoading(true)
    fetchItemsByIds([...relatedIds])
      .then(chainItems => {
        setAllItems([
          { item: targetItem, isRoot: true },
          ...chainItems.map(i => ({ item: i, isRoot: false })),
        ])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [targetItem.id, connections])

  const groups = useMemo<Group[]>(() => {
    const groupMap = new Map<GroupKey, Group>()
    for (const { item, isRoot } of allItems) {
      const level = item.level as PlanLevel
      const periodKey = item.period_key ?? ''
      const key: GroupKey = `${level}::${periodKey}`
      if (!groupMap.has(key)) {
        groupMap.set(key, { level, periodKey, label: formatPeriodLabel(level, periodKey), entries: [] })
      }
      groupMap.get(key)!.entries.push({ item, isRoot })
    }
    return [...groupMap.values()].sort((a, b) => {
      const diff = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
      return diff !== 0 ? diff : a.periodKey.localeCompare(b.periodKey)
    })
  }, [allItems])

  const hasConnections = allItems.length > 1

  // 패널 토글: 같은 항목 클릭이면 닫고, 다른 항목이면 열기
  const handleToggleExpand = (item: PlanItem) => {
    if (expandedId === item.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(item.id)
    setExpandTitle(item.title)
    setExpandFlowDraft(parseFlowSteps(item).labels)
    setExpandingFlow(false)
  }

  const handleSaveTitle = async (itemId: string) => {
    if (!expandTitle.trim()) return
    setExpandTitleSaving(true)
    try {
      const updated = await updatePlanItem(itemId, { title: expandTitle.trim() })
      setAllItems(prev => prev.map(e => e.item.id === itemId ? { ...e, item: updated } : e))
    } catch { /* ignore */ } finally { setExpandTitleSaving(false) }
  }

  const handleStepClick = async (item: PlanItem, stepIdx: number, totalSteps: number) => {
    const newStatus = statusForStepIdx(stepIdx, totalSteps)
    if (newStatus === item.status) return
    try {
      const updated = await updatePlanItem(item.id, { status: newStatus })
      setAllItems(prev => prev.map(e => e.item.id === item.id ? { ...e, item: updated } : e))
    } catch { /* ignore */ }
  }

  const handleSaveFlowSteps = async (item: PlanItem) => {
    const filtered = expandFlowDraft.filter(l => l.trim())
    if (filtered.length < 2) return
    try {
      const updated = await updatePlanItem(item.id, { categories: filtered })
      setAllItems(prev => prev.map(e => e.item.id === item.id ? { ...e, item: updated } : e))
      setExpandingFlow(false)
    } catch { /* ignore */ }
  }

  const handleDelete = async (item: PlanItem) => {
    setDeletingId(item.id)
    try {
      await deletePlanItem(item.id)
      if (item.id === targetItem.id) {
        onClose()
        return
      }
      setAllItems(prev => prev.filter(e => e.item.id !== item.id))
      if (expandedId === item.id) setExpandedId(null)
    } catch { /* ignore */ } finally { setDeletingId(null) }
  }

  const handleAdd = async (level: PlanLevel, periodKey: string, groupKey: GroupKey) => {
    if (!newTitle.trim()) return
    setAddingSaving(true)
    try {
      const created = await createPlanItem({
        title: newTitle.trim(),
        level,
        period_key: periodKey,
        status: 'pending',
        priority: 'medium',
        sort_order: 0,
        description: null,
        categories: [],
      })
      setAllItems(prev => [...prev, { item: created, isRoot: false }])
      setAddingGroup(null)
      setNewTitle('')
    } catch { /* ignore */ } finally { setAddingSaving(false) }
  }

  const rootDisplay = allItems.find(e => e.isRoot)?.item ?? targetItem

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        backgroundColor: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 400, backgroundColor: '#fff',
          boxShadow: '-4px 0 32px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column',
          animation: 'chainSlideIn 0.22s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Link2 size={16} color="#3b82f6" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', flex: 1 }}>연결된 계획 체인</span>
            <button
              onClick={onClose}
              style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center' }}
            >
              <X size={16} color="#6b7280" />
            </button>
          </div>
          <div style={{
            padding: '8px 12px', borderRadius: 8,
            backgroundColor: '#eff6ff', border: '1.5px solid #3b82f6',
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
              backgroundColor: LEVEL_BADGE[rootDisplay.level as PlanLevel]?.bg ?? '#374151',
              color: LEVEL_BADGE[rootDisplay.level as PlanLevel]?.color ?? '#fff',
              flexShrink: 0,
            }}>
              {formatPeriodLabel(rootDisplay.level as PlanLevel, rootDisplay.period_key ?? '')}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {rootDisplay.title}
            </span>
          </div>
          <div style={{
            fontSize: 10, color: '#6b7280',
            padding: '6px 10px', backgroundColor: '#f0f9ff',
            borderRadius: 7, borderLeft: '3px solid #3b82f6', lineHeight: 1.5,
          }}>
            💡 연필 버튼을 눌러 제목 수정, 플로우, 세부내용을 확인하세요
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 32px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, padding: 40, color: '#9ca3af' }}>
              <div style={{ width: 22, height: 22, border: '2px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'chainSpin 0.8s linear infinite' }} />
              <span style={{ fontSize: 12 }}>연결 체인 불러오는 중...</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {groups.map(group => {
                const badge = LEVEL_BADGE[group.level]
                const groupKey: GroupKey = `${group.level}::${group.periodKey}`
                return (
                  <div key={groupKey}>
                    {/* Group header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 10px',
                        borderRadius: 12, backgroundColor: badge.bg, color: badge.color,
                        letterSpacing: '0.03em',
                      }}>
                        {group.label}
                      </span>
                      <div style={{ flex: 1, height: 1, backgroundColor: '#f1f5f9' }} />
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{group.entries.length}개</span>
                      <button
                        onClick={() => { setAddingGroup(groupKey); setNewTitle('') }}
                        title={`${group.label}에 계획 추가`}
                        style={{
                          width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                          border: '1px solid #d1d5db', background: '#f9fafb',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                        }}
                      >
                        <Plus size={10} color="#6b7280" />
                      </button>
                    </div>

                    {/* Inline add form */}
                    {addingGroup === groupKey && (
                      <div style={{
                        display: 'flex', gap: 4, marginBottom: 6,
                        padding: '7px 9px', borderRadius: 7,
                        border: '1.5px solid #3b82f6', backgroundColor: '#eff6ff',
                        animation: 'chainFadeIn 0.12s ease',
                      }}>
                        <input
                          autoFocus
                          value={newTitle}
                          onChange={e => setNewTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleAdd(group.level, group.periodKey, groupKey)
                            if (e.key === 'Escape') { setAddingGroup(null); setNewTitle('') }
                          }}
                          placeholder="새 계획 제목..."
                          style={{ flex: 1, fontSize: 11, border: 'none', background: 'transparent', outline: 'none', color: '#111827' }}
                        />
                        <button
                          onClick={() => handleAdd(group.level, group.periodKey, groupKey)}
                          disabled={addingSaving}
                          style={{ padding: '2px 7px', borderRadius: 4, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}
                        >
                          {addingSaving ? <Loader2 size={8} style={{ animation: 'chainSpin 0.8s linear infinite' }} /> : <Check size={8} />}
                          추가
                        </button>
                        <button
                          onClick={() => { setAddingGroup(null); setNewTitle('') }}
                          style={{ padding: '2px 5px', borderRadius: 4, border: '1px solid #bfdbfe', background: '#fff', cursor: 'pointer', fontSize: 9, color: '#6b7280' }}
                        >취소</button>
                      </div>
                    )}

                    {/* Items */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4 }}>
                      {group.entries.map(({ item, isRoot }) => {
                        const isDeleting = deletingId === item.id
                        const isExpanded = expandedId === item.id
                        const dot = STATUS_DOT[item.status] ?? '#9ca3af'
                        const { labels: flowLabels, currentIdx: stepIdx } = parseFlowSteps(item)

                        return (
                          <div key={item.id} style={{
                            borderRadius: 8, overflow: 'hidden',
                            border: `1.5px solid ${isExpanded ? '#3b82f6' : isRoot ? '#3b82f6' : '#e5e7eb'}`,
                            opacity: isDeleting ? 0.45 : 1,
                            transition: 'opacity 0.15s',
                          }}>
                            {/* 항목 행 */}
                            <div style={{
                              padding: '7px 10px',
                              backgroundColor: isRoot ? '#eff6ff' : isExpanded ? '#f8faff' : '#fafafa',
                              display: 'flex', alignItems: 'center', gap: 7,
                            }}>
                              {isRoot ? (
                                <span style={{
                                  fontSize: 9, fontWeight: 700, padding: '1px 6px',
                                  borderRadius: 4, backgroundColor: '#dbeafe', color: '#1d4ed8',
                                  flexShrink: 0, whiteSpace: 'nowrap',
                                }}>기준</span>
                              ) : (
                                <ChevronRight size={11} color="#9ca3af" style={{ flexShrink: 0 }} />
                              )}
                              <span style={{
                                fontSize: 12, fontWeight: isRoot ? 700 : 500, color: '#111827',
                                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {item.title}
                              </span>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, backgroundColor: dot }} />
                              <span style={{ fontSize: 9, color: '#9ca3af', flexShrink: 0 }}>{STATUS_LABEL[item.status] ?? item.status}</span>
                              <button
                                onClick={() => handleToggleExpand(item)}
                                title="수정 / 대시보드 / 세부내용"
                                style={{ padding: '2px 3px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', borderRadius: 3, flexShrink: 0 }}
                              >
                                <Pencil size={9} color={isExpanded ? '#3b82f6' : '#9ca3af'} />
                              </button>
                              <button
                                onClick={() => handleDelete(item)}
                                title="삭제"
                                disabled={isDeleting}
                                style={{ padding: '2px 3px', border: 'none', background: 'transparent', cursor: isDeleting ? 'default' : 'pointer', display: 'flex', borderRadius: 3, flexShrink: 0 }}
                              >
                                <Trash2 size={9} color={isDeleting ? '#fca5a5' : '#ef4444'} />
                              </button>
                            </div>

                            {/* 확장 패널: 제목 수정 + 플로우 + 세부내용 */}
                            {isExpanded && (
                              <div style={{ borderTop: '1px solid #e5e7eb', animation: 'chainFadeIn 0.15s ease' }}>

                                {/* 제목 수정 */}
                                <div style={{ padding: '10px 12px', backgroundColor: '#f8fafc', borderBottom: '1px solid #f0f4f8' }}>
                                  <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Pencil size={8} /> 제목 수정
                                  </div>
                                  <input
                                    value={expandTitle}
                                    onChange={e => setExpandTitle(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(item.id); if (e.key === 'Escape') setExpandTitle(item.title) }}
                                    style={{ width: '100%', padding: '5px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff' }}
                                  />
                                  <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', marginTop: 7 }}>
                                    <button onClick={() => setExpandTitle(item.title)}
                                      style={{ padding: '2px 7px', borderRadius: 4, border: '1px solid #e5e7eb', background: '#fff', fontSize: 10, cursor: 'pointer' }}>취소</button>
                                    <button onClick={() => handleSaveTitle(item.id)} disabled={expandTitleSaving}
                                      style={{ padding: '2px 9px', borderRadius: 4, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, opacity: expandTitleSaving ? 0.7 : 1 }}>
                                      {expandTitleSaving ? <Loader2 size={9} style={{ animation: 'chainSpin 0.8s linear infinite' }} /> : <Check size={9} />} 저장
                                    </button>
                                  </div>
                                </div>

                                {/* 플랜 플로우 */}
                                <div style={{ padding: '12px 12px', borderBottom: '1px solid #f0f4f8' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#374151' }}>플랜 플로우</span>
                                    <button
                                      onClick={() => {
                                        if (expandingFlow) { setExpandingFlow(false) }
                                        else { setExpandFlowDraft([...flowLabels]); setExpandingFlow(true) }
                                      }}
                                      style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #e5e7eb', background: expandingFlow ? '#eff6ff' : '#fff', fontSize: 9, color: expandingFlow ? '#1d4ed8' : '#6b7280', cursor: 'pointer', fontWeight: expandingFlow ? 600 : 400 }}>
                                      {expandingFlow ? '완료' : '단계 편집'}
                                    </button>
                                  </div>

                                  {expandingFlow ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 10px', borderRadius: 7, backgroundColor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                      {expandFlowDraft.map((label, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                          <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: STEP_COLORS[idx % STEP_COLORS.length], flexShrink: 0 }} />
                                          <input value={label} onChange={e => { const n = [...expandFlowDraft]; n[idx] = e.target.value; setExpandFlowDraft(n) }}
                                            style={{ flex: 1, padding: '3px 6px', borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 11, outline: 'none' }} />
                                          {expandFlowDraft.length > 2 && (
                                            <button onClick={() => setExpandFlowDraft(p => p.filter((_, i) => i !== idx))}
                                              style={{ padding: '1px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', fontSize: 12, fontWeight: 700 }}>×</button>
                                          )}
                                        </div>
                                      ))}
                                      <div style={{ display: 'flex', gap: 5, marginTop: 3 }}>
                                        <button onClick={() => setExpandFlowDraft(p => [...p, `단계 ${p.length + 1}`])}
                                          style={{ padding: '2px 7px', borderRadius: 4, border: '1px dashed #bfdbfe', background: '#eff6ff', fontSize: 9, color: '#1d4ed8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
                                          <Plus size={9} /> 추가
                                        </button>
                                        <button onClick={() => handleSaveFlowSteps(item)}
                                          style={{ padding: '2px 8px', borderRadius: 4, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>저장</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                                      {flowLabels.map((label, idx) => {
                                        const reached = idx <= stepIdx
                                        const isCurrent = idx === stepIdx
                                        const color = STEP_COLORS[idx % STEP_COLORS.length]
                                        return (
                                          <div key={idx} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                            <button type="button"
                                              onClick={() => handleStepClick(item, idx, flowLabels.length)}
                                              title={`${label} 단계로 설정`}
                                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, position: 'relative', zIndex: 1 }}>
                                              <div style={{
                                                width: isCurrent ? 24 : 17, height: isCurrent ? 24 : 17, borderRadius: '50%',
                                                backgroundColor: reached ? color : '#e5e7eb',
                                                border: isCurrent ? `2px solid ${color}40` : 'none',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'all 0.3s', boxShadow: isCurrent ? `0 0 8px ${color}40` : 'none',
                                              }}>
                                                {reached && <Check size={isCurrent ? 11 : 8} color="#fff" strokeWidth={3} />}
                                              </div>
                                              <span style={{ fontSize: 8, fontWeight: isCurrent ? 700 : 400, color: reached ? color : '#9ca3af', textAlign: 'center', maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                                            </button>
                                            {idx < flowLabels.length - 1 && (
                                              <div style={{ flex: 1, height: 2, backgroundColor: idx < stepIdx ? STEP_COLORS[(idx + 1) % STEP_COLORS.length] : '#e5e7eb', borderRadius: 2, marginTop: -12, transition: 'background-color 0.3s' }} />
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* 세부내용 */}
                                <div>
                                  <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 600, color: '#374151' }}>세부내용</div>
                                  <SubTaskPanel itemId={item.id} autoFocus={false} />
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* No connections hint */}
              {!hasConnections && !loading && (
                <div style={{ textAlign: 'center', padding: '24px 16px', color: '#9ca3af', borderTop: '1px solid #f1f5f9', marginTop: 4 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🔗</div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>연결된 계획이 없습니다</div>
                  <div style={{ fontSize: 11, lineHeight: 1.6 }}>
                    계획 항목 왼쪽의 <strong>원형 점(●)</strong>을 클릭해<br />다른 단계와 연결해보세요
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes chainSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes chainSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes chainFadeIn { from{opacity:0;transform:translateY(-3px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
