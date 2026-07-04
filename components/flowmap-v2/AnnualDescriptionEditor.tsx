'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Pencil, Plus } from 'lucide-react'
import type { PlanItem } from '@/lib/types'
import { updatePlanItem } from '@/lib/api'

interface AnnualDescriptionEditorProps {
  item: PlanItem
  onChanged?: () => void
}

export function AnnualDescriptionEditor({
  item,
  onChanged,
}: AnnualDescriptionEditorProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(item.description ?? '')
  const [saving, setSaving] = useState(false)
  const [hovered, setHovered] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // 외부에서 description이 바뀌면 로컬 상태 동기화 (편집 중이 아닐 때만)
  useEffect(() => {
    if (!editing) setValue(item.description ?? '')
  }, [item.description, editing])

  // textarea 자동 높이
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 400) + 'px'
  }, [])

  useEffect(() => {
    if (editing) resizeTextarea()
  }, [editing, value, resizeTextarea])

  const startEdit = () => {
    setValue(item.description ?? '')
    setEditing(true)
    // 다음 프레임에 포커스 + 커서 끝
    setTimeout(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.selectionStart = el.selectionEnd = el.value.length
    }, 0)
  }

  const cancelEdit = () => {
    setValue(item.description ?? '')
    setEditing(false)
  }

  const saveEdit = async () => {
    const trimmed = value.trim()
    const nextValue = trimmed.length > 0 ? value : null // 빈 문자열은 null로 저장
    if (nextValue === (item.description ?? null)) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await updatePlanItem(item.id, { description: nextValue })
      onChanged?.()
      setEditing(false)
    } catch {
      // 조용히 실패 (편집 상태 유지)
    } finally {
      setSaving(false)
    }
  }

  // ─── 편집 모드 ─────────────────────────────
  if (editing) {
    return (
      <div style={{ marginBottom: 10 }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            // Escape: 취소, Ctrl/⌘+Enter: 저장, Enter 단독: 줄바꿈(기본 동작 유지)
            if (e.key === 'Escape') {
              e.preventDefault()
              cancelEdit()
            } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              saveEdit()
            }
          }}
          placeholder="세부 내용 입력 (Enter로 줄바꿈, Ctrl+Enter로 저장, Esc로 취소)"
          disabled={saving}
          style={{
            width: '100%',
            fontSize: 12.5,
            padding: '8px 10px',
            border: '1.5px solid #a78bfa',
            borderRadius: 8,
            outline: 'none',
            color: '#111827',
            backgroundColor: '#fff',
            resize: 'none',
            lineHeight: 1.5,
            fontFamily: 'inherit',
            minHeight: 60,
            boxShadow: '0 0 0 3px rgba(167,139,250,0.15)',
            transition: 'box-shadow 0.15s',
          }}
        />
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6 }}>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={saving}
            style={{
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
              backgroundColor: '#fff',
              color: '#6b7280',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={saveEdit}
            disabled={saving}
            style={{
              fontSize: 11,
              padding: '4px 12px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: '#7c3aed',
              color: '#fff',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    )
  }

  // ─── 조회 모드 (내용 없음): 추가 힌트 ─────
  if (!item.description) {
    return (
      <button
        type="button"
        onClick={startEdit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11,
          color: '#9ca3af',
          padding: '4px 8px',
          borderRadius: 6,
          border: '1px dashed #d1d5db',
          background: 'transparent',
          cursor: 'pointer',
          marginBottom: 10,
          transition: 'all 0.12s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = '#a78bfa'
          e.currentTarget.style.color = '#7c3aed'
          e.currentTarget.style.backgroundColor = '#faf5ff'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = '#d1d5db'
          e.currentTarget.style.color = '#9ca3af'
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        <Plus size={11} />
        세부 내용 추가
      </button>
    )
  }

  // ─── 조회 모드 (내용 있음): 클릭 시 편집 ──
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={startEdit}
      title="클릭하여 수정"
      style={{
        position: 'relative',
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 10,
        padding: '6px 28px 6px 10px',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',   // 줄바꿈 유지
        wordBreak: 'break-word',
        borderRadius: 6,
        border: hovered ? '1px solid #e5e7eb' : '1px solid transparent',
        backgroundColor: hovered ? '#f9fafb' : 'transparent',
        cursor: 'text',
        transition: 'all 0.12s',
      }}
    >
      {item.description}
      <Pencil
        size={11}
        color="#9ca3af"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.12s',
        }}
      />
    </div>
  )
}
