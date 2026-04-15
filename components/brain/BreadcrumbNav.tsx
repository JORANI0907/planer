'use client'

import type { ThoughtNode } from '@/lib/brain-types'
import { NODE_TYPE_CONFIG } from '@/lib/brain-types'

interface Props {
  stack: ThoughtNode[] // [root, depth1, depth2, ...]
  onNavigate: (index: number) => void
}

export function BreadcrumbNav({ stack, onNavigate }: Props) {
  if (stack.length === 0) return null

  return (
    <div className="flex items-center gap-1 flex-wrap text-sm min-h-[28px]">
      <button
        onClick={() => onNavigate(-1)}
        className="text-gray-400 hover:text-indigo-600 transition-colors font-medium px-1"
      >
        🧠 뇌
      </button>
      {stack.map((node, i) => {
        const cfg = NODE_TYPE_CONFIG[node.type]
        const isLast = i === stack.length - 1
        return (
          <span key={node.id} className="flex items-center gap-1">
            <span className="text-gray-300">/</span>
            <button
              onClick={() => onNavigate(i)}
              className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                isLast
                  ? 'text-indigo-700 bg-indigo-50'
                  : 'text-gray-500 hover:text-indigo-600'
              }`}
            >
              {cfg.icon} {node.title || '(제목 없음)'}
            </button>
          </span>
        )
      })}
    </div>
  )
}
