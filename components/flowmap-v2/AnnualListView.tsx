'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { PlanItem } from '@/lib/types'
import { createPlanItem } from '@/lib/api'
import { AnnualItemRow } from './AnnualItemRow'

interface AnnualListViewProps {
  year: number
  items: PlanItem[]
  onChanged: () => void
}

export function AnnualListView({ year, items, onChanged }: AnnualListViewProps) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const handleAdd = async () => {
    const title = newTitle.trim()
    if (!title) return
    try {
      await createPlanItem({
        level: 'annual',
        period_key: `${year}`,
        title,
        description: null,
        categories: [],
        status: 'pending',
        priority: 'medium',
        sort_order: items.length,
        parent_plan_item_id: null,
        section_id: null,
      })
      setNewTitle('')
      setAdding(false)
      onChanged()
    } catch {
      // 조용히 실패 처리
    }
  }

  if (items.length === 0 && !adding) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
          gap: 12,
        }}
      >
        <span style={{ fontSize: 32 }}>📋</span>
        <p style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center' }}>
          {year}년 연간 계획이 없습니다.
          <br />아래 버튼으로 추가해보세요.
        </p>
        <button
          onClick={() => setAdding(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 8,
            border: '1.5px dashed #93c5fd',
            backgroundColor: '#eff6ff',
            color: '#1d4ed8',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Plus size={15} />
          연간 목표 추가
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 연간 아이템 목록 */}
      {items.map(item => (
        <AnnualItemRow
          key={item.id}
          item={item}
          year={year}
          onChanged={onChanged}
        />
      ))}

      {/* 추가 폼 */}
      {adding ? (
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: '10px 14px',
            border: '1.5px solid #93c5fd',
            borderRadius: 10,
            backgroundColor: '#eff6ff',
          }}
        >
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd()
              if (e.key === 'Escape') { setAdding(false); setNewTitle('') }
            }}
            placeholder="연간 목표 제목 입력 후 Enter"
            style={{
              flex: 1,
              fontSize: 13,
              padding: '6px 10px',
              border: '1px solid #93c5fd',
              borderRadius: 7,
              outline: 'none',
              color: '#111827',
              backgroundColor: '#fff',
            }}
          />
          <button
            onClick={handleAdd}
            style={{
              padding: '6px 12px',
              borderRadius: 7,
              border: 'none',
              backgroundColor: '#3b82f6',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            추가
          </button>
          <button
            onClick={() => { setAdding(false); setNewTitle('') }}
            style={{
              padding: '6px 12px',
              borderRadius: 7,
              border: '1px solid #e5e7eb',
              backgroundColor: '#fff',
              fontSize: 12,
              cursor: 'pointer',
              color: '#6b7280',
            }}
          >
            취소
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 14px',
            border: '1.5px dashed #d1d5db',
            borderRadius: 10,
            backgroundColor: 'transparent',
            color: '#9ca3af',
            fontSize: 13,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#93c5fd'
            e.currentTarget.style.color = '#3b82f6'
            e.currentTarget.style.backgroundColor = '#f0f9ff'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#d1d5db'
            e.currentTarget.style.color = '#9ca3af'
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <Plus size={14} />
          연간 목표 추가
        </button>
      )}
    </div>
  )
}
