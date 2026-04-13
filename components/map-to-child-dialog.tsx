'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createMapping, deleteMapping } from '@/lib/api'
import type { PlanItem, PlanMapping } from '@/lib/types'

interface PeriodOption {
  key: string
  label: string
}

interface MapToChildDialogProps {
  open: boolean
  onClose: () => void
  parentItem: PlanItem
  currentMappings: PlanMapping[]
  childPeriods: PeriodOption[]
  onSuccess: () => void
}

export function MapToChildDialog({
  open,
  onClose,
  parentItem,
  currentMappings,
  childPeriods,
  onSuccess,
}: MapToChildDialogProps) {
  const mappedKeys = new Set(currentMappings.map(m => m.child_period_key))
  const [selected, setSelected] = useState<Set<string>>(new Set(mappedKeys))
  const [loading, setLoading] = useState(false)

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      // 추가할 매핑
      const toAdd = [...selected].filter(k => !mappedKeys.has(k))
      // 제거할 매핑
      const toRemove = [...mappedKeys].filter(k => !selected.has(k))

      await Promise.all([
        ...toAdd.map(k => createMapping(parentItem.id, k)),
        ...toRemove.map(k => deleteMapping(parentItem.id, k)),
      ])

      onSuccess()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug">
            하위 계획에 반영
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            <span className="font-medium text-gray-900">"{parentItem.title}"</span>
            <br />
            <span className="text-xs mt-1 block">반영할 기간을 선택하세요</span>
          </p>

          <div className="space-y-2">
            {childPeriods.map(period => {
              const isSelected = selected.has(period.key)
              return (
                <button
                  key={period.key}
                  onClick={() => toggle(period.key)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    isSelected
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span>{period.label}</span>
                  <span className={`text-lg ${isSelected ? 'text-blue-500' : 'text-gray-300'}`}>
                    {isSelected ? '✓' : '○'}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} disabled={loading} className="flex-1">
              {loading ? '저장 중...' : `${selected.size}개 기간에 반영`}
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              취소
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
