'use client'

import { useState } from 'react'
import { CategoryBadge } from '@/components/category-badge'
import { StatusBadge, PriorityDot, StatusSelect } from '@/components/status-badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PlanItemForm } from '@/components/plan-item-form'
import { updatePlanItem, deletePlanItem } from '@/lib/api'
import type { PlanItem, PlanStatus } from '@/lib/types'

interface PlanItemCardProps {
  item: PlanItem
  onUpdate: (updated: PlanItem) => void
  onDelete: (id: string) => void
  mapButton?: React.ReactNode
  parentLabel?: string // 상위 계획에서 매핑된 경우
}

export function PlanItemCard({ item, onUpdate, onDelete, mapButton, parentLabel }: PlanItemCardProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const handleStatusChange = async (status: PlanStatus) => {
    const updated = await updatePlanItem(item.id, { status })
    onUpdate(updated)
  }

  const handleEdit = async (data: {
    title: string
    description: string
    categories: string[]
    status: PlanStatus
    priority: 'high' | 'medium' | 'low'
  }) => {
    const updated = await updatePlanItem(item.id, data)
    onUpdate(updated)
    setEditOpen(false)
  }

  const handleDelete = async () => {
    if (!confirm(`"${item.title}" 항목을 삭제할까요?`)) return
    await deletePlanItem(item.id)
    onDelete(item.id)
  }

  const isCompleted = item.status === 'completed'

  return (
    <>
      <div className={`bg-white rounded-xl border transition-all ${
        isCompleted ? 'border-gray-100 opacity-75' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }`}>
        <div className="p-4">
          {/* 상단: 우선순위 + 상태 */}
          <div className="flex items-center justify-between mb-2">
            <PriorityDot priority={item.priority} />
            <div className="flex items-center gap-2">
              <StatusSelect value={item.status} onChange={handleStatusChange} />
              <button
                onClick={() => setEditOpen(true)}
                className="text-gray-400 hover:text-gray-600 text-sm"
                title="편집"
              >✏️</button>
              <button
                onClick={handleDelete}
                className="text-gray-400 hover:text-red-500 text-sm"
                title="삭제"
              >🗑️</button>
            </div>
          </div>

          {/* 제목 */}
          <p className={`text-sm font-medium leading-snug mb-2 ${
            isCompleted ? 'line-through text-gray-400' : 'text-gray-900'
          }`}>
            {parentLabel && (
              <span className="block text-xs text-blue-500 font-normal mb-0.5">
                ↑ {parentLabel}에서
              </span>
            )}
            {item.title}
          </p>

          {/* 카테고리 */}
          {item.categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {item.categories.map(cat => (
                <CategoryBadge key={cat} category={cat} />
              ))}
            </div>
          )}

          {/* 세부 내용 */}
          {item.description && (
            <div>
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                {expanded ? '▲ 접기' : '▼ 세부내용 보기'}
              </button>
              {expanded && (
                <p className="text-xs text-gray-500 mt-1 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded p-2">
                  {item.description}
                </p>
              )}
            </div>
          )}

          {/* 하위 반영 버튼 */}
          {mapButton && <div className="mt-3 pt-3 border-t border-gray-100">{mapButton}</div>}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>계획 수정</DialogTitle>
          </DialogHeader>
          <PlanItemForm
            initialData={{
              title: item.title,
              description: item.description ?? '',
              categories: item.categories,
              status: item.status,
              priority: item.priority,
            }}
            onSubmit={handleEdit}
            onCancel={() => setEditOpen(false)}
            submitLabel="수정 저장"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
