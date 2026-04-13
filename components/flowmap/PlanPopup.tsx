'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PlanItem, PlanLevel } from '@/lib/types'
import { getMonthWeeks, getWeekDays } from '@/lib/types'
import { getPlanItems, updatePlanItem } from '@/lib/api'
import { LEVEL_LABEL, formatPeriodKey } from '@/lib/flowmap-layout'
import { X, ChevronRight, Plus, Loader2, Pencil } from 'lucide-react'
import { PlanCard } from './PlanCard'
import { PlanFormModal } from './PlanFormModal'
import type { FormTarget } from './PlanFormModal'

export interface PopupFrame {
  periodKey: string     // e.g. '2026-Q1', '2026-04', '2026-W15'
  childLevel: PlanLevel // what level items to show inside
  label: string         // '1분기', '4월', '15주차' for breadcrumb
}

interface Section {
  periodKey: string
  label: string
  items: PlanItem[]
  // 월간 팝업의 분기 구분용
  quarterGroup?: 'Q1' | 'Q2' | 'Q3' | 'Q4'
}

interface PlanPopupProps {
  frames: PopupFrame[]
  onPush: (frame: PopupFrame) => void
  onPopTo: (index: number) => void
  onClose: () => void
  onQuarterlyCreated?: () => void
}

// 월별 분기 그룹
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

// 현재 frame에서 보여줄 섹션들의 period keys 생성
function getChildSections(frame: PopupFrame): { periodKey: string; label: string; quarterGroup?: 'Q1' | 'Q2' | 'Q3' | 'Q4' }[] {
  const { periodKey, childLevel } = frame

  if (childLevel === 'monthly') {
    // 연도 추출: '2026-Q1', '2026-04' 등 모두 첫 토큰이 연도
    const year = parseInt(periodKey.split('-')[0])
    // 전체 12개월 표시 → 어떤 분기 팝업에서 열어도 4월↔7월 DnD 가능
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
    return weekKeys.map(k => ({
      periodKey: k,
      label: `${parseInt(k.split('-W')[1])}주차`,
    }))
  }

  if (childLevel === 'daily') {
    const [yearStr, weekPart] = periodKey.split('-W')
    const dayKeys = getWeekDays(parseInt(yearStr), parseInt(weekPart))
    const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
    return dayKeys.map(k => {
      const parts = k.split('-').map(Number)
      const m = parts[1]
      const d = parts[2]
      const date = new Date(parseInt(yearStr), m - 1, d)
      return { periodKey: k, label: `${m}/${d}(${DAY_NAMES[date.getDay()]})` }
    })
  }

  return []
}

// 카드 클릭 시 다음 드릴다운 frame 생성
function makeChildFrame(item: PlanItem): PopupFrame | null {
  const NEXT: Partial<Record<PlanLevel, PlanLevel>> = {
    quarterly: 'monthly',
    monthly: 'weekly',
    weekly: 'daily',
  }
  const childLevel = NEXT[item.level]
  if (!childLevel) return null
  return {
    periodKey: item.period_key,
    childLevel,
    label: formatPeriodKey(item.period_key, item.level),
  }
}

