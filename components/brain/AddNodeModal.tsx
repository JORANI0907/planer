'use client'

import { useState } from 'react'
import type { ThoughtNodeType } from '@/lib/brain-types'
import { NODE_TYPE_CONFIG } from '@/lib/brain-types'

const TYPE_OPTIONS: ThoughtNodeType[] = ['idea', 'logic', 'concern', 'action', 'business', 'memo']

interface Props {
  onConfirm: (title: string, type: ThoughtNodeType) => void
  onClose: () => void
}

export function AddNodeModal({ onConfirm, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ThoughtNodeType>('idea')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onConfirm(title.trim(), type)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-4">새 생각 추가</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">유형</label>
            <div className="flex flex-wrap gap-1.5">
              {TYPE_OPTIONS.map(t => {
                const c = NODE_TYPE_CONFIG[t]
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                      type === t ? 'shadow-sm' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                    style={type === t ? { backgroundColor: c.bg, color: c.color, borderColor: c.color } : undefined}
                  >
                    {c.icon} {c.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">제목</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="생각을 한 문장으로..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">
              취소
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: '#6366f1' }}
            >
              추가
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
