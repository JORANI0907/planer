'use client'

import { useState, useEffect } from 'react'
import type { ThoughtNode, ThoughtNodeType } from '@/lib/brain-types'
import { NODE_TYPE_CONFIG } from '@/lib/brain-types'
import { updateThoughtNode, deleteThoughtNode } from '@/lib/brain-api'

interface Props {
  node: ThoughtNode
  onUpdated: (node: ThoughtNode) => void
  onDeleted: (id: string) => void
  onClose: () => void
}

const TYPE_OPTIONS: ThoughtNodeType[] = ['idea', 'logic', 'concern', 'action', 'business', 'memo']

export function NodeDetailPanel({ node, onUpdated, onDeleted, onClose }: Props) {
  const [title, setTitle] = useState(node.title)
  const [content, setContent] = useState(node.content ?? '')
  const [type, setType] = useState<ThoughtNodeType>(node.type)
  const [tagInput, setTagInput] = useState(node.tags.join(', '))
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setTitle(node.title)
    setContent(node.content ?? '')
    setType(node.type)
    setTagInput(node.tags.join(', '))
    setDirty(false)
  }, [node.id])

  async function handleSave() {
    setSaving(true)
    try {
      const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean)
      const updated = await updateThoughtNode(node.id, { title, content, type, tags })
      onUpdated(updated)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`"${node.title || '이 노드'}"를 삭제할까요? 하위 노드도 모두 삭제됩니다.`)) return
    await deleteThoughtNode(node.id)
    onDeleted(node.id)
  }

  const cfg = NODE_TYPE_CONFIG[type]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">노드 편집</span>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-lg">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 유형 선택 */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">유형</label>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_OPTIONS.map(t => {
              const c = NODE_TYPE_CONFIG[t]
              return (
                <button
                  key={t}
                  onClick={() => { setType(t); setDirty(true) }}
                  className={`px-2 py-1 rounded-lg text-xs font-medium border transition-all ${
                    type === t ? 'border-current shadow-sm' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                  style={type === t ? { backgroundColor: c.bg, color: c.color, borderColor: c.color } : undefined}
                >
                  {c.icon} {c.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 제목 */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">제목</label>
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); setDirty(true) }}
            placeholder="제목 입력..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>

        {/* 내용 */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">내용</label>
          <textarea
            value={content}
            onChange={e => { setContent(e.target.value); setDirty(true) }}
            placeholder="생각을 자유롭게 적어보세요..."
            rows={8}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 resize-none leading-relaxed"
          />
        </div>

        {/* 태그 */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">태그 (쉼표로 구분)</label>
          <input
            value={tagInput}
            onChange={e => { setTagInput(e.target.value); setDirty(true) }}
            placeholder="예: BBK, 마케팅, 2026"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
          />
          {tagInput && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tagInput.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 메타 */}
        <div className="text-xs text-gray-400 space-y-0.5 pt-2 border-t border-gray-100">
          <p>생성: {new Date(node.created_at).toLocaleString('ko-KR')}</p>
          <p>수정: {new Date(node.updated_at).toLocaleString('ko-KR')}</p>
        </div>
      </div>

      <div className="p-4 border-t border-gray-100 flex gap-2">
        <button
          onClick={handleDelete}
          className="px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          삭제
        </button>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40"
          style={{ backgroundColor: '#6366f1' }}
        >
          {saving ? '저장 중...' : dirty ? '저장' : '저장됨'}
        </button>
      </div>
    </div>
  )
}
