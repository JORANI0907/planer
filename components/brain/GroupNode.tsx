'use client'

import { memo, useContext, useState, useRef, useEffect } from 'react'
import { Handle, Position, NodeResizeControl } from '@xyflow/react'
import { BrainCtx } from './BrainContext'

export type GroupNodeData = {
  label: string
  isGroup: true
}

function GroupNodeInner({ id, data, selected }: { id: string; data: GroupNodeData; selected: boolean }) {
  const { onUpdateTitle, onContextMenu, onGroupResize } = useContext(BrainCtx)
  const [editing, setEditing] = useState(false)
  const [titleVal, setTitleVal] = useState(data.label)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setTitleVal(data.label) }, [data.label])
  useEffect(() => {
    if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select() }
  }, [editing])

  function saveTitle() {
    setEditing(false)
    const trimmed = titleVal.trim()
    if (trimmed !== data.label) onUpdateTitle(id, trimmed || '그룹')
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu(id, false, e.clientX, e.clientY, { isGroup: true })
  }

  const handleStyle: React.CSSProperties = {
    width: selected ? 18 : 12,
    height: selected ? 18 : 12,
    background: selected ? '#818cf8' : '#e0e7ff',
    border: '2px solid white',
    borderRadius: '50%',
    zIndex: 5,
    transition: 'all 0.15s',
    cursor: 'crosshair',
  }

  return (
    <div
      onContextMenu={handleContextMenu}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 16,
        background: selected
          ? 'rgba(99,102,241,0.07)'
          : 'rgba(241,245,249,0.6)',
        border: `2px dashed ${selected ? '#818cf8' : '#cbd5e1'}`,
        boxSizing: 'border-box',
        position: 'relative',
        backdropFilter: 'blur(2px)',
      }}
    >
      <NodeResizeControl
        minWidth={200}
        minHeight={140}
        style={{ background: 'transparent', border: 'none' }}
        onResizeEnd={(_, params) => onGroupResize(id, params.width, params.height)}
      />

      {/* 그룹 제목 태그 */}
      <div
        style={{
          position: 'absolute',
          top: -15,
          left: 14,
          zIndex: 10,
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
            className="nodrag nopan"
            value={titleVal}
            onChange={e => setTitleVal(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') saveTitle()
              if (e.key === 'Escape') { setTitleVal(data.label); setEditing(false) }
            }}
            style={{
              fontSize: 11, fontWeight: 700,
              color: '#4f46e5',
              border: '1.5px solid #818cf8',
              borderRadius: 6,
              padding: '2px 8px',
              outline: 'none',
              background: '#fff',
              minWidth: 60,
            }}
          />
        ) : (
          <div
            onClick={() => setEditing(true)}
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: selected ? '#4f46e5' : '#94a3b8',
              background: '#ffffff',
              border: `1.5px solid ${selected ? '#c7d2fe' : '#e2e8f0'}`,
              borderRadius: 6,
              padding: '2px 10px',
              cursor: 'text',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            {data.label || '그룹'}
          </div>
        )}
      </div>

      {/* 연결 핸들 */}
      <Handle type="source" position={Position.Top}    id="g-top"    style={handleStyle} />
      <Handle type="source" position={Position.Right}  id="g-right"  style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="g-bottom" style={handleStyle} />
      <Handle type="source" position={Position.Left}   id="g-left"   style={handleStyle} />
    </div>
  )
}

export const GroupNode = memo(GroupNodeInner)
