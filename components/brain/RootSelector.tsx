'use client'

import { useState } from 'react'
import { Brain, Sprout } from 'lucide-react'
import type { ThoughtNode } from '@/lib/brain-types'

interface Props {
  topics: ThoughtNode[]
  onSelect: (topic: ThoughtNode) => void
  onCreate: (title: string) => void
  onDelete: (id: string) => void
}

export function RootSelector({ topics, onSelect, onCreate, onDelete }: Props) {
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onCreate(title.trim())
    setTitle('')
    setCreating(false)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-3"><Brain size={48} /></div>
        <h2 className="text-xl font-bold text-gray-900">생각 확장 맵</h2>
        <p className="text-sm text-gray-500 mt-1">주제를 선택하면 무한 캔버스에서 생각을 확장할 수 있습니다</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {topics.map(topic => (
          <div key={topic.id} className="group relative">
            <button
              onClick={() => onSelect(topic)}
              className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-indigo-300 hover:shadow-md text-left transition-all"
            >
              <div className="w-3 h-3 rounded-sm bg-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 truncate">{topic.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(topic.updated_at).toLocaleDateString('ko-KR')}</p>
              </div>
              <span className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">▶</span>
            </button>
            <button
              onClick={() => { if (confirm(`"${topic.title}" 주제를 삭제할까요?\n\n⚠ 이 주제에 포함된 모든 노드와 연결선이 함께 삭제되며, 되돌릴 수 없습니다.`)) onDelete(topic.id) }}
              aria-label={`${topic.title} 삭제`}
              className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 md:opacity-0 md:group-hover:opacity-100 transition-all text-sm shadow-sm"
            >
              ×
            </button>
          </div>
        ))}

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

      {topics.length === 0 && !creating && (
        <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">아직 주제가 없습니다. 첫 번째 생각의 씨앗을 심어보세요 <Sprout size={20} /></p>
      )}
    </div>
  )
}
