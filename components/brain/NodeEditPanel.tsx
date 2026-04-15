'use client'

import { useState, useEffect } from 'react'
import type { ThoughtNodeType, EdgeRelationType } from '@/lib/brain-types'
import { NODE_TYPE_CONFIG, EDGE_RELATION_CONFIG } from '@/lib/brain-types'

const NODE_TYPES: ThoughtNodeType[] = ['idea', 'logic', 'concern', 'action', 'business', 'memo']
const EDGE_TYPES: EdgeRelationType[] = ['supports', 'contradicts', 'leads_to', 'related']

// ─── Node Edit ────────────────────────────────────────────────
interface NodePanelProps {
  id: string
  title: string
  content: string | null
  nodeType: ThoughtNodeType
  tags: string[]
  onSave: (id: string, updates: { title: string; content: string; type: ThoughtNodeType; tags: string[] }) => Promise<void>
  onClose: () => void
}

export function NodeEditPanel({ id, title, content, nodeType, tags, onSave, onClose }: NodePanelProps) {
  const [t, setT] = useState(title)
  const [c, setC] = useState(content ?? '')
  const [type, setType] = useState<ThoughtNodeType>(nodeType)
  const [tagStr, setTagStr] = useState(tags.join(', '))
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setT(title); setC(content ?? ''); setType(nodeType); setTagStr(tags.join(', ')); setDirty(false)
  }, [id])

  async function save() {
    setSaving(true)
    try {
      const parsedTags = tagStr.split(',').map(s => s.trim()).filter(Boolean)
      await onSave(id, { title: t, content: c, type, tags: parsedTags })
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">노드 편집</span>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg leading-none">×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">유형</label>
          <div className="flex flex-wrap gap-1">
            {NODE_TYPES.map(nt => {
              const cfg = NODE_TYPE_CONFIG[nt]
              return (
                <button key={nt} onClick={() => { setType(nt); setDirty(true) }}
                  className="px-2 py-1 rounded-lg text-xs font-medium border transition-all"
                  style={type === nt ? { backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.color } : { borderColor: '#e5e7eb', color: '#9ca3af' }}
                >
                  {cfg.icon} {cfg.label}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">제목</label>
          <input value={t} onChange={e => { setT(e.target.value); setDirty(true) }}
            placeholder="제목 입력..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">내용</label>
          <textarea value={c} onChange={e => { setC(e.target.value); setDirty(true) }}
            placeholder="생각을 자유롭게..." rows={7}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 resize-none leading-relaxed" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">태그 (쉼표 구분)</label>
          <input value={tagStr} onChange={e => { setTagStr(e.target.value); setDirty(true) }}
            placeholder="예: BBK, 마케팅" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400" />
        </div>
      </div>
      <div className="p-4 border-t border-gray-100">
        <button onClick={save} disabled={!dirty || saving}
          className="w-full py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40"
          style={{ backgroundColor: '#6366f1' }}>
          {saving ? '저장 중...' : dirty ? '저장' : '저장됨'}
        </button>
      </div>
    </div>
  )
}

// ─── Edge Edit ────────────────────────────────────────────────
interface EdgePanelProps {
  id: string
  label: string | null
  relationType: EdgeRelationType
  onSave: (id: string, updates: { label: string; relation_type: EdgeRelationType }) => Promise<void>
  onDelete: (id: string) => void
  onClose: () => void
}

export function EdgeEditPanel({ id, label, relationType, onSave, onDelete, onClose }: EdgePanelProps) {
  const [lbl, setLbl] = useState(label ?? '')
  const [rel, setRel] = useState<EdgeRelationType>(relationType)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setLbl(label ?? ''); setRel(relationType) }, [id])

  async function save() {
    setSaving(true)
    try { await onSave(id, { label: lbl, relation_type: rel }) }
    finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">연결선 편집</span>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg leading-none">×</button>
      </div>
      <div className="flex-1 p-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">관계 유형</label>
          <div className="flex flex-col gap-1.5">
            {EDGE_TYPES.map(et => {
              const cfg = EDGE_RELATION_CONFIG[et]
              return (
                <button key={et} onClick={() => setRel(et)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all"
                  style={rel === et ? { backgroundColor: cfg.color + '15', borderColor: cfg.color, color: cfg.color }
                    : { borderColor: '#e5e7eb', color: '#6b7280' }}
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">라벨 (선택)</label>
          <input value={lbl} onChange={e => setLbl(e.target.value)}
            placeholder="예: 핵심 근거" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400" />
        </div>
      </div>
      <div className="p-4 border-t border-gray-100 flex gap-2">
        <button onClick={() => onDelete(id)} className="px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg">삭제</button>
        <button onClick={save} disabled={saving}
          className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: '#6366f1' }}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}
