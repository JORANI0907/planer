'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Package } from 'lucide-react'
import type { LowStockItem } from '@/lib/shopping-types'
import { getLowStockItems } from '@/lib/shopping-api'

const CATEGORY_LABEL: Record<string, string> = {
  chemical:   '약품',
  consumable: '소모품',
  equipment:  '장비',
  other:      '기타',
}

function fmtQty(qty: number, unit: string | null): string {
  const q = Number.isInteger(qty) ? qty.toString() : qty.toFixed(1)
  return unit ? `${q}${unit}` : q
}

export function LowStockSection() {
  const [items, setItems] = useState<LowStockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    getLowStockItems(2)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-gray-400">
        <Loader2 size={12} className="animate-spin" /> BBK 재고 확인 중...
      </div>
    )
  }

  if (items.length === 0) return null

  const zeroCount = items.filter(i => Number(i.current_qty) === 0).length

  return (
    <div className="bg-amber-50 border-2 border-amber-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-amber-100/50 transition-colors text-left"
      >
        {expanded ? <ChevronDown size={14} className="text-amber-700 shrink-0" /> : <ChevronRight size={14} className="text-amber-700 shrink-0" />}
        <AlertTriangle size={16} className="text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-amber-900">BBK 재고 부족</span>
            <span className="text-[10px] font-semibold bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
              {items.length}건
            </span>
            {zeroCount > 0 && (
              <span className="text-[10px] font-semibold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                품절 {zeroCount}
              </span>
            )}
          </div>
          <p className="text-[11px] text-amber-700 mt-0.5">재고 2개 이하 품목 (BBK 재고관리 연동)</p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-amber-200 bg-white max-h-80 overflow-y-auto">
          <ul className="divide-y divide-gray-100">
            {items.map(item => {
              const qty = Number(item.current_qty)
              const isZero = qty === 0
              return (
                <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image_url} alt="" className="w-9 h-9 rounded-md object-cover shrink-0 bg-gray-50" />
                  ) : (
                    <div className="w-9 h-9 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                      <Package size={14} className="text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{item.item_name}</div>
                    {item.category && (
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {CATEGORY_LABEL[item.category] ?? item.category}
                      </div>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-xs font-bold px-2 py-1 rounded-md ${
                      isZero
                        ? 'bg-red-100 text-red-600'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {isZero ? '품절' : fmtQty(qty, item.unit)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