export function PlanPopup({ frames, onPush, onPopTo, onClose, onQuarterlyCreated }: PlanPopupProps) {
  const currentFrame = frames[frames.length - 1]
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(false)
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null)
  const [editItem, setEditItem] = useState<PlanItem | null>(null)

  // ── DnD 상태 ──────────────────────────────────────────────────
  const draggingItem = useRef<PlanItem | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverSection, setDragOverSection] = useState<string | null>(null)

  // currentFrame이 바뀔 때마다 섹션 데이터 로드
  useEffect(() => {
    if (!currentFrame) return
    setLoading(true)
    setSections([])
    setDragOverSection(null)

    const childSections = getChildSections(currentFrame)
    if (childSections.length === 0) {
      setLoading(false)
      return
    }

    Promise.all(childSections.map(s => getPlanItems(currentFrame.childLevel, s.periodKey)))
      .then(results => {
        setSections(childSections.map((s, i) => ({ ...s, items: results[i] })))
      })
      .catch(() => setSections(childSections.map(s => ({ ...s, items: [] }))))
      .finally(() => setLoading(false))
  }, [currentFrame?.periodKey, currentFrame?.childLevel])

  // ── DnD 핸들러 ────────────────────────────────────────────────

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

    // Optimistic update: 즉시 UI 반영
    setSections(prev => prev.map(sec => {
      if (sec.periodKey === sourcePeriodKey) {
        return { ...sec, items: sec.items.filter(i => i.id !== item.id) }
      }
      if (sec.periodKey === targetPeriodKey) {
        return { ...sec, items: [...sec.items, { ...item, period_key: targetPeriodKey }] }
      }
      return sec
    }))

    // DB 저장
    try {
      await updatePlanItem(item.id, { period_key: targetPeriodKey })
    } catch {
      // 실패 시 롤백
      setSections(prev => prev.map(sec => {
        if (sec.periodKey === targetPeriodKey) {
          return { ...sec, items: sec.items.filter(i => i.id !== item.id) }
        }
        if (sec.periodKey === sourcePeriodKey) {
          return { ...sec, items: [...sec.items, item] }
        }
        return sec
      }))
    }
  }, [])

  // ── 폼/편집 핸들러 ────────────────────────────────────────────

  const handleCardClick = useCallback((item: PlanItem) => {
    const frame = makeChildFrame(item)
    if (!frame) {
      setEditItem(item)
    } else {
      onPush(frame)
    }
  }, [onPush])

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
  const childLevelLabel = LEVEL_LABEL[currentFrame.childLevel]
  const isMonthly = currentFrame.childLevel === 'monthly'

  return (
    <>
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}
        onClick={e => { if (e.target === e.currentTarget && !formTarget && !editItem) onClose() }}
      >
        <div style={{
          width: '100%',
          maxWidth: isMonthly ? 860 : 720,
          maxHeight: 'min(86vh, 720px)',
          backgroundColor: '#fff',
          borderRadius: 18,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
          overflow: 'hidden',
          animation: 'ppIn 0.2s ease',
        }}>

          {/* Breadcrumb header */}
          <div style={{
            padding: '10px 18px', backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, minHeight: 44,
          }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, overflow: 'hidden' }}>
              {frames.map((frame, idx) => (
                <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: idx < frames.length - 1 ? 1 : 0, minWidth: 0 }}>
                  {idx > 0 && <ChevronRight size={11} color="#d1d5db" style={{ flexShrink: 0 }} />}
                  <button
                    onClick={() => idx < frames.length - 1 ? onPopTo(idx) : undefined}
                    style={{
                      background: 'none', border: 'none',
                      cursor: idx < frames.length - 1 ? 'pointer' : 'default',
                      padding: '2px 5px', borderRadius: 5,
                      fontSize: 12,
                      fontWeight: idx === frames.length - 1 ? 700 : 400,
                      color: idx === frames.length - 1 ? '#111827' : '#6b7280',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140,
                    }}
                  >
                    {frame.label}
                  </button>
                </span>
              ))}
            </div>
            {frames.length > 1 && (
              <button
                onClick={() => onPopTo(frames.length - 2)}
                style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', fontSize: 11, color: '#374151', cursor: 'pointer', flexShrink: 0, fontWeight: 500 }}
              >
                ← 뒤로
              </button>
            )}
            <button onClick={onClose} style={{ padding: 5, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
              <X size={17} color="#9ca3af" />
            </button>
          </div>

          {/* Title bar */}
          <div style={{
            padding: '10px 18px 8px', borderBottom: '1px solid #f3f4f6',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', flex: 1 }}>
              {isMonthly
                ? `${parseInt(currentFrame.periodKey.split('-')[0])}년 전체 월간 계획`
                : `${currentFrame.label} — ${childLevelLabel} 계획`
              }
            </span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>총 {totalCount}개</span>
            {draggingId && (
              <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>
                📌 드래그 중 — 섹션에 놓기
              </span>
            )}
          </div>

          {/* Sections */}
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={26} color="#3b82f6" style={{ animation: 'ppSpin 1s linear infinite' }} />
            </div>
          ) : (
            <div style={{
              flex: 1, overflowY: 'auto', padding: '16px 18px',
              display: 'flex', flexDirection: 'column', gap: isMonthly ? 12 : 20,
            }}>
              {/* 월간: 분기별로 묶어서 표시 */}
              {isMonthly ? (
                <MonthlyGrid
                  sections={sections}
                  dragOverSection={dragOverSection}
                  draggingId={draggingId}
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
                  onAddPlan={key => setFormTarget({ mode: 'create', level: currentFrame.childLevel, periodKey: key })}
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
                    onAddPlan={() => setFormTarget({ mode: 'create', level: currentFrame.childLevel, periodKey: section.periodKey })}
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

      {editItem && (
        <PlanFormModal
          target={{ mode: 'edit', level: editItem.level, periodKey: editItem.period_key, editItem }}
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
        .pp-edit-btn { opacity: 0 !important; transition: opacity 0.15s; }
        [data-cardwrap]:hover .pp-edit-btn { opacity: 1 !important; }
      `}</style>
    </>
  )
}

// ── 월간 팝업: 분기별 그룹 레이아웃 ─────────────────────────────

const QUARTER_LABELS: Record<string, string> = {
  Q1: '1분기 (1~3월)', Q2: '2분기 (4~6월)', Q3: '3분기 (7~9월)', Q4: '4분기 (10~12월)',
}

interface MonthlyGridProps {
  sections: Section[]
  dragOverSection: string | null
  draggingId: string | null
  onDragStart: (item: PlanItem) => void
  onDragEnd: () => void
  onDragEnter: (key: string) => void
  onDragLeave: (e: React.DragEvent, key: string) => void
  onDrop: (key: string) => void
  onCardClick: (item: PlanItem) => void
  onAddPlan: (key: string) => void
  onEditItem: (item: PlanItem) => void
}

function MonthlyGrid({
  sections, dragOverSection, draggingId,
  onDragStart, onDragEnd, onDragEnter, onDragLeave, onDrop,
  onCardClick, onAddPlan, onEditItem,
}: MonthlyGridProps) {
  const quarters: Array<'Q1' | 'Q2' | 'Q3' | 'Q4'> = ['Q1', 'Q2', 'Q3', 'Q4']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {quarters.map(q => {
        const qSections = sections.filter(s => s.quarterGroup === q)
        const qs = QUARTER_STYLE[q]
        return (
          <div key={q}>
            {/* 분기 구분 헤더 */}
            <div style={{
              fontSize: 11, fontWeight: 700, color: qs.color,
              padding: '4px 10px', backgroundColor: qs.bg,
              borderRadius: 6, display: 'inline-block', marginBottom: 10,
              border: `1px solid ${qs.border}`,
            }}>
              {QUARTER_LABELS[q]}
            </div>
            {/* 3개 월 가로 배치 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {qSections.map(section => (
                <SectionBlock
                  key={section.periodKey}
                  section={section}
                  childLevel="monthly"
                  isDragOver={dragOverSection === section.periodKey}
                  draggingId={draggingId}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragEnter={() => onDragEnter(section.periodKey)}
                  onDragLeave={e => onDragLeave(e, section.periodKey)}
                  onDrop={() => onDrop(section.periodKey)}
                  onCardClick={onCardClick}
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

// ── 개별 섹션 블록 ────────────────────────────────────────────────

interface SectionBlockProps {
  section: Section
  childLevel: PlanLevel
  isDragOver: boolean
  draggingId: string | null
  onDragStart: (item: PlanItem) => void
  onDragEnd: () => void
  onDragEnter: () => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: () => void
  onCardClick: (item: PlanItem) => void
  onAddPlan: () => void
  onEditItem: (item: PlanItem) => void
  compact?: boolean
}

function SectionBlock({
  section, isDragOver, draggingId,
  onDragStart, onDragEnd, onDragEnter, onDragLeave, onDrop,
  onCardClick, onAddPlan, onEditItem,
  compact = false,
}: SectionBlockProps) {
  return (
    <div>
      {/* Section header */}
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{section.label}</span>
          <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>{section.items.length}개</span>
          <div style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
          <button
            onClick={onAddPlan}
            style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 9px', borderRadius: 7, border: '1.5px dashed #d1d5db', background: '#fff', fontSize: 11, color: '#6b7280', cursor: 'pointer', fontWeight: 500, flexShrink: 0 }}
          >
            <Plus size={11} /> 추가
          </button>
        </div>
      )}

      {/* Drop zone */}
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
          minHeight: compact ? 60 : 80,
          padding: isDragOver ? 4 : 0,
        }}
      >
        {/* Compact header (월간 그리드 내부용) */}
        {compact && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{section.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{section.items.length}</span>
              <button
                onClick={onAddPlan}
                style={{ padding: '2px 5px', borderRadius: 5, border: '1px dashed #d1d5db', background: '#fff', fontSize: 10, color: '#9ca3af', cursor: 'pointer' }}
              >
                <Plus size={10} />
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {section.items.map(item => (
            <div key={item.id} style={{ position: 'relative' }} data-cardwrap="">
              <PlanCard
                item={item}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onClick={onCardClick}
                showDrillDown={item.level !== 'daily'}
                isDragging={draggingId === item.id}
                compact={compact}
              />
              <button
                onClick={e => { e.stopPropagation(); onEditItem(item) }}
                className="pp-edit-btn"
                title="편집"
                style={{
                  position: 'absolute', top: 5, right: 5,
                  padding: 3, border: 'none', background: 'rgba(255,255,255,0.9)',
                  borderRadius: 5, cursor: 'pointer', display: 'flex',
                }}
              >
                <Pencil size={10} color="#6b7280" />
              </button>
            </div>
          ))}

          {section.items.length === 0 && (
            <button
              onClick={onAddPlan}
              style={{
                border: isDragOver ? '1.5px dashed #3b82f6' : '1.5px dashed #e5e7eb',
                borderRadius: 8,
                padding: compact ? '10px 6px' : '16px 10px',
                textAlign: 'center',
                color: isDragOver ? '#3b82f6' : '#d1d5db',
                fontSize: compact ? 10 : 12,
                cursor: 'pointer',
                background: 'transparent',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                width: '100%',
                transition: 'all 0.12s',
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
