'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PlanItem, PlanLevel } from '@/lib/types'
import { getMonthWeeks, getWeekDays } from '@/lib/types'
import { getPlanItems, updatePlanItem, deletePlanItem } from '@/lib/api'
import { LEVEL_LABEL, formatPeriodKey } from '@/lib/flowmap-layout'
import { X, ChevronRight, Plus, Loader2, Pencil } from 'lucide-react'
import { PlanCard } from './PlanCard'
import { PlanFormModal } from './PlanFormModal'
import type { FormTarget } from './PlanFormModal'

export interface PopupFrame {
  periodKey: string
  childLevel: PlanLevel
  label: string
}

interface Section {
  periodKey: string
  label: string
  items: PlanItem[]
  quarterGroup?: 'Q1' | 'Q2' | 'Q3' | 'Q4'
}

interface PlanPopupProps {
  frames: PopupFrame[]
  onPush: (frame: PopupFrame) => void
  onPopTo: (index: number) => void
  onClose: () => void
  onQuarterlyCreated?: () => void
}

const MONTH_QUARTER: Record<number, 'Q1' | 'Q2' | 'Q3' | 'Q4'> = {
  1: 'Q1', 2: 'Q1', 3: 'Q1',
  4: 'Q2', 5: 'Q2', 6: 'Q2',
  7: 'Q3', 8: 'Q3', 9: 'Q3',
  10: 'Q4', 11: 'Q4', 12: 'Q4',
}

const QUARTER_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  Q1: { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  Q2: { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  Q3: { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  Q4: { color: '#6d28d9', bg: '#faf5ff', border: '#ddd6fe' },
}

const PARENT_LEVEL: Partial<Record<PlanLevel, PlanLevel>> = {
  monthly: 'quarterly', weekly: 'monthly', daily: 'weekly',
}

function getChildSections(frame: PopupFrame): { periodKey: string; label: string; quarterGroup?: 'Q1' | 'Q2' | 'Q3' | 'Q4' }[] {
  const { periodKey, childLevel } = frame

  if (childLevel === 'monthly') {
    const year = parseInt(periodKey.split('-')[0])
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      return {
        periodKey: `${year}-${String(m).padStart(2, '0')}`,
        label: `${m}월`,
        quarterGroup: MONTH_QUARTER[m],
      }
    })
  }
  if (childLevel === 'weekly') {
    const [yearStr, monthStr] = periodKey.split('-')
    const weekKeys = getMonthWeeks(parseInt(yearStr), parseInt(monthStr))
    return weekKeys.map(k => ({ periodKey: k, label: `${parseInt(k.split('-W')[1])}주차` }))
  }
  if (childLevel === 'daily') {
    const [yearStr, weekPart] = periodKey.split('-W')
    const dayKeys = getWeekDays(parseInt(yearStr), parseInt(weekPart))
    const DAY = ['일', '월', '화', '수', '목', '금', '토']
    return dayKeys.map(k => {
      const parts = k.split('-').map(Number)
      const d = new Date(parseInt(yearStr), parts[1] - 1, parts[2])
      return { periodKey: k, label: `${parts[1]}/${parts[2]}(${DAY[d.getDay()]})` }
    })
  }
  return []
}

function makeChildFrame(item: PlanItem): PopupFrame | null {
  const NEXT: Partial<Record<PlanLevel, PlanLevel>> = { quarterly: 'monthly', monthly: 'weekly', weekly: 'daily' }
  const childLevel = NEXT[item.level]
  if (!childLevel) return null
  return { periodKey: item.period_key, childLevel, label: formatPeriodKey(item.period_key, item.level) }
}

