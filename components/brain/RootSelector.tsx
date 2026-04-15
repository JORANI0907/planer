'use client'

import { useState } from 'react'
import type { ThoughtNode, ThoughtNodeType } from '@/lib/brain-types'
import { NODE_TYPE_CONFIG } from '@/lib/brain-types'

interface Props {
  roots: ThoughtNode[]
  onSelect: (node: ThoughtNode) => void
  onCreateRoot: (title: string, type: ThoughtNodeType) => void
}

const TYPE_OPTIONS: ThoughtNodeType[] = ['idea', 'logic', 'concern', 'action', 'business', 'memo']

export function RootSelector({ roots, onSelect, onCreateRoot }: Props) {
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ThoughtNodeType>('idea')

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onCreateRoot(title.trim(), type)
    setTitle('')
    setCreating(false)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🧠</div>
        <h2 className="text-xl font-bold text-gray-900">생각 확장 맵</h2>
        <p className="text-sm text-gray-500 mt-1">주제를 선택하거나 새로 만들어 생각을 확장하세요</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {roots.map(node => {
          const cfg = NODE_TYPE_CONFIG[node.type]
          return (
            <button
              key={node.id}
              onClick={() => onSelect(node)}
              className="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-indigo-300 hover:shadow-md text-left transition-all group"
              style={{ borderLeftColor: cfg.color, borderLeftWidth: 4 }}
            >
              <span className="text-2xl">{cfg.icon}</span>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{node.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{cfg.label} · {new Date(node.updated_at).toLocaleDateString('ko-KR')}</p>
              </div>
              <span className="ml-auto text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">▶</span>
            </button>
          )
        })}

        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-gray-400 hover:text-indigo-500"
          >
            <span className="text-2xl">+</span>
            <span className="text-sm font-medium">새 주제 만들기</span>
          </button>
        ) : (
          <form onSubmit={handleCreate} className="p-4 rounded-xl border-2 border-indigo-300 bg-indigo-50 space-y-3">
            <div className="flex flex-wrap gap-1">
              {TYPE_OPTIONS.map(t => {
                const c = NODE_TYPE_CONFIG[t]
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`px-2 py-0.5 rounded-md text-xs font-medium border transition-all ${
                      type === t ? 'shadow-sm' : 'border-transparent text-gray-400'
                    }`}
                    style={type === t ? { backgroundColor: c.bg, color: c.color, borderColor: c.color } : undefined}
                  >
                    {c.icon} {c.label}
                  </button>
                )
              })}
            </div>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="주제 이름..."
              className="w-full px-3 py-1.5 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 bg-white"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setCreating(false)} className="flex-1 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg bg-white hover:bg-gray-50">취소</button>
              <button type="submit" disabled={!title.trim()} className="flex-1 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-40" style={{ backgroundColor: '#6366f1' }}>만들기</button>
            </div>
          </form>
        )}
      </div>

      {roots.length === 0 && !creating && (
        <p className="text-center text-xs text-gray-400 mt-4">아직 주제가 없습니다. 첫 번째 생각의 씨앗을 심어보세요 🌱</p>
      )}
    </div>
  )
}
