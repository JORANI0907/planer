'use client'

import type { PlanItem, PlanLevel } from '@/lib/types'
import { STATUS_CONFIG } from '@/lib/types'
import { formatPeriodLabel } from '@/lib/flowmap-v2-utils'

interface PeriodFlatViewProps {
  level: PlanLevel
  periodKeys: string[]
  itemsByPeriod: Map<string, PlanItem[]>
  allItems: PlanItem[]          // 상위 연간 아이템 포함 전체 (배지 표시용)
  onAddItem?: (periodKey: string) => void
}

const STATUS_DOT: Record<string, string> = {
  completed: '#22c55e',
  in_progress: '#3b82f6',
  on_hold: '#f97316',
  pending: '#9ca3af',
}

const STATUS_BG: Record<string, { bg: string; border: string }> = {
  completed: { bg: 'rgba(34,197,94,0.07)', border: '#86efac' },
  in_progress: { bg: 'rgba(59,130,246,0.07)', border: '#93c5fd' },
  on_hold: { bg: 'rgba(249,115,22,0.07)', border: '#fdba74' },
  pending: { bg: '#fff', border: '#e5e7eb' },
}

/** parent_plan_item_id 체인을 추적해서 연간 아이템 이름 반환 */
function findAnnualAncestorTitle(
  item: PlanItem,
  allItems: PlanItem[]
): string | null {
  const itemMap = new Map(allItems.map(i => [i.id, i]))
  let current: PlanItem | undefined = item

  while (current) {
    if (current.level === 'annual') return current.title
    if (!current.parent_plan_item_id) return null
    current = itemMap.get(current.parent_plan_item_id)
  }
  return null
}

function PeriodCard({
  item,
  allItems,
}: {
  item: PlanItem
  allItems: PlanItem[]
}) {
  const sc = STATUS_BG[item.status] ?? STATUS_BG.pending
  const dot = STATUS_DOT[item.status] ?? STATUS_DOT.pending
  const statusLabel = STATUS_CONFIG[item.status]?.label ?? item.status
  const ancestorTitle = findAnnualAncestorTitle(item, allItems)

  return (
    <div
      style={{
        border: `1.5px solid ${sc.border}`,
        borderRadius: 10,
        backgroundColor: sc.bg,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}
    >
      {/* 연간 목표 배지 */}
      {ancestorTitle && (
        <span
          style={{
            display: 'inline-block',
            fontSize: 10,
            fontWeight: 600,
            color: '#1d4ed8',
            backgroundColor: '#dbeafe',
            borderRadius: 12,
            padding: '1px 7px',
            alignSelf: 'flex-start',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={ancestorTitle}
        >
          {ancestorTitle}
        </span>
      )}

      {/* 제목 */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#111827',
          lineHeight: 1.4,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {item.title}
      </div>

      {/* 설명 */}
      {item.description && (
        <div
          style={{
            fontSize: 11,
            color: '#6b7280',
            lineHeight: 1.45,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {item.description}
        </div>
      )}

      {/* 상태 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: dot,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 10, color: dot, fontWeight: 600 }}>
          {statusLabel}
        </span>
      </div>
    </div>
  )
}

function PeriodColumn({
  periodKey,
  items,
  allItems,
}: {
  periodKey: string
  items: PlanItem[]
  allItems: PlanItem[]
}) {
  const label = formatPeriodLabel(periodKey)

  return (
    <div
      style={{
        minWidth: 200,
        flex: '0 0 220px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* 컬럼 헤더 */}
      <div
        style={{
          padding: '7px 12px',
          backgroundColor: '#f8fafc',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          fontWeight: 700,
          fontSize: 13,
          color: '#374151',
          textAlign: 'center',
        }}
      >
        {label}
        <span
          style={{
            marginLeft: 6,
            fontSize: 10,
            color: '#9ca3af',
            fontWeight: 400,
          }}
        >
          {items.length}건
        </span>
      </div>

      {/* 카드 목록 */}
      {items.length === 0 ? (
        <div
          style={{
            border: '1.5px dashed #e5e7eb',
            borderRadius: 10,
            padding: '16px 12px',
            textAlign: 'center',
            color: '#d1d5db',
            fontSize: 12,
          }}
        >
          항목 없음
        </div>
      ) : (
        items.map(item => (
          <PeriodCard key={item.id} item={item} allItems={allItems} />
        ))
      )}
    </div>
  )
}

export function PeriodFlatView({
  periodKeys,
  itemsByPeriod,
  allItems,
}: PeriodFlatViewProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        overflowX: 'auto',
        paddingBottom: 16,
        alignItems: 'flex-start',
      }}
    >
      {periodKeys.map(key => (
        <PeriodColumn
          key={key}
          periodKey={key}
          items={itemsByPeriod.get(key) ?? []}
          allItems={allItems}
        />
      ))}
    </div>
  )
}