// ── 삭제 확인 다이얼로그 ──────────────────────────────────────────
interface DeleteConfirmProps {
  count: number
  deleting: boolean
  onConfirm: () => void
  onCancel: () => void
}
function DeleteConfirm({ count, deleting, onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        backgroundColor: '#fff', borderRadius: 14, padding: '24px 28px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.2)', maxWidth: 320, width: '100%',
        animation: 'ppIn 0.15s ease', textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🗑️</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 6 }}>계획 삭제</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
          선택한 <strong style={{ color: '#ef4444' }}>{count}개</strong> 계획을 삭제하시겠습니까?<br />
          <span style={{ fontSize: 11 }}>이 작업은 되돌릴 수 없습니다.</span>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onCancel}
            style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 13, color: '#374151', cursor: 'pointer', fontWeight: 500 }}>
            취소
          </button>
          <button onClick={onConfirm} disabled={deleting}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: deleting ? 0.7 : 1 }}>
            {deleting && <Loader2 size={13} style={{ animation: 'ppSpin 1s linear infinite' }} />}
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}

export function PlanPopup({ frames, onPush, onPopTo, onClose, onQuarterlyCreated }: PlanPopupProps) {
  const currentFrame = frames[frames.length - 1]
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(false)
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null)
  const [editItem, setEditItem] = useState<PlanItem | null>(null)
  const [parentItems, setParentItems] = useState<PlanItem[]>([])

  // 멀티셀렉트
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)

  // DnD
  const draggingItem = useRef<PlanItem | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverSection, setDragOverSection] = useState<string | null>(null)

  // 섹션 + 상위 계획 로드
  useEffect(() => {
    if (!currentFrame) return
    setLoading(true)
    setSections([])
    setDragOverSection(null)
    setSelectedIds(new Set())

    const childSections = getChildSections(currentFrame)
    if (childSections.length === 0) { setLoading(false); return }

    // 상위 계획 로드
    const parentLevel = PARENT_LEVEL[currentFrame.childLevel]
    if (parentLevel) {
      if (currentFrame.childLevel === 'monthly') {
        // 월간 팝업: 연도의 모든 분기 계획 로드
        const year = currentFrame.periodKey.split('-')[0]
        Promise.all(['Q1', 'Q2', 'Q3', 'Q4'].map(q => getPlanItems('quarterly', `${year}-${q}`)))
          .then(results => setParentItems(results.flat()))
          .catch(() => setParentItems([]))
      } else {
        getPlanItems(parentLevel, currentFrame.periodKey)
          .then(setParentItems)
          .catch(() => setParentItems([]))
      }
    } else {
      setParentItems([])
    }

    Promise.all(childSections.map(s => getPlanItems(currentFrame.childLevel, s.periodKey)))
      .then(results => setSections(childSections.map((s, i) => ({ ...s, items: results[i] }))))
      .catch(() => setSections(childSections.map(s => ({ ...s, items: [] }))))
      .finally(() => setLoading(false))
  }, [currentFrame?.periodKey, currentFrame?.childLevel])

  // ── DnD ──────────────────────────────────────────────────────────
  const handleDragStart = useCallback((item: PlanItem) => {
    draggingItem.current = item
    setDraggingId(item.id)
  }, [])

  const handleDragEnd = useCallback(() => {
    draggingItem.current = null
    setDraggingId(null)
    setDragOverSection(null)
  }, [])

  const handleDrop = useCallback(async (targetPeriodKey: string) => {
    const item = draggingItem.current
    draggingItem.current = null
    setDraggingId(null)
    setDragOverSection(null)
    if (!item || item.period_key === targetPeriodKey) return

    const sourcePeriodKey = item.period_key
    setSections(prev => prev.map(sec => {
      if (sec.periodKey === sourcePeriodKey) return { ...sec, items: sec.items.filter(i => i.id !== item.id) }
      if (sec.periodKey === targetPeriodKey) return { ...sec, items: [...sec.items, { ...item, period_key: targetPeriodKey }] }
      return sec
    }))
    try {
      await updatePlanItem(item.id, { period_key: targetPeriodKey })
    } catch {
      setSections(prev => prev.map(sec => {
        if (sec.periodKey === targetPeriodKey) return { ...sec, items: sec.items.filter(i => i.id !== item.id) }
        if (sec.periodKey === sourcePeriodKey) return { ...sec, items: [...sec.items, item] }
        return sec
      }))
    }
  }, [])

  // ── 셀렉션 ──────────────────────────────────────────────────────
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleBulkDelete = useCallback(async () => {
    const ids = [...selectedIds]
    setDeletingBulk(true)
    // Optimistic
    setSections(prev => prev.map(sec => ({ ...sec, items: sec.items.filter(i => !ids.includes(i.id)) })))
    setSelectedIds(new Set())
    try {
      await Promise.all(ids.map(id => deletePlanItem(id)))
    } catch {
      // reload on failure
    } finally {
      setDeletingBulk(false)
      setShowDeleteConfirm(false)
    }
  }, [selectedIds])

  // ── 폼/편집 ──────────────────────────────────────────────────────
  // 항목 클릭 → 수정
  const handleCardClick = useCallback((item: PlanItem) => {
    setEditItem(item)
  }, [])

  // 드릴다운 (하위 보기 버튼)
  const handleDrillDown = useCallback((item: PlanItem) => {
    const frame = makeChildFrame(item)
    if (frame) onPush(frame)
  }, [onPush])

  const openAddForm = useCallback((periodKey: string) => {
    setFormTarget({
      mode: 'create',
      level: currentFrame.childLevel,
      periodKey,
      parentItems,
      sectionOptions: sections.map(s => ({ periodKey: s.periodKey, label: s.label })),
    })
  }, [currentFrame, parentItems, sections])

  const handleFormSaved = useCallback((saved: PlanItem) => {
    setFormTarget(null)
    setEditItem(null)
    setSections(prev => prev.map(section => {
      if (section.periodKey !== saved.period_key) return section
      const exists = section.items.find(i => i.id === saved.id)
      return {
        ...section,
        items: exists
          ? section.items.map(i => i.id === saved.id ? saved : i)
          : [...section.items, saved],
      }
    }))
    if (saved.level === 'quarterly') onQuarterlyCreated?.()
  }, [onQuarterlyCreated])

  const handleDeleted = useCallback((deletedId: string) => {
    setEditItem(null)
    setSections(prev => prev.map(section => ({
      ...section,
      items: section.items.filter(i => i.id !== deletedId),
    })))
  }, [])

  if (!currentFrame) return null

  const totalCount = sections.reduce((s, sec) => s + sec.items.length, 0)
  const isMonthly = currentFrame.childLevel === 'monthly'

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        onClick={e => { if (e.target === e.currentTarget && !formTarget && !editItem) onClose() }}
      >
        <div style={{
          width: '100%', maxWidth: isMonthly ? 860 : 720,
          maxHeight: 'min(86vh, 720px)', backgroundColor: '#fff', borderRadius: 18,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.22)', overflow: 'hidden', animation: 'ppIn 0.2s ease',
        }}>

          {/* Breadcrumb */}
          <div style={{ padding: '10px 18px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, minHeight: 44 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, overflow: 'hidden' }}>
              {frames.map((frame, idx) => (
                <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: idx < frames.length - 1 ? 1 : 0, minWidth: 0 }}>
                  {idx > 0 && <ChevronRight size={11} color="#d1d5db" style={{ flexShrink: 0 }} />}
                  <button
                    onClick={() => idx < frames.length - 1 ? onPopTo(idx) : undefined}
                    style={{
                      background: 'none', border: 'none', cursor: idx < frames.length - 1 ? 'pointer' : 'default',
                      padding: '2px 5px', borderRadius: 5, fontSize: 12,
                      fontWeight: idx === frames.length - 1 ? 700 : 400,
                      color: idx === frames.length - 1 ? '#111827' : '#6b7280',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140,
                    }}
                  >{frame.label}</button>
                </span>
              ))}
            </div>
            {frames.length > 1 && (
              <button onClick={() => onPopTo(frames.length - 2)}
                style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, color: '#374151', cursor: 'pointer', flexShrink: 0, fontWeight: 500 }}>
                ← 뒤로
              </button>
            )}
            <button onClick={onClose} style={{ padding: 5, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
              <X size={17} color="#9ca3af" />
            </button>
          </div>

          {/* Title + action bar */}
          <div style={{ padding: '10px 18px 8px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', flex: 1 }}>
              {isMonthly
                ? `${parseInt(currentFrame.periodKey.split('-')[0])}년 전체 월간 계획`
                : `${currentFrame.label} — ${LEVEL_LABEL[currentFrame.childLevel]} 계획`}
            </span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>총 {totalCount}개</span>
            {selectedIds.size > 0 && (
              <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {selectedIds.size}개 선택
              </span>
            )}
            {draggingId && (
              <span style={{ fontSize: 11, color: '#f97316', fontWeight: 600 }}>드래그 중</span>
            )}
            {/* 삭제 버튼 */}
            <button
              onClick={() => selectedIds.size > 0 && setShowDeleteConfirm(true)}
              title={selectedIds.size > 0 ? `${selectedIds.size}개 삭제` : '항목을 선택하세요'}
              style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                border: `1.5px solid ${selectedIds.size > 0 ? '#fecaca' : '#e5e7eb'}`,
                background: selectedIds.size > 0 ? '#fff5f5' : '#fff',
                color: selectedIds.size > 0 ? '#ef4444' : '#d1d5db',
                cursor: selectedIds.size > 0 ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700, lineHeight: 1, transition: 'all 0.12s',
              }}
            >−</button>
            {/* 추가 버튼 */}
            <button
              onClick={() => sections.length > 0 && openAddForm(sections[0].periodKey)}
              title="계획 추가"
              style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                border: '1.5px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700, lineHeight: 1,
              }}
            >+</button>
          </div>

          {/* Content */}
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={26} color="#3b82f6" style={{ animation: 'ppSpin 1s linear infinite' }} />
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: isMonthly ? 12 : 20 }}>
              {isMonthly ? (
                <MonthlyGrid
                  sections={sections}
                  dragOverSection={dragOverSection}
                  draggingId={draggingId}
                  selectedIds={selectedIds}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragEnter={key => setDragOverSection(key)}
                  onDragLeave={(e, key) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverSection(prev => prev === key ? null : prev)
                    }
                  }}
                  onDrop={handleDrop}
                  onCardClick={handleCardClick}
                  onDrillDown={handleDrillDown}
                  onToggleSelect={handleToggleSelect}
                  onAddPlan={openAddForm}
                  onEditItem={setEditItem}
                />
              ) : (
                sections.map(section => (
                  <SectionBlock
                    key={section.periodKey}
                    section={section}
                    childLevel={currentFrame.childLevel}
                    isDragOver={dragOverSection === section.periodKey}
                    draggingId={draggingId}
                    selectedIds={selectedIds}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragEnter={() => setDragOverSection(section.periodKey)}
                    onDragLeave={e => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOverSection(prev => prev === section.periodKey ? null : prev)
                      }
                    }}
                    onDrop={() => handleDrop(section.periodKey)}
                    onCardClick={handleCardClick}
                    onDrillDown={handleDrillDown}
                    onToggleSelect={handleToggleSelect}
                    onAddPlan={() => openAddForm(section.periodKey)}
                    onEditItem={setEditItem}
                  />
                ))
              )}
              {sections.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                  <div style={{ fontSize: 13 }}>이 기간에 계획이 없습니다</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {showDeleteConfirm && (
        <DeleteConfirm
          count={selectedIds.size}
          deleting={deletingBulk}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {editItem && (
        <PlanFormModal
          target={{ mode: 'edit', level: editItem.level, periodKey: editItem.period_key, editItem, parentItems }}
          onClose={() => setEditItem(null)}
          onSaved={handleFormSaved}
          onDeleted={() => handleDeleted(editItem.id)}
        />
      )}
      {formTarget && (
        <PlanFormModal
          target={formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={handleFormSaved}
        />
      )}

      <style>{`
        @keyframes ppIn { from { transform: scale(0.95) translateY(10px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes ppSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}

// ── 월간 그리드 ───────────────────────────────────────────────────

const QUARTER_LABELS: Record<string, string> = {
  Q1: '1분기 (1~3월)', Q2: '2분기 (4~6월)', Q3: '3분기 (7~9월)', Q4: '4분기 (10~12월)',
}

interface MonthlyGridProps {
  sections: Section[]
  dragOverSection: string | null
  draggingId: string | null
  selectedIds: Set<string>
  onDragStart: (item: PlanItem) => void
  onDragEnd: () => void
  onDragEnter: (key: string) => void
  onDragLeave: (e: React.DragEvent, key: string) => void
  onDrop: (key: string) => void
  onCardClick: (item: PlanItem) => void
  onDrillDown: (item: PlanItem) => void
  onToggleSelect: (id: string) => void
  onAddPlan: (key: string) => void
  onEditItem: (item: PlanItem) => void
}

function MonthlyGrid({
  sections, dragOverSection, draggingId, selectedIds,
  onDragStart, onDragEnd, onDragEnter, onDragLeave, onDrop,
  onCardClick, onDrillDown, onToggleSelect, onAddPlan, onEditItem,
}: MonthlyGridProps) {
  const quarters: Array<'Q1' | 'Q2' | 'Q3' | 'Q4'> = ['Q1', 'Q2', 'Q3', 'Q4']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {quarters.map(q => {
        const qSections = sections.filter(s => s.quarterGroup === q)
        const qs = QUARTER_STYLE[q]
        return (
          <div key={q}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: qs.color,
              padding: '4px 10px', backgroundColor: qs.bg, borderRadius: 6,
              display: 'inline-block', marginBottom: 10, border: `1px solid ${qs.border}`,
            }}>{QUARTER_LABELS[q]}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {qSections.map(section => (
                <SectionBlock
                  key={section.periodKey}
                  section={section}
                  childLevel="monthly"
                  isDragOver={dragOverSection === section.periodKey}
                  draggingId={draggingId}
                  selectedIds={selectedIds}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragEnter={() => onDragEnter(section.periodKey)}
                  onDragLeave={e => onDragLeave(e, section.periodKey)}
                  onDrop={() => onDrop(section.periodKey)}
                  onCardClick={onCardClick}
                  onDrillDown={onDrillDown}
                  onToggleSelect={onToggleSelect}
                  onAddPlan={() => onAddPlan(section.periodKey)}
                  onEditItem={onEditItem}
                  compact
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 체크박스 ──────────────────────────────────────────────────────
function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onChange() }}
      style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 3,
        border: `2px solid ${checked ? '#3b82f6' : '#d1d5db'}`,
        backgroundColor: checked ? '#3b82f6' : 'transparent',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s', userSelect: 'none',
      }}
    >
      {checked && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1, fontWeight: 900 }}>✓</span>}
    </div>
  )
}

// ── 섹션 블록 ─────────────────────────────────────────────────────
interface SectionBlockProps {
  section: Section
  childLevel: PlanLevel
  isDragOver: boolean
  draggingId: string | null
  selectedIds: Set<string>
  onDragStart: (item: PlanItem) => void
  onDragEnd: () => void
  onDragEnter: () => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: () => void
  onCardClick: (item: PlanItem) => void
  onDrillDown: (item: PlanItem) => void
  onToggleSelect: (id: string) => void
  onAddPlan: () => void
  onEditItem: (item: PlanItem) => void
  compact?: boolean
}

function SectionBlock({
  section, childLevel, isDragOver, draggingId, selectedIds,
  onDragStart, onDragEnd, onDragEnter, onDragLeave, onDrop,
  onCardClick, onDrillDown, onToggleSelect, onAddPlan, onEditItem,
  compact = false,
}: SectionBlockProps) {
  const hasDrillDown = childLevel !== 'daily'

  return (
    <div>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{section.label}</span>
          <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>{section.items.length}개</span>
          <div style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
          <button onClick={onAddPlan}
            style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 9px', borderRadius: 7, border: '1.5px dashed #d1d5db', background: '#fff', fontSize: 11, color: '#6b7280', cursor: 'pointer', fontWeight: 500, flexShrink: 0 }}>
            <Plus size={11} /> 추가
          </button>
        </div>
      )}

      <div
        onDragEnter={e => { e.preventDefault(); onDragEnter() }}
        onDragOver={e => { e.preventDefault() }}
        onDragLeave={onDragLeave}
        onDrop={e => { e.preventDefault(); onDrop() }}
        style={{
          borderRadius: 10,
          border: isDragOver ? '2px dashed #3b82f6' : '2px dashed transparent',
          backgroundColor: isDragOver ? 'rgba(59,130,246,0.05)' : 'transparent',
          transition: 'border-color 0.12s, background-color 0.12s',
          minHeight: compact ? 60 : 80, padding: isDragOver ? 4 : 0,
        }}
      >
        {compact && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{section.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{section.items.length}</span>
              <button onClick={onAddPlan}
                style={{ padding: '2px 5px', borderRadius: 5, border: '1px dashed #d1d5db', background: '#fff', fontSize: 10, color: '#9ca3af', cursor: 'pointer' }}>
                <Plus size={10} />
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {section.items.map(item => {
            const isSelected = selectedIds.has(item.id)
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <Checkbox checked={isSelected} onChange={() => onToggleSelect(item.id)} />
                <div style={{ flex: 1, position: 'relative' }} data-cardwrap="">
                  {/* 수정/드릴다운 버튼 */}
                  <div style={{ position: 'absolute', top: 5, right: 5, display: 'flex', gap: 3, zIndex: 1 }}>
                    {hasDrillDown && (
                      <button
                        onClick={e => { e.stopPropagation(); onDrillDown(item) }}
                        title="하위 계획 보기"
                        style={{
                          padding: '3px 6px', border: 'none', background: 'rgba(255,255,255,0.92)',
                          borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
                          fontSize: 9, color: '#6b7280', fontWeight: 600,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                        }}
                      >
                        하위 <ChevronRight size={9} />
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); onEditItem(item) }}
                      title="수정"
                      style={{
                        padding: 4, border: 'none', background: 'rgba(255,255,255,0.92)',
                        borderRadius: 5, cursor: 'pointer', display: 'flex',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      }}
                    >
                      <Pencil size={10} color="#6b7280" />
                    </button>
                  </div>
                  <PlanCard
                    item={item}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onClick={onCardClick}
                    showDrillDown={false}
                    isDragging={draggingId === item.id}
                    compact={compact}
                  />
                </div>
              </div>
            )
          })}

          {section.items.length === 0 && (
            <button onClick={onAddPlan}
              style={{
                border: isDragOver ? '1.5px dashed #3b82f6' : '1.5px dashed #e5e7eb',
                borderRadius: 8, padding: compact ? '10px 6px' : '16px 10px',
                textAlign: 'center', color: isDragOver ? '#3b82f6' : '#d1d5db',
                fontSize: compact ? 10 : 12, cursor: 'pointer', background: 'transparent',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                width: '100%', transition: 'all 0.12s',
              }}
            >
              {isDragOver ? '여기에 놓기 ↓' : <><Plus size={compact ? 12 : 14} />{!compact && '추가'}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
