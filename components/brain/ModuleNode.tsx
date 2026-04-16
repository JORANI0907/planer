'use client'

import { memo, useContext, useState, useRef, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import { BrainCtx } from './BrainContext'

export type ModuleNodeData = {
  label: string
  content: string | null
  isWing?: boolean
  autoFocus?: boolean
}

const TARGET_BASE: React.CSSProperties = {
  width: 8, height: 8,
  background: 'transparent',
  border: 'none',
  opacity: 0,
  zIndex: 1,
}

function ModuleNodeInner({ id, data, selected }: { id: string; data: ModuleNodeData; selected: boolean }) {
  const { onUpdateTitle, onUpdateContent, onContextMenu } = useContext(BrainCtx)
  const [nodeHovered, setNodeHovered] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingContent, setEditingContent] = useState(false)
  const [titleVal, setTitleVal] = useState(data.label)
  const [contentVal, setContentVal] = useState(data.content ?? '')
  const titleRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const isWing = data.isWing ?? false

  useEffect(() => { setTitleVal(data.label) }, [data.label])
  useEffect(() => { setContentVal(data.content ?? '') }, [data.content])

  useEffect(() => {
    if (data.autoFocus) setEditingTitle(true)
  }, [data.autoFocus])

  useEffect(() => {
    if (editingTitle && titleRef.current) {
      titleRef.current.focus()
      titleRef.current.select()
    }
  }, [editingTitle])

  useEffect(() => {
    if (editingContent && contentRef.current) contentRef.current.focus()
  }, [editingContent])

  function saveTitle() {
    setEditingTitle(false)
    const trimmed = titleVal.trim()
    if (trimmed !== data.label) onUpdateTitle(id, trimmed || '(제목 없음)')
  }

  function saveContent() {
    setEditingContent(false)
    if (contentVal !== (data.content ?? '')) onUpdateContent(id, contentVal)
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); saveTitle() }
    if (e.key === 'Escape') { setTitleVal(data.label); setEditingTitle(false) }
  }

  function handleContentKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setContentVal(data.content ?? ''); setEditingContent(false) }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onContextMenu(id, isWing, e.clientX, e.clientY)
  }

  // 연결 시작 + 버튼 (source handle)
  const plusHandleStyle = (pos: 'top' | 'right' | 'bottom' | 'left'): React.CSSProperties => ({
    width: 20, height: 20,
    borderRadius: '50%',
    background: '#6366f1',
    border: '2px solid #ffffff',
    boxShadow: '0 2px 6px rgba(99,102,241,0.45)',
    opacity: (nodeHovered || selected) ? 1 : 0,
    transition: 'opacity 0.15s',
    zIndex: 5,
    cursor: 'crosshair',
    ...(pos === 'top'    && { top: -10 }),
    ...(pos === 'right'  && { right: -10 }),
    ...(pos === 'bottom' && { bottom: -10 }),
    ...(pos === 'left'   && { left: -10 }),
  })

  // 숨겨진 target handle (드롭 감지용)
  const targetStyle = (pos: 'top' | 'right' | 'bottom' | 'left'): React.CSSProperties => ({
    ...TARGET_BASE,
    ...(pos === 'top'    && { top: 0 }),
    ...(pos === 'right'  && { right: 0 }),
    ...(pos === 'bottom' && { bottom: 0 }),
    ...(pos === 'left'   && { left: 0 }),
  })

  // 공통 핸들 (4방향 source 버튼 + 4방향 target 감지점)
  const handles = (
    <>
      <Handle type="target" position={Position.Top}    id="t-top"    style={targetStyle('top')} />
      <Handle type="target" position={Position.Right}  id="t-right"  style={targetStyle('right')} />
      <Handle type="target" position={Position.Bottom} id="t-bottom" style={targetStyle('bottom')} />
      <Handle type="target" position={Position.Left}   id="t-left"   style={targetStyle('left')} />

      <Handle type="source" position={Position.Top}    id="s-top"    style={plusHandleStyle('top')}>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: '16px', pointerEvents: 'none', display: 'block', textAlign: 'center' }}>+</span>
      </Handle>
      <Handle type="source" position={Position.Right}  id="s-right"  style={plusHandleStyle('right')}>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: '16px', pointerEvents: 'none', display: 'block', textAlign: 'center' }}>+</span>
      </Handle>
      <Handle type="source" position={Position.Bottom} id="s-bottom" style={plusHandleStyle('bottom')}>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: '16px', pointerEvents: 'none', display: 'block', textAlign: 'center' }}>+</span>
      </Handle>
      <Handle type="source" position={Position.Left}   id="s-left"   style={plusHandleStyle('left')}>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: '16px', pointerEvents: 'none', display: 'block', textAlign: 'center' }}>+</span>
      </Handle>
    </>
  )

  // ── 날개 모듈 ────────────────────────────────────────────────
  if (isWing) {
    return (
      <div
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setNodeHovered(true)}
        onMouseLeave={() => setNodeHovered(false)}
        className="nodrag-prevent"
        style={{
          position: 'relative',
          width: 80, height: 80,
          borderRadius: '50%',
          backgroundColor: '#f0f9ff',
          border: `2px solid ${selected ? '#6366f1' : '#94a3b8'}`,
          boxShadow: selected ? '0 0 0 3px #c7d2fe' : '0 2px 6px rgba(0,0,0,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'default',
        }}
      >
        {handles}

        {editingTitle ? (
          <input
            ref={titleRef}
            className="nodrag nopan"
            value={titleVal}
            onChange={e => setTitleVal(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={handleTitleKeyDown}
            style={{
              width: '80%', textAlign: 'center',
              fontSize: 11, border: 'none', outline: 'none',
              background: 'transparent', color: '#1e40af', fontWeight: 600,
              zIndex: 2, position: 'relative',
            }}
          />
        ) : (
          <p
            onClick={() => setEditingTitle(true)}
            style={{
              fontSize: 11, fontWeight: 600, color: '#1e40af',
              textAlign: 'center', padding: '0 8px', margin: 0,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
              lineHeight: 1.3, cursor: 'text',
              zIndex: 2, position: 'relative',
            }}
          >
            {data.label || '(내용)'}
          </p>
        )}
      </div>
    )
  }

  // ── 본 모듈 ──────────────────────────────────────────────────
  return (
    <div
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setNodeHovered(true)}
      onMouseLeave={() => setNodeHovered(false)}
      style={{
        position: 'relative',
        width: 150,
        minHeight: 60,
        borderRadius: 10,
        backgroundColor: '#ffffff',
        border: `2px solid ${selected ? '#6366f1' : '#cbd5e1'}`,
        boxShadow: selected ? '0 0 0 3px #c7d2fe' : '0 2px 8px rgba(0,0,0,0.07)',
        display: 'flex',
        flexDirection: 'column',
        padding: '10px 12px',
        gap: 4,
        cursor: 'default',
      }}
    >
      {handles}

      {editingTitle ? (
        <input
          ref={titleRef}
          className="nodrag nopan"
          value={titleVal}
          onChange={e => setTitleVal(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={handleTitleKeyDown}
          style={{
            width: '100%', fontSize: 13, fontWeight: 700,
            color: '#1e293b', border: 'none', outline: 'none',
            background: 'transparent', textAlign: 'center',
            zIndex: 2, position: 'relative',
          }}
        />
      ) : (
        <p
          onClick={() => setEditingTitle(true)}
          style={{
            fontSize: 13, fontWeight: 700, color: '#1e293b',
            textAlign: 'center', margin: 0,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            lineHeight: 1.4, cursor: 'text',
            zIndex: 2, position: 'relative',
          }}
        >
          {data.label || '(제목 없음)'}
        </p>
      )}

      {(selected || editingContent || (data.content && data.content.trim())) && (
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 6, marginTop: 2, zIndex: 2, position: 'relative' }}>
          {editingContent ? (
            <textarea
              ref={contentRef}
              className="nodrag nopan"
              value={contentVal}
              onChange={e => setContentVal(e.target.value)}
              onBlur={saveContent}
              onKeyDown={handleContentKeyDown}
              rows={3}
              placeholder="내용 입력..."
              style={{
                width: '100%', fontSize: 11, color: '#475569',
                border: 'none', outline: 'none', background: 'transparent',
                resize: 'none', lineHeight: 1.5, fontFamily: 'inherit',
              }}
            />
          ) : (
            <p
              onClick={() => setEditingContent(true)}
              style={{
                fontSize: 11, color: '#64748b', margin: 0,
                lineHeight: 1.5, overflow: 'hidden',
                display: '-webkit-box', WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical', cursor: 'text',
                minHeight: 16,
              }}
            >
              {data.content?.trim() || (selected ? '내용 클릭해서 입력...' : '')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export const ModuleNode = memo(ModuleNodeInner)
