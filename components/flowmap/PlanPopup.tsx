'use client'

import { useState, useEffect, useCallback } from 'react'
import type { PlanItem, PlanLevel } from '@/lib/types'
import { getMonthWeeks, getWeekDays } from '@/lib/types'
import { getPlanItems } from '@/lib/api'
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
}

interface PlanPopupProps {
  frames: PopupFrame[]
  onPush: (frame: PopupFrame) => void
  onPopTo: (index: number) => void
  onClose: () => void
  onQuarterlyCreated?: () => void  // quarterly 생성 시 칸반 리로드
}

// 현재 frame에서 보여줄 섹션들의 period keys 생성
function getChildSections(frame: PopupFrame): { periodKey: string; label: string }[] {
  const { periodKey, childLevel } = frame

  if (childLevel === 'monthly') {
    const [yearStr, qPart] = periodKey.split('-Q')
    const year = parseInt(yearStr)
    const q = parseInt(qPart)
    const startMonth = (q - 1) * 3 + 1
    return [startMonth, startMonth + 1, startMonth + 2].map(m => ({
      periodKey: `${year}-${String(m).padStart(2, '0')}`,
      label: `${m}월`,
    }))
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

// 다음 드릴다운 frame 생성
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

  // currentFrame이 바뀔 때마다 데이터 로드
  useEffect(() => {
    if (!currentFrame) return
    setLoading(true)

    const childSections = getChildSections(currentFrame)
    if (childSections.length === 0) {
      setSections([])
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

  const handleCardClick = useCallback((item: PlanItem) => {
    const frame = makeChildFrame(item)
    if (!frame) {
      // daily: 편집 폼 열기
      setEditItem(item)
    } else {
      onPush(frame)
    }
  }, [onPush])

  const handleFormSaved = useCallback((saved: PlanItem) => {
    setFormTarget(null)
    setEditItem(null)
    // 현재 섹션에 추가 또는 업데이트
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

  const childLevelLabel = LEVEL_LABEL[currentFrame.childLevel]

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        onClick={e => { if (e.target === e.currentTarget && !formTarget && !editItem) onClose() }}
      >
        <div style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: 'min(82vh, 680px)',
          backgroundColor: '#fff',
          borderRadius: 18,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
          overflow: 'hidden',
          animation: 'ppIn 0.2s ease',
        }}>
          {/* Breadcrumb header */}
          <div style={{ padding: '10px 18px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, minHeight: 44 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, overflow: 'hidden', flexWrap: 'nowrap' }}>
              {frames.map((frame, idx) => (
                <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: idx < frames.length - 1 ? 1 : 0, minWidth: 0 }}>
                  {idx > 0 && <ChevronRight size={11} color="#d1d5db" style={{ flexShrink: 0 }} />}
                  <button
                    onClick={() => idx < frames.length - 1 ? onPopTo(idx) : undefined}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: idx < frames.length - 1 ? 'pointer' : 'default',
                      padding: '2px 5px',
                      borderRadius: 5,
                      fontSize: 12,
                      fontWeight: idx === frames.length - 1 ? 700 : 400,
                      color: idx === frames.length - 1 ? '#111827' : '#6b7280',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 120,
                    }}
                  >
                    {frame.label}
                  </button>
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

          {/* Title bar */}
          <div style={{ padding: '10px 18px 8px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', flex: 1 }}>
              {currentFrame.label} — {childLevelLabel} 계획
            </span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>
              총 {sections.reduce((s, sec) => s + sec.items.length, 0)}개
            </span>
          </div>

          {/* Sections */}
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={26} color="#3b82f6" style={{ animation: 'ppSpin 1s linear infinite' }} />
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {sections.map(section => (
                <div key={section.periodKey}>
                  {/* Section header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>{section.label}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>{section.items.length}개</span>
                    <div style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
                    <button
                      onClick={() => setFormTarget({ mode: 'create', level: currentFrame.childLevel, periodKey: section.periodKey })}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 9px', borderRadius: 7, border: '1.5px dashed #d1d5db', background: '#fff', fontSize: 11, color: '#6b7280', cursor: 'pointer', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                      <Plus size={11} /> 추가
                    </button>
                  </div>

                  {/* Cards grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 9 }}>
                    {section.items.map(item => (
                      <div key={item.id} style={{ position: 'relative' }} data-card-wrap="">
                        <PlanCard
                          item={item}
                          onClick={() => handleCardClick(item)}
                          showDrillDown={item.level !== 'daily'}
                        />
                        <button
                          onClick={e => { e.stopPropagation(); setEditItem(item) }}
                          style={{ position: 'absolute', top: 5, right: 5, padding: 3, border: 'none', background: 'rgba(255,255,255,0.85)', borderRadius: 5, cursor: 'pointer', display: 'flex', opacity: 0 }}
                          className="card-edit-btn"
                          title="편집"
                        >
                          <Pencil size={10} color="#6b7280" />
                        </button>
                      </div>
                    ))}
                    {section.items.length === 0 && (
                      <button
                        onClick={() => setFormTarget({ mode: 'create', level: currentFrame.childLevel, periodKey: section.periodKey })}
                        style={{ border: '1.5px dashed #d1d5db', borderRadius: 10, padding: '18px 10px', textAlign: 'center', color: '#9ca3af', fontSize: 12, cursor: 'pointer', background: '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
                      >
                        <Plus size={15} />
                        계획 추가
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {sections.length === 0 && !loading && (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                  <div style={{ fontSize: 13 }}>이 기간에 계획이 없습니다</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 편집 폼 (editItem) */}
      {editItem && (
        <PlanFormModal
          target={{ mode: 'edit', level: editItem.level, periodKey: editItem.period_key, editItem }}
          onClose={() => setEditItem(null)}
          onSaved={handleFormSaved}
          onDeleted={() => handleDeleted(editItem.id)}
        />
      )}

      {/* 추가 폼 (formTarget) */}
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
        .card-edit-btn { opacity: 0 !important; transition: opacity 0.15s; }
        [data-card-wrap]:hover .card-edit-btn { opacity: 1 !important; }
      `}</style>
    </>
  )
}
