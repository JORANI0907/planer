'use client'

import { useUndo } from '@/lib/undo-stack'

export function UndoToast() {
  const { stack, undoLatest, dismiss, undoing } = useUndo()
  if (stack.length === 0) return null
  const latest = stack[0]

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-50 w-[calc(100%-2rem)] max-w-sm pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div className="bg-slate-900/95 backdrop-blur text-white rounded-2xl shadow-2xl px-3 py-2 flex items-center gap-2 pointer-events-auto">
        <span className="text-base" aria-hidden>↶</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{latest.label}</p>
          {stack.length > 1 && (
            <p className="text-[10px] text-gray-400 leading-none mt-0.5">
              {stack.length}개 되돌리기 가능 (최근 순)
            </p>
          )}
        </div>
        <button
          onClick={() => undoLatest()}
          disabled={undoing}
          className="text-[11px] font-semibold bg-blue-500 hover:bg-blue-600 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
        >
          {undoing ? '복원 중...' : `되돌리기${stack.length > 1 ? ` (${stack.length})` : ''}`}
        </button>
        <button
          onClick={() => dismiss(latest.id)}
          disabled={undoing}
          className="text-gray-400 hover:text-white text-sm px-1.5"
          title="알림 닫기"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
