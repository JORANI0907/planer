'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

const TAB_OPTIONS = [
  { path: '/', label: '🏠 대시보드' },
  { path: '/profile', label: '👤 인적사항' },
  { path: '/decade', label: '🚀 10년 계획' },
  { path: '/flowmap', label: '🗺️ 플로우맵' },
  { path: '/brain', label: '🧠 생각 확장 맵' },
  { path: '/plan', label: '📅 주간계획' },
  { path: '/daily', label: '✅ 일일계획' },
  { path: '/shopping', label: '🛒 구입 관리' },
]

function withEmbed(path: string): string {
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}embed=1`
}

function SplitInner() {
  const params = useSearchParams()
  const router = useRouter()
  const initialLeft = params.get('left') || '/flowmap'
  const initialRight = params.get('right') || '/brain'
  const [left, setLeft] = useState(initialLeft)
  const [right, setRight] = useState(initialRight)
  const [ratio, setRatio] = useState(0.5)
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const leftIframeRef = useRef<HTMLIFrameElement>(null)
  const rightIframeRef = useRef<HTMLIFrameElement>(null)

  // URL sync (shallow — keeps selection on refresh/share)
  useEffect(() => {
    const sp = new URLSearchParams()
    sp.set('left', left)
    sp.set('right', right)
    router.replace(`/split?${sp.toString()}`, { scroll: false })
  }, [left, right, router])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const r = Math.max(0.15, Math.min(0.85, x / rect.width))
    setRatio(r)
  }, [])

  const handlePointerUp = useCallback(() => {
    setDragging(false)
  }, [])

  useEffect(() => {
    if (!dragging) return
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [dragging, handlePointerMove, handlePointerUp])

  const reload = (side: 'left' | 'right') => {
    const ref = side === 'left' ? leftIframeRef : rightIframeRef
    const path = side === 'left' ? left : right
    if (ref.current) ref.current.src = withEmbed(path)
  }

  const swap = () => {
    setLeft(right)
    setRight(left)
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col md:flex-row h-[calc(100vh-0px)] md:h-screen bg-gray-100 pb-14 md:pb-0"
      style={{ touchAction: dragging ? 'none' : 'auto' }}
    >
      {/* 왼쪽 패널 */}
      <div
        className="flex flex-col bg-white border-b md:border-b-0 md:border-r border-gray-200 min-h-[40vh] md:min-h-0"
        style={{ flex: `1 1 ${ratio * 100}%` }}
      >
        <PanelHeader
          value={left}
          onChange={setLeft}
          onReload={() => reload('left')}
          onSwap={swap}
          swapLabel="⇆"
        />
        <iframe
          ref={leftIframeRef}
          src={withEmbed(left)}
          className="flex-1 w-full border-0 bg-gray-50"
          title="left-panel"
        />
      </div>

      {/* 드래그 구분선 (데스크톱만) */}
      <div
        onPointerDown={(e) => { e.preventDefault(); setDragging(true) }}
        className="hidden md:flex w-1.5 cursor-col-resize bg-gray-200 hover:bg-blue-400 active:bg-blue-500 items-center justify-center group transition-colors"
        title="드래그하여 크기 조정"
      >
        <div className="w-0.5 h-8 bg-gray-400 group-hover:bg-white rounded-full" />
      </div>

      {/* 오른쪽 패널 */}
      <div
        className="flex flex-col bg-white min-h-[40vh] md:min-h-0"
        style={{ flex: `1 1 ${(1 - ratio) * 100}%` }}
      >
        <PanelHeader
          value={right}
          onChange={setRight}
          onReload={() => reload('right')}
        />
        <iframe
          ref={rightIframeRef}
          src={withEmbed(right)}
          className="flex-1 w-full border-0 bg-gray-50"
          title="right-panel"
        />
      </div>
    </div>
  )
}

function PanelHeader({
  value,
  onChange,
  onReload,
  onSwap,
  swapLabel,
}: {
  value: string
  onChange: (v: string) => void
  onReload: () => void
  onSwap?: () => void
  swapLabel?: string
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 text-xs md:text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
      >
        {TAB_OPTIONS.map((opt) => (
          <option key={opt.path} value={opt.path}>{opt.label}</option>
        ))}
      </select>
      <button
        onClick={onReload}
        title="새로고침"
        className="text-xs px-2 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex-shrink-0"
      >
        ↻
      </button>
      {onSwap && (
        <button
          onClick={onSwap}
          title="좌우 교체"
          className="text-xs px-2 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex-shrink-0"
        >
          {swapLabel || '⇆'}
        </button>
      )}
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        title="새 창에서 열기"
        className="text-xs px-2 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex-shrink-0"
      >
        ↗
      </a>
    </div>
  )
}

export default function SplitPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">로딩 중...</div>}>
      <SplitInner />
    </Suspense>
  )
}
