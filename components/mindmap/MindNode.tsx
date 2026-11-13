'use client'

import { memo, useContext, useEffect, useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Plus, Maximize2, Trash2 } from 'lucide-react'
import { MindCtx } from './MindMapContext'
import { PALETTE, paletteFor } from '@/lib/mindmap-theme'

export type MindNodeData = {
  label: string
  color: string // 가지 색(hex)
  isRoot?: boolean
  editing?: boolean
  hasContent?: boolean
}

const hiddenHandle: React.CSSProperties = {
  opacity: 0,
  width: 1,
  height: 1,
  border: 'none',
  background: 'transparent',
  pointerEvents: 'none',
}

function MindNodeInner({ id, data, selected }: { id: string; data: MindNodeData; selected: boolean }) {
  const ctx = useContext(MindCtx)
  const [val, setVal] = useState(data.label)
  const [hover, setHover] = useState(false)
  const [showColors, setShowColors] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const pal = paletteFor(data.color)
  const isRoot = !!data.isRoot
  const active = selected || hover

  useEffect(() => { setVal(data.label) }, [data.label])
  useEffect(() => {
    if (data.editing) {
      // 다음 틱에 포커스(노드 렌더 직후)
      const t = setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 10)
      return () => clearTimeout(t)
    }
  }, [data.editing])

  function commit() {
    const t = val.trim()
    if (t !== data.label) ctx.onRename(id, t)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    e.stopPropagation() // 캔버스 단축키와 충돌 방지
    if (e.key === 'Enter') { e.preventDefault(); commit(); ctx.onStopEdit(); ctx.onAddSibling(id) }
    else if (e.key === 'Tab') { e.preventDefault(); commit(); ctx.onStopEdit(); ctx.onAddChild(id) }
    else if (e.key === 'Escape') { e.preventDefault(); setVal(data.label); ctx.onStopEdit() }
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setShowColors(false) }}
    >
      <Handle type="target" position={Position.Left} style={hiddenHandle} />
      <Handle type="source" position={Position.Right} style={hiddenHandle} />

      <div
        onDoubleClick={() => ctx.onStartEdit(id)}
        className="flex items-center gap-2 rounded-xl transition-shadow"
        style={{
          width: 200,
          minHeight: 52,
          padding: '10px 12px',
          background: isRoot ? pal.dot : '#ffffff',
          border: `1.5px solid ${selected ? pal.dot : isRoot ? pal.dot : '#e5e7eb'}`,
          borderLeft: isRoot ? undefined : `4px solid ${pal.dot}`,
          boxShadow: selected
            ? `0 0 0 3px ${pal.ring}, 0 4px 12px rgba(0,0,0,0.06)`
            : '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        {data.editing ? (
          <input
            ref={inputRef}
            className="nodrag nopan flex-1 min-w-0 bg-transparent outline-none text-sm font-semibold"
            style={{ color: isRoot ? '#fff' : pal.text }}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => { commit(); ctx.onStopEdit() }}
            onKeyDown={onKeyDown}
            placeholder="생각 입력..."
          />
        ) : (
          <span
            className="flex-1 min-w-0 text-sm font-semibold leading-snug"
            style={{
              color: isRoot ? '#fff' : pal.text,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {data.label || '(빈 생각)'}
          </span>
        )}
        {data.hasContent && !data.editing && (
          <span className="shrink-0 text-[10px] opacity-60" style={{ color: isRoot ? '#fff' : pal.text }}>📝</span>
        )}
      </div>

      {/* 하위 추가 — 오른쪽 가장자리 + 버튼 (항상, 호버 시 강조) */}
      <button
        className="nodrag absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full flex items-center justify-center shadow-sm transition-all"
        style={{
          background: active ? pal.dot : '#ffffff',
          color: active ? '#fff' : '#94a3b8',
          border: `1.5px solid ${active ? pal.dot : '#e5e7eb'}`,
        }}
        title="하위 생각 추가 (Tab)"
        onClick={(e) => { e.stopPropagation(); ctx.onAddChild(id) }}
      >
        <Plus size={14} />
      </button>

      {/* 호버/선택 툴바 */}
      {active && !data.editing && (
        <div
          className="nodrag absolute left-1/2 -translate-x-1/2 -bottom-9 flex items-center gap-0.5 bg-white rounded-lg shadow-md border border-gray-100 px-1 py-0.5 z-10"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button className="w-6 h-6 rounded hover:bg-gray-100 flex items-center justify-center text-gray-500" title="상세(리치 편집)" onClick={(e) => { e.stopPropagation(); ctx.onOpenDetail(id) }}>
            <Maximize2 size={13} />
          </button>
          <div className="relative">
            <button
              className="w-6 h-6 rounded hover:bg-gray-100 flex items-center justify-center"
              title="색상"
              onClick={(e) => { e.stopPropagation(); setShowColors((v) => !v) }}
            >
              <span className="w-3 h-3 rounded-full" style={{ background: pal.dot }} />
            </button>
            {showColors && (
              <div className="absolute top-7 left-1/2 -translate-x-1/2 flex gap-1 bg-white rounded-lg shadow-lg border border-gray-100 p-1.5 z-20">
                {PALETTE.map((p) => (
                  <button
                    key={p.key}
                    className="w-4 h-4 rounded-full border border-white"
                    style={{ background: p.dot, outline: p.dot === data.color ? `2px solid ${p.dot}` : 'none', outlineOffset: 1 }}
                    onClick={(e) => { e.stopPropagation(); ctx.onSetColor(id, p.dot); setShowColors(false) }}
                  />
                ))}
              </div>
            )}
          </div>
          {!isRoot && (
            <button className="w-6 h-6 rounded hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500" title="삭제" onClick={(e) => { e.stopPropagation(); ctx.onDelete(id) }}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export const MindNode = memo(MindNodeInner)
