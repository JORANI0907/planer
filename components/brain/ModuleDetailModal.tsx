'use client'

import { useEffect, useRef, useState } from 'react'
import { RichTextEditor } from '@/components/ui/RichTextEditor'

/**
 * 생각확장 노드 상세 편집 모달.
 * 좁은 캔버스 노드 대신 넓은 모달에서 제목 + 리치텍스트(본문)를 편집한다.
 * 본문은 입력 멈춤 후 자동 저장(디바운스), 제목은 blur/Enter 시 저장.
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header: 제목 입력 + 저장 상태 */}
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
              onClick={close}
              className="text-gray-400 hover:text-gray-700 text-xl leading-none p-1"
            >
              ✕
            </button>
          </div>
        </div>

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
