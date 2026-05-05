'use client'

import { useState, useEffect } from 'react'
import { Brain } from 'lucide-react'
import type { ThoughtNode } from '@/lib/brain-types'
import { getTopics, createTopic, deleteTopic } from '@/lib/brain-api'
import { RootSelector } from '@/components/brain/RootSelector'
import dynamic from 'next/dynamic'

const BrainCanvas = dynamic(
  () => import('@/components/brain/BrainCanvas').then(m => m.BrainCanvas),
  { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">캔버스 로딩 중...</div> }
)

export default function BrainPage() {
  const [topics, setTopics] = useState<ThoughtNode[]>([])
  const [activeTopic, setActiveTopic] = useState<ThoughtNode | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTopics().then(t => { setTopics(t); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  async function handleCreateTopic(title: string) {
    const topic = await createTopic(title)
    setTopics(prev => [...prev, topic])
    setActiveTopic(topic)
  }

  async function handleDeleteTopic(id: string) {
    await deleteTopic(id)
    setTopics(prev => prev.filter(t => t.id !== id))
    if (activeTopic?.id === id) setActiveTopic(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-gray-400 text-sm">로딩 중...</div>
    </div>
  )

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)] -mt-4 -mx-4 md:-mt-8 md:-mx-8 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 md:px-6 py-3 bg-white border-b border-gray-200 shrink-0 min-w-0">
        <Brain size={20} className="shrink-0" />
        <h1 className="font-bold text-gray-900 shrink-0">생각 확장 맵</h1>
        {activeTopic && (
          <>
            <span className="text-gray-300 shrink-0">/</span>
            <span className="text-sm font-medium text-indigo-600 truncate min-w-0 flex-1">{activeTopic.title}</span>
            <button
              onClick={() => setActiveTopic(null)}
              className="ml-2 px-2 md:px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 shrink-0"
            >
              ← <span className="hidden md:inline">주제 </span>목록
            </button>
          </>
        )}
      </div>

      {/* 본문 */}
      <div className="flex-1 min-h-0 bg-gray-50">
        {activeTopic ? (
          <BrainCanvas topicId={activeTopic.id} topicTitle={activeTopic.title} />
        ) : (
          <div className="h-full overflow-y-auto p-6">
            <RootSelector
              topics={topics}
              onSelect={setActiveTopic}
              onCreate={handleCreateTopic}
              onDelete={handleDeleteTopic}
            />
          </div>
        )}
      </div>
    </div>
  )
}
