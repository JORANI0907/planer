'use client'

import { useEffect, useRef, useState } from 'react'
import { Target } from 'lucide-react'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { getLifeGoals } from '@/lib/api'
import { createStrategyNode } from '@/lib/strategy-api'
import type { LifeGoal } from '@/lib/types'

/**
 * 생각확장 노드 상세 편집 모달.
 * 좁은 캔버스 노드 대신 넓은 모달에서 제목 + 리치텍스트(본문)를 편집한다.
 * 본문은 입력 멈춤 후 자동 저장(디바운스), 제목은 blur/Enter 시 저장.
 * 또한 이 아이디어를 '세부전략'(10년 목표의 전략)으로 승격할 수 있다.
 */
export function ModuleDetailModal({
  title,
  content,
  onClose,
  onSaveTitle,
  onSaveContent,
}: {
  title: string
  content: string
  onClose: () => void
  onSaveTitle: (title: string) => void
  onSaveContent: (html: string) => void
}) {
  const [titleVal, setTitleVal] = useState(title)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 세부전략 승격
  const [promoting, setPromoting] = useState(false)
  const [goals, setGoals] = useState<LifeGoal[]>([])
  const [goalId, setGoalId] = useState('')
  const [promoteMsg, setPromoteMsg] = useState<string | null>(null)
  const [promoteBusy, setPromoteBusy] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  useEffect(() => {
    if (!promoting || goals.length > 0) return
    getLifeGoals()
      .then((g) => { setGoals(g); if (g[0]) setGoalId((prev) => prev || g[0].id) })
      .catch(() => {})
  }, [promoting, goals.length])

  function commitTitle() {
    const t = titleVal.trim() || '(제목 없음)'
    if (t !== title) onSaveTitle(t)
  }

  function close() {
    commitTitle()
    onClose()
  }

  function handleContentChange(html: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setStatus('saving')
    saveTimer.current = setTimeout(() => {
      onSaveContent(html)
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 1500)
    }, 700)
  }

  async function promote() {
    if (!goalId) return
    setPromoteBusy(true)
    try {
      await createStrategyNode({
        life_goal_id: goalId,
        kind: 'strategy',
        title: titleVal.trim() || '(전략)',
        description: content || null,
      })
      const goalTitle = goals.find((g) => g.id === goalId)?.title ?? ''
      setPromoteMsg(`✓ "${goalTitle}"의 세부전략으로 추가했습니다.`)
      setPromoting(false)
    } catch (e) {
      alert('승격 실패: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setPromoteBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header: 제목 입력 + 승격 + 저장 상태 */}
        <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-3 border-b border-gray-100">
          <input
            value={titleVal}
            onChange={(e) => setTitleVal(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitTitle() } }}
            placeholder="제목"
            className="flex-1 min-w-0 text-xl font-bold text-gray-900 outline-none bg-transparent"
          />
          <div className="flex items-center gap-2 shrink-0">
            {status === 'saving' && <span className="text-xs text-gray-400">저장 중...</span>}
            {status === 'saved' && <span className="text-xs text-green-500">저장됨 ✓</span>}
            <button
              type="button"
              onClick={() => { setPromoteMsg(null); setPromoting((v) => !v) }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg"
              title="이 아이디어를 세부전략으로 올리기"
            >
              <Target size={14} /> 전략으로 승격
            </button>
            <button type="button" onClick={close} className="text-gray-400 hover:text-gray-700 text-xl leading-none p-1">✕</button>
          </div>
        </div>

        {/* 승격 패널 */}
        {promoting && (
          <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-amber-100 bg-amber-50/60">
            <span className="text-xs font-semibold text-amber-800">어느 10년 목표의 전략으로?</span>
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="border border-amber-200 rounded-md px-2 py-1 text-xs bg-white max-w-[260px]"
            >
              {goals.length === 0 && <option value="">목표 불러오는 중...</option>}
              {goals.map((g) => (
                <option key={g.id} value={g.id}>[{g.age_group}] {g.title}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={promote}
              disabled={!goalId || promoteBusy}
              className="text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 px-3 py-1 rounded-md"
            >
              승격
            </button>
            <button type="button" onClick={() => setPromoting(false)} className="text-xs text-gray-500 px-2">취소</button>
          </div>
        )}
        {promoteMsg && (
          <div className="px-6 py-2 text-xs text-green-700 bg-green-50 border-b border-green-100">{promoteMsg}</div>
        )}

        {/* Body: 리치텍스트 에디터 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <RichTextEditor
            value={content}
            onChange={handleContentChange}
            placeholder="생각을 자유롭게 작성하세요..."
          />
        </div>
      </div>
    </div>
  )
}
