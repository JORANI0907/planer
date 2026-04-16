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

// 투명 핸들: 연결 드래그용, 호버 시 표시
const HANDLE_BASE: React.CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: '50%',
  border: '2px solid #94a3b8',
  background: '#ffffff',
  opacity: 0,
  transition: 'opacity 0.15s',
  zIndex: 10,
}

function ModuleNodeInner({ id, data, selected }: { id: string; data: ModuleNodeData; selected: boolean }) {
  const { onUpdateTitle, onUpdateContent, onContextMenu } = useContext(BrainCtx)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingContent, setEditingContent] = useState(false)
  const [titleVal, setTitleVal] = useState(data.label)
  const [contentVal, setContentVal] = useState(data.content ?? '')
  const titleRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const isWing = data.isWing ?? false

  // 외부에서 label 변경 시 동기화
  useEffect(() => { setTitleVal(data.label) }, [data.label])
  useEffect(() => { setContentVal(data.content ?? '') }, [data.content])

  // autoFocus: 새로 생성된 노드는 즉시 편집 모드
  useEffect(() => {
    if (data.autoFocus) {
      setEditingTitle(true)
    }
  }, [data.autoFocus])

  useEffect(() => {
    if (editingTitle && titleRef.current) {
      titleRef.current.focus()
      titleRef.current.select()
    }
  }, [editingTitle])

  useEffect(() => {
    if (editingContent && contentRef.current) {
      contentRef.current.focus()
    }
  }, [editingContent])

  function saveTitle() {
    setEditingTitle(false)
    const trimmed = titleVal.trim()
    if (trimmed !== data.label) {
      onUpdateTitle(id, trimmed || '(제목 없음)')
    }
  }

  function saveContent() {
    setEditingContent(false)
    if (contentVal !== (data.content ?? '')) {
      onUpdateContent(id, contentVal)
    }
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

  const handleStyle = (pos: Position): React.CSSProperties => ({
    ...HANDLE_BASE,
    ...(pos === Position.Top    && { top: -7 }),
    ...(pos === Position.Right  && { right: -7 }),
    ...(pos === Position.Bottom && { bottom: -7 }),
    ...(pos === Position.Left   && { left: -7 }),
  })

  // ── 날개 모듈: 동그라미 ──────────────────────────────────────
  if (isWing) {
    return (
      <>
        <Handle type="source" position={Position.Top}    id="top"    style={handleStyle(Position.Top)} />
        <Handle type="source" position={Position.Right}  id="right"  style={handleStyle(Position.Right)} />
        <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle(Position.Bottom)} />
        <Handle type="source" position={Position.Left}   id="left"   style={handleStyle(Position.Left)} />
        <Handle type="target" position={Position.Top}    id="top-t"    style={{ ...handleStyle(Position.Top), opacity: 0 }} />
        <Handle type="target" position={Position.Right}  id="right-t"  style={{ ...handleStyle(Position.Right), opacity: 0 }} />
        <Handle type="target" position={Position.Bottom} id="bottom-t" style={{ ...handleStyle(Position.Bottom), opacity: 0 }} />
        <Handle type="target" position={Position.Left}   id="left-t"   style={{ ...handleStyle(Position.Left), opacity: 0 }} />

        <div
          onContextMenu={handleContextMenu}
          className="nodrag-prevent"
          style={{
            width: 80,
            height: 80,
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
          {editingTitle ? (
            <input
              ref={titleRef}
              className="nodrag nopan"
              value={titleVal}
              onChange={e => setTitleVal(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={handleTitleKeyDown}
              style={{
                width: '80%',
                textAlign: 'center',
                fontSize: 11,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: '#1e40af',
                fontWeight: 600,
              }}
            />
          ) : (
            <p
              onClick={() => setEditingTitle(true)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#1e40af',
                textAlign: 'center',
                padding: '0 8px',
                margin: 0,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.3,
                cursor: 'text',
              }}
            >
              {data.label || '(내용)'}
            </p>
          )}
        </div>
      </>
    )
  }

  // ── 본 모듈: 네모 ────────────────────────────────────────────
  return (
    <>
      <Handle type="source" position={Position.Top}    id="top"    style={handleStyle(Position.Top)} />
      <Handle type="source" position={Position.Right}  id="right"  style={handleStyle(Position.Right)} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle(Position.Bottom)} />
      <Handle type="source" position={Position.Left}   id="left"   style={handleStyle(Position.Left)} />
      <Handle type="target" position={Position.Top}    id="top-t"    style={{ ...handleStyle(Position.Top), opacity: 0 }} />
      <Handle type="target" position={Position.Right}  id="right-t"  style={{ ...handleStyle(Position.Right), opacity: 0 }} />
      <Handle type="target" position={Position.Bottom} id="bottom-t" style={{ ...handleStyle(Position.Bottom), opacity: 0 }} />
      <Handle type="target" position={Position.Left}   id="left-t"   style={{ ...handleStyle(Position.Left), opacity: 0 }} />

      <div
        onContextMenu={handleContextMenu}
        style={{
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
        {/* 제목 */}
        {editingTitle ? (
          <input
            ref={titleRef}
            className="nodrag nopan"
            value={titleVal}
            onChange={e => setTitleVal(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={handleTitleKeyDown}
            style={{
              width: '100%',
              fontSize: 13,
              fontWeight: 700,
              color: '#1e293b',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              textAlign: 'center',
            }}
          />
        ) : (
          <p
            onClick={() => setEditingTitle(true)}
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#1e293b',
              textAlign: 'center',
              margin: 0,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.4,
              cursor: 'text',
            }}
          >
            {data.label || '(제목 없음)'}
          </p>
        )}

        {/* 내용 — 선택 시 표시 */}
        {(selected || editingContent || (data.content && data.content.trim())) && (
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 6, marginTop: 2 }}>
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
                  width: '100%',
                  fontSize: 11,
                  color: '#475569',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  resize: 'none',
                  lineHeight: 1.5,
                  fontFamily: 'inherit',
                }}
              />
            ) : (
              <p
                onClick={() => setEditingContent(true)}
                style={{
                  fontSize: 11,
                  color: '#64748b',
                  margin: 0,
                  lineHeight: 1.5,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  cursor: 'text',
                  minHeight: 16,
                }}
              >
                {data.content?.trim() || (selected ? '내용 클릭해서 입력...' : '')}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export const ModuleNode = memo(ModuleNodeInner)
