'use client'

import { useState } from 'react'
import type { PlanItem, PlanLevel } from '@/lib/types'
import { STATUS_CONFIG } from '@/lib/types'
import { createPlanItem, updatePlanItem, deletePlanItem } from '@/lib/api'
import { LEVEL_LABEL, formatPeriodKey } from '@/lib/flowmap-layout'
import { X, Loader2, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

export interface FormTarget {
  mode: 'create' | 'edit'
  level: PlanLevel
  periodKey: string
  editItem?: PlanItem | null
  parentItems?: PlanItem[]
  sectionOptions?: { periodKey: string; label: string }[]
}

const STATUS_DOT: Record<string, string> = {
  completed: '#22c55e', in_progress: '#3b82f6', on_hold: '#f97316', pending: '#9ca3af',
}

interface PlanFormModalProps {
  target: FormTarget
  onClose: () => void
  onSaved: (item: PlanItem) => void
  onDeleted?: () => void
}

export function PlanFormModal({ target, onClose, onSaved, onDeleted }: PlanFormModalProps) {
  const [title, setTitle] = useState(target.editItem?.title ?? '')
  const [selectedPeriodKey, setSelectedPeriodKey] = useState(target.periodKey)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [expandedParent, setExpandedParent] = useState<PlanItem | null>(null)

  const periodLabel = formatPeriodKey(selectedPeriodKey, target.level)
  const parentItems = target.parentItems ?? []
  const sectionOptions = target.sectionOptions ?? []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('계획 제목을 입력해주세요'); return }
    setSaving(true)
    try {
      if (target.mode === 'create') {
        const item = await createPlanItem({
          level: target.level,
          period_key: selectedPeriodKey,
          title: title.trim(),
          description: null,
          categories: [],
          status: 'pending',
          priority: 'medium',
          sort_order: 0,
        })
        onSaved(item)
      } else if (target.editItem) {
        const item = await updatePlanItem(target.editItem.id, {
          title: title.trim(),
        })
        onSaved(item)
      }
    } catch {
      setError('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!target.editItem) return
    setDeleting(true)
    try {
      await deletePlanItem(target.editItem.id)
      onDeleted?.()
      onClose()
    } catch {
      setError('삭제에 실패했습니다')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 70, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 460, backgroundColor: '#fff', borderRadius: 16,
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)', overflow: 'hidden',
        animation: 'fmPopIn 0.18s ease', maxHeight: 'calc(100vh - 32px)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{LEVEL_LABEL[target.level]} · {periodLabel}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginTop: 1 }}>
              {target.mode === 'create' ? '계획 추가' : '계획 수정'}
            </div>
          </div>
          <button onClick={onClose} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}>
            <X size={18} color="#6b7280" />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* Parent context */}
          {parentItems.length > 0 && (
            <div style={{ padding: '12px 20px 14px', borderBottom: '1px solid #f0f2f5', backgroundColor: '#fafbfc' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                상위 계획 참고 ({parentItems.length})
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {parentItems.map(item => {
                  const isExpanded = expandedParent?.id === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setExpandedParent(isExpanded ? null : item)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px', borderRadius: 20,
                        border: `1.5px solid ${isExpanded ? '#3b82f6' : '#e5e7eb'}`,
                        backgroundColor: isExpanded ? '#eff6ff' : '#fff',
                        cursor: 'pointer', fontSize: 12,
                        color: isExpanded ? '#1d4ed8' : '#374151',
                        fontWeight: isExpanded ? 600 : 400,
                        transition: 'all 0.12s', maxWidth: 200,
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: STATUS_DOT[item.status] ?? '#9ca3af', flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                      {isExpanded ? <ChevronUp size={11} style={{ flexShrink: 0 }} /> : <ChevronDown size={11} style={{ flexShrink: 0 }} />}
                    </button>
                  )
                })}
              </div>

              {/* Expanded parent detail */}
              {expandedParent && (
                <div style={{
                  marginTop: 10, padding: '10px 14px', borderRadius: 10,
                  backgroundColor: '#eff6ff', border: '1.5px solid #bfdbfe',
                  animation: 'fmPopIn 0.15s ease',
                }}>
                  <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700, marginBottom: 4 }}>
                    {LEVEL_LABEL[expandedParent.level]} · {formatPeriodKey(expandedParent.period_key, expandedParent.level)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 6, lineHeight: 1.4 }}>
                    {expandedParent.title}
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: STATUS_DOT[expandedParent.status], fontWeight: 600 }}>
                      ● {STATUS_CONFIG[expandedParent.status]?.label}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Period selector (only for create with multiple sections) */}
            {target.mode === 'create' && sectionOptions.length > 1 && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>기간 선택</label>
                <select
                  value={selectedPeriodKey}
                  onChange={e => setSelectedPeriodKey(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', backgroundColor: '#fff', cursor: 'pointer' }}
                >
                  {sectionOptions.map(opt => (
                    <option key={opt.periodKey} value={opt.periodKey}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>계획 제목 *</label>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={e => { setTitle(e.target.value); setError('') }}
                placeholder="계획 제목을 입력하세요"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${error ? '#ef4444' : '#e5e7eb'}`, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              {error && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{error}</div>}
            </div>

            <div style={{ fontSize: 11, color: '#9ca3af', padding: '4px 2px' }}>
              💡 진행 단계는 저장 후 카드의 <strong>플랜 플로우</strong>에서 클릭하여 설정하세요.
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {target.mode === 'edit' && (
                  <button type="button" onClick={handleDelete} disabled={deleting}
                    style={{ padding: '9px 14px', borderRadius: 8, border: '1.5px solid #fecaca', background: '#fff', color: '#ef4444', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {deleting ? <Loader2 size={14} style={{ animation: 'fmSpin 1s linear infinite' }} /> : <Trash2 size={14} />}
                    삭제
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={onClose}
                  style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 13, color: '#374151', cursor: 'pointer', fontWeight: 500 }}>
                  취소
                </button>
                <button type="submit" disabled={saving}
                  style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
                  {saving && <Loader2 size={14} style={{ animation: 'fmSpin 1s linear infinite' }} />}
                  저장
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      <style>{`
        @keyframes fmPopIn { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes fmSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
