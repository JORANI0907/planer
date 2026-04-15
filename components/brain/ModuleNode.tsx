'use client'

import { memo, useContext } from 'react'
import { Handle, Position, NodeToolbar } from '@xyflow/react'
import { NODE_TYPE_CONFIG } from '@/lib/brain-types'
import type { ThoughtNodeType } from '@/lib/brain-types'
import { BrainCtx } from './BrainContext'

export type ModuleNodeData = {
  label: string
  nodeType: ThoughtNodeType
  content: string | null
  tags: string[]
  isWing?: boolean
}

const HANDLE_STYLE = { width: 10, height: 10, borderRadius: '50%', border: '2px solid #94a3b8', background: '#fff' }

function ModuleNodeInner({ id, data, selected }: { id: string; data: ModuleNodeData; selected: boolean }) {
  const { onAddWing, onDelete } = useContext(BrainCtx)
  const cfg = NODE_TYPE_CONFIG[data.nodeType]
  const isWing = data.isWing

  return (
    <>
      <NodeToolbar isVisible={selected} position={Position.Top} className="flex gap-1">
        {!isWing && (
          <button
            onClick={() => onAddWing(id)}
            className="px-2 py-1 text-xs bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-indigo-50 hover:border-indigo-300 text-gray-600 hover:text-indigo-600 transition-colors"
          >
            + 날개
          </button>
        )}
        <button
          onClick={() => onDelete(id)}
          className="px-2 py-1 text-xs bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-red-50 hover:border-red-300 text-gray-500 hover:text-red-500 transition-colors"
        >
          삭제
        </button>
      </NodeToolbar>

      {/* Handles — 4방향 */}
      <Handle type="source" position={Position.Top}    id="top"    style={{ ...HANDLE_STYLE, top: -6 }} />
      <Handle type="source" position={Position.Right}  id="right"  style={{ ...HANDLE_STYLE, right: -6 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ ...HANDLE_STYLE, bottom: -6 }} />
      <Handle type="source" position={Position.Left}   id="left"   style={{ ...HANDLE_STYLE, left: -6 }} />
      <Handle type="target" position={Position.Top}    id="top-t"    style={{ ...HANDLE_STYLE, top: -6, opacity: 0 }} />
      <Handle type="target" position={Position.Right}  id="right-t"  style={{ ...HANDLE_STYLE, right: -6, opacity: 0 }} />
      <Handle type="target" position={Position.Bottom} id="bottom-t" style={{ ...HANDLE_STYLE, bottom: -6, opacity: 0 }} />
      <Handle type="target" position={Position.Left}   id="left-t"   style={{ ...HANDLE_STYLE, left: -6, opacity: 0 }} />

      {/* Node body */}
      <div
        className="flex flex-col items-center justify-center rounded-2xl transition-all"
        style={{
          width: isWing ? 80 : 100,
          height: isWing ? 80 : 100,
          backgroundColor: cfg.bg,
          border: `2px solid ${selected ? '#6366f1' : cfg.color}`,
          boxShadow: selected ? '0 0 0 3px #c7d2fe' : '0 2px 8px rgba(0,0,0,0.08)',
          opacity: isWing ? 0.9 : 1,
        }}
      >
        <span style={{ fontSize: isWing ? 18 : 22 }}>{cfg.icon}</span>
        <p
          className="font-medium text-center leading-tight px-1.5 mt-1"
          style={{
            color: cfg.color,
            fontSize: isWing ? 10 : 11,
            maxWidth: '100%',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {data.label || '(제목 없음)'}
        </p>
      </div>
    </>
  )
}

export const ModuleNode = memo(ModuleNodeInner)
