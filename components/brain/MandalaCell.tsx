'use client'

import { useState } from 'react'
import type { ThoughtNode } from '@/lib/brain-types'
import { NODE_TYPE_CONFIG } from '@/lib/brain-types'

interface Props {
  node: ThoughtNode | null
  position: number
  isCenter: boolean
  hasChildren: boolean
  isSelected: boolean
  onClick: () => void
  onDrillDown: () => void
  onAddNode: (position: number) => void
}

export function MandalaCell({ node, position, isCenter, hasChildren, isSelected, onClick, onDrillDown, onAddNode }: Props) {
  const [hovered, setHovered] = useState(false)

  if (!node) {
    if (isCenter) return (
      <div className="aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center" />
    )
    return (
      <button
        onClick={() => onAddNode(position)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 flex items-center justify-center transition-all group"
      >
        <span className={`text-xl transition-opacity ${hovered ? 'opacity-100' : 'opacity-30'}`}>+</span>
      </button>
    )
  }

  const cfg = NODE_TYPE_CONFIG[node.type]

  return (
    <div
      className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center p-2 cursor-pointer transition-all relative
        ${isCenter
          ? 'border-gray-800 bg-gray-900 text-white shadow-lg scale-105'
          : isSelected
            ? 'border-indigo-500 shadow-md scale-[1.02]'
            : 'border-gray-200 hover:border-indigo-300 hover:shadow-sm'
        }`}
      style={!isCenter ? { backgroundColor: cfg.bg, borderColor: isSelected ? '#6366f1' : undefined } : undefined}
      onClick={onClick}
      onDoubleClick={onDrillDown}
    >
      <span className="text-base md:text-lg leading-none mb-1">{cfg.icon}</span>
      <p className={`text-center font-medium leading-tight line-clamp-3 w-full
        ${isCenter ? 'text-white text-xs md:text-sm' : 'text-xs md:text-sm'}`}
        style={{ color: isCenter ? undefined : cfg.color }}
      >
        {node.title || '(제목 없음)'}
      </p>
      {hasChildren && !isCenter && (
        <button
          className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-indigo-500 text-white text-[9px] flex items-center justify-center opacity-70 hover:opacity-100"
          onClick={e => { e.stopPropagation(); onDrillDown() }}
          title="확장 보기"
        >
          ▶
        </button>
      )}
    </div>
  )
}
