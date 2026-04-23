'use client'

import { memo, useContext, useState, useRef, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import { BrainCtx } from './BrainContext'

export type ModuleNodeData = {
  label: string
  content: string | null
  isWing?: boolean
  autoFocus?: boolean
  groupId?: string | null
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
  useEffect(() => { if (data.autoFocus) setEditingTitle(true) }, [data.autoFocus])
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

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    const cx = t.clientX
    const cy = t.clientY
    longPressFired.current = false
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      onContextMenu(id, isWing, cx, cy)
      if (navigator.vibrate) navigator.vibrate(20)
    }, 500)
  }

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const active = nodeHovered || selected

  // + 버튼 외관의 Source Handle. 항상 표시 (호버/선택 시 강조)
  const sourceHandleStyle: React.CSSProperties = {
    width: active ? 22 : 14,
    height: active ? 22 : 14,
    background: active ? '#6366f1' : '#c7d2fe',
    border: `2px solid ${active ? '#ffffff' : '#e0e7ff'}`,
    boxShadow: active ? '0 2px 8px rgba(99,102,241,0.5)' : 'none',
    opacity: 1,
    pointerEvents: 'all',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    cursor: 'crosshair',
  }

  const plusIcon = active ? (
    <span style={{
      color: '#ffffff',
      fontSize: 15,
      fontWeight: 700,
      lineHeight: 1,
      pointerEvents: 'none',
      userSelect: 'none',
    }}>+</span>
  ) : null

  // ConnectionMode.Loose라서 source handle끼리 연결 가능. target handle 제거로 drop 감지 간섭 방지
  const handles = (
    <>
      <Handle type="source" position={Position.Top}    id="s-top"    style={sourceHandleStyle}>{plusIcon}</Handle>
      <Handle type="source" position={Position.Right}  id="s-right"  style={sourceHandleStyle}>{plusIcon}</Handle>
      <Handle type="source" position={Position.Bottom} id="s-bottom" style={sourceHandleStyle}>{plusIcon}</Handle>
      <Handle type="source" position={Position.Left}   id="s-left"   style={sourceHandleStyle}>{plusIcon}</Handle>
    </>
  )

  // ── 날개 모듈 (동그라미) ─────────────────────────────────────
  if (isWing) {
    return (
      <div
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={clearLongPress}
        onTouchEnd={clearLongPress}
        onTouchCancel={clearLongPress}
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
              position: 'relative', zIndex: 2,
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
              position: 'relative', zIndex: 2,
            }}
          >
            {data.label || '(내용)'}
          </p>
        )}
      </div>
    )
  }

  // ── 본 모듈 (사각형) ────────────────────────────────────────
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
            position: 'relative', zIndex: 2,
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
            position: 'relative', zIndex: 2,
          }}
        >
          {data.label || '(제목 없음)'}
        </p>
      )}

      {(selected || editingContent || (data.content && data.content.trim())) && (
        <div style={{
          borderTop: '1px solid #f1f5f9',
          paddingTop: 6, marginTop: 2,
          position: 'relative', zIndex: 2,
        }}>
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
