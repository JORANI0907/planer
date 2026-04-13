'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CategoryFilter } from '@/components/category-badge'
import { CATEGORIES, type PlanLevel, type PlanStatus, type PlanPriority } from '@/lib/types'

interface PlanItemFormData {
  title: string
  description: string
  categories: string[]
  status: PlanStatus
  priority: PlanPriority
}

interface PlanItemFormProps {
  initialData?: Partial<PlanItemFormData>
  onSubmit: (data: PlanItemFormData) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

const defaultData: PlanItemFormData = {
  title: '',
  description: '',
  categories: [],
  status: 'pending',
  priority: 'medium',
}

export function PlanItemForm({ initialData, onSubmit, onCancel, submitLabel = '저장' }: PlanItemFormProps) {
  const [form, setForm] = useState<PlanItemFormData>({
    ...defaultData,
    ...initialData,
  })
  const [loading, setLoading] = useState(false)

  const update = <K extends keyof PlanItemFormData>(key: K, value: PlanItemFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setLoading(true)
    try {
      await onSubmit(form)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
        <input
          type="text"
          value={form.title}
          onChange={e => update('title', e.target.value)}
          placeholder="계획 제목을 입력하세요"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          required
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">세부 내용</label>
        <Textarea
          value={form.description}
          onChange={e => update('description', e.target.value)}
          placeholder="세부 내용, 실행 방법 등을 입력하세요"
          rows={3}
          className="text-sm resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">카테고리 (다중선택)</label>
        <CategoryFilter selected={form.categories} onChange={cats => update('categories', cats)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
          <select
            value={form.status}
            onChange={e => update('status', e.target.value as PlanStatus)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="pending">미시작</option>
            <option value="in_progress">진행중</option>
            <option value="completed">완료</option>
            <option value="on_hold">보류</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">우선순위</label>
          <select
            value={form.priority}
            onChange={e => update('priority', e.target.value as PlanPriority)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="high">🔴 높음</option>
            <option value="medium">🟡 중간</option>
            <option value="low">⚪ 낮음</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={loading || !form.title.trim()} className="flex-1">
          {loading ? '저장 중...' : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          취소
        </Button>
      </div>
    </form>
  )
}
