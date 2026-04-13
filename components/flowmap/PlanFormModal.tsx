'use client'

import { useState } from 'react'
import type { PlanItem, PlanLevel } from '@/lib/types'
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/types'
import { createPlanItem, updatePlanItem, deletePlanItem } from '@/lib/api'
import { LEVEL_LABEL, formatPeriodKey } from '@/lib/flowmap-layout'
import { X, Loader2, Trash2 } from 'lucide-react'

export interface FormTarget {
  mode: 'create' | 'edit'
  level: PlanLevel
  periodKey: string
  editItem?: PlanItem | null
}

interface PlanFormModalProps {
  target: FormTarget
  onClose: () => void
  onSaved: (item: PlanItem) => void
  onDeleted?: () => void
}

export function PlanFormModal({ target, onClose, onSaved, onDeleted }: PlanFormModalProps) {
  const [title, setTitle] = useState(target.editItem?.title ?? '')
  const [status, setStatus] = useState<string>(target.editItem?.status ?? 'pending')
  const [priority, setPriority] = useState<string>(target.editItem?.priority ?? 'medium')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const periodLabel = formatPeriodKey(target.periodKey, target.level)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('계획 제목을 입력해주세요'); return }
    setSaving(true)
    try {
      if (target.mode === 'create') {
        const item = await createPlanItem({
          level: target.level,
          period_key: target.periodKey,
          title: title.trim(),
          description: null,
          categories: [],
          status: status as PlanItem['status'],
          priority: priority as PlanItem['priority'],
          sort_order: 0,
        })
        onSaved(item)
      } else if (target.editItem) {
        const item = await updatePlanItem(target.editItem.id, {
          title: title.trim(),
          status: status as PlanItem['status'],
          priority: priority as PlanItem['priority'],
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
    if (!target.editItem || !confirm('이 계획을 삭제하시겠습니까?')) return
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
      <div style={{ width: '100%', maxWidth: 440, backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden', animation: 'fmPopIn 0.18s ease' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
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

        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>상태</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', backgroundColor: '#fff', cursor: 'pointer' }}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>우선순위</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', backgroundColor: '#fff', cursor: 'pointer' }}>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
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
      <style>{`
        @keyframes fmPopIn { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes fmSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
