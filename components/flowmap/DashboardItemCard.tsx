'use client'

import { useState } from 'react'
import type { PlanItem } from '@/lib/types'
import { updatePlanItem, deletePlanItem } from '@/lib/api'
import { Plus, Loader2, Clipboard, Pencil, Trash2, Check, BarChart3, ListChecks } from 'lucide-react'
import { SubTaskPanel } from '@/components/SubTaskPanel'
import { ConnectionDot } from './ConnectionContext'

const STATUS_DOT: Record<string, string> = { completed: '#22c55e', in_progress: '#3b82f6', on_hold: '#f97316', pending: '#9ca3af' }
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

export function DashboardItemCard({ item, isSelected, showProgress, onSelect, onUpdated, onDeleted, onCopy }: {
  item: PlanItem; isSelected: boolean; showProgress: boolean
  onSelect: (id: string) => void; onUpdated: (item: PlanItem) => void; onDeleted: (item: PlanItem) => void
  onCopy: (item: PlanItem | null) => void
}) {
  const [showDash, setShowDash] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [desc, setDesc] = useState(item.description ?? '')
  const [saving, setSaving] = useState(false)
  const [savingDesc, setSavingDesc] = useState(false)

  const dot = STATUS_DOT[item.status] ?? '#9ca3af'
  const progress = PROGRESS[item.status] ?? 0
  const { labels: flowLabels, currentIdx: stepIdx } = parseFlowSteps(item)
  const [editingFlow, setEditingFlow] = useState(false)
  const [flowDraft, setFlowDraft] = useState<string[]>(flowLabels)

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const u = await updatePlanItem(item.id, { title: title.trim() })
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
    try { await deletePlanItem(item.id); onDeleted(item) } catch { /* ignore */ }
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
        <ConnectionDot itemId={item.id} />
        {isSelected && (
          <div style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 9, fontWeight: 900 }}>✓</span>
          </div>
        )}
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dot, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
        <span style={{ fontSize: 10, color: dot, fontWeight: 600, flexShrink: 0 }}>{flowLabels[stepIdx]}</span>
        <button onClick={e => { e.stopPropagation(); onCopy(item) }} title="복사"
          style={{ padding: '3px 5px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, color: '#6b7280' }}>
          <Clipboard size={10} /> 복사
        </button>
        <button onClick={e => { e.stopPropagation(); setShowDash(d => !d) }} title="대시보드"
          style={{ padding: '3px 6px', border: `1px solid ${showDash ? '#3b82f6' : '#e5e7eb'}`, background: showDash ? '#eff6ff' : '#fff', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, color: showDash ? '#1d4ed8' : '#6b7280', fontWeight: showDash ? 600 : 400 }}>
          <BarChart3 size={10} /> 대시보드
        </button>
        <button onClick={e => { e.stopPropagation(); setShowDetail(d => !d) }} title="세부내용"
          style={{ padding: '3px 6px', border: `1px solid ${showDetail ? '#8b5cf6' : '#e5e7eb'}`, background: showDetail ? '#f5f3ff' : '#fff', borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, color: showDetail ? '#6d28d9' : '#6b7280', fontWeight: showDetail ? 600 : 400 }}>
          <ListChecks size={10} /> 세부내용
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
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
            <button onClick={handleDelete} style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid #fca5a5', background: '#fff', color: '#ef4444', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Trash2 size={10} />삭제
            </button>
            <button onClick={() => { setEditing(false); setTitle(item.title) }}
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
        <div style={{ padding: '16px 18px', borderTop: '1px solid #e5e7eb', animation: 'flowFadeIn 0.15s ease' }}>
          {showProgress && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>진행률</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: dot }}>{progress}%</span>
              </div>
              <div style={{ height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, backgroundColor: dot, borderRadius: 4, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>플랜 플로우</span>
              <button onClick={() => { if (editingFlow) { setEditingFlow(false) } else { setFlowDraft([...flowLabels]); setEditingFlow(true) } }}
                style={{ padding: '2px 7px', borderRadius: 4, border: '1px solid #e5e7eb', background: editingFlow ? '#eff6ff' : '#fff', fontSize: 9, color: editingFlow ? '#1d4ed8' : '#6b7280', cursor: 'pointer', fontWeight: editingFlow ? 600 : 400 }}>
                {editingFlow ? '완료' : '단계 편집'}
              </button>
            </div>

            {editingFlow ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderRadius: 8, backgroundColor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                {flowDraft.map((label, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: STEP_COLORS[idx % STEP_COLORS.length], flexShrink: 0 }} />
                    <input value={label} onChange={e => { const n = [...flowDraft]; n[idx] = e.target.value; setFlowDraft(n) }}
                      style={{ flex: 1, padding: '4px 6px', borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 11, outline: 'none' }} />
                    {flowDraft.length > 2 && (
                      <button onClick={() => setFlowDraft(p => p.filter((_, i) => i !== idx))}
                        style={{ padding: '2px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', fontSize: 12, fontWeight: 700 }}>×</button>
                    )}
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <button onClick={() => setFlowDraft(p => [...p, `단계 ${p.length + 1}`])}
                    style={{ padding: '3px 8px', borderRadius: 4, border: '1px dashed #bfdbfe', background: '#eff6ff', fontSize: 10, color: '#1d4ed8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Plus size={10} /> 단계 추가
                  </button>
                  <button onClick={async () => {
                    const filtered = flowDraft.filter(l => l.trim())
                    if (filtered.length < 2) return
                    try { const u = await updatePlanItem(item.id, { categories: filtered }); onUpdated(u); setEditingFlow(false) } catch { /* ignore */ }
                  }}
                    style={{ padding: '3px 10px', borderRadius: 4, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {flowLabels.map((label, idx) => {
                  const reached = idx <= stepIdx
                  const isCurrent = idx === stepIdx
                  const color = STEP_COLORS[idx % STEP_COLORS.length]
                  const handleStepClick = async () => {
                    const newStatus = statusForStepIdx(idx, flowLabels.length)
                    if (newStatus === item.status) return
                    try { const u = await updatePlanItem(item.id, { status: newStatus }); onUpdated(u) } catch { /* ignore */ }
                  }
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <button type="button" onClick={handleStepClick} title={`${label} 단계로 설정`}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative', zIndex: 1, background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}>
                        <div style={{
                          width: isCurrent ? 28 : 20, height: isCurrent ? 28 : 20, borderRadius: '50%',
                          backgroundColor: reached ? color : '#e5e7eb',
                          border: isCurrent ? `3px solid ${color}40` : 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.3s', boxShadow: isCurrent ? `0 0 12px ${color}40` : 'none',
                        }}>
                          {reached && <Check size={isCurrent ? 14 : 10} color="#fff" strokeWidth={3} />}
                        </div>
                        <span style={{ fontSize: 9, fontWeight: isCurrent ? 700 : 400, color: reached ? color : '#9ca3af', textAlign: 'center', maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                      </button>
                      {idx < flowLabels.length - 1 && (
                        <div style={{ flex: 1, height: 3, backgroundColor: idx < stepIdx ? STEP_COLORS[(idx + 1) % STEP_COLORS.length] : '#e5e7eb', borderRadius: 2, marginTop: -16, transition: 'background-color 0.3s' }} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>진행 메모</span>
              {savingDesc && <span style={{ fontSize: 9, color: '#3b82f6' }}>저장 중...</span>}
            </div>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              onBlur={handleSaveDesc}
              placeholder="계획 진행 상황, 주요 성과, 다음 단계 등을 자유롭게 기록하세요..."
              style={{
                width: '100%', minHeight: 120, padding: '12px 14px', borderRadius: 10,
                border: '1.5px solid #e5e7eb', fontSize: 13, lineHeight: 1.7,
                outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                fontFamily: 'inherit', backgroundColor: '#fafbfc',
              }}
            />
          </div>
        </div>
      )}

      {/* 세부내용 패널 */}
      {showDetail && (
        <div style={{ borderTop: '1px solid #e5e7eb', animation: 'flowFadeIn 0.15s ease', padding: '4px 0 0' }}>
          <SubTaskPanel itemId={item.id} autoFocus={false} />
        </div>
      )}
    </div>
  )
}
