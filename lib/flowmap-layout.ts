import type { PlanItem, PlanLevel } from './types'

export const NEXT_LEVEL: Partial<Record<PlanLevel, PlanLevel>> = {
  annual: 'quarterly',
  quarterly: 'monthly',
  monthly: 'weekly',
  weekly: 'daily',
}

export const LEVEL_LABEL: Record<PlanLevel, string> = {
  annual: '연간',
  quarterly: '분기',
  monthly: '월간',
  weekly: '주간',
  daily: '일일',
}

export const NODE_WIDTH: Record<PlanLevel, number> = {
  annual: 182,
  quarterly: 164,
  monthly: 152,
  weekly: 144,
  daily: 134,
}

export const NODE_HEIGHT: Record<PlanLevel, number> = {
  annual: 108,
  quarterly: 92,
  monthly: 80,
  weekly: 70,
  daily: 60,
}

export const COLUMN_GAP = 68
export const ROW_GAP = 10
export const CANVAS_PADDING_TOP = 52 // column header height

export interface NodePosition {
  x: number
  y: number
  width: number
  height: number
}

const LEVEL_ORDER: PlanLevel[] = ['annual', 'quarterly', 'monthly', 'weekly', 'daily']

export function getColumnX(level: PlanLevel): number {
  let x = 0
  for (const l of LEVEL_ORDER) {
    if (l === level) return x
    x += NODE_WIDTH[l] + COLUMN_GAP
  }
  return x
}

export function calculateLayout(
  annualItems: PlanItem[],
  childrenByParentId: Map<string, PlanItem[]>,
  expandedIds: Set<string>
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>()
  let currentY = CANVAS_PADDING_TOP

  for (const item of annualItems) {
    currentY = layoutNode(item, 'annual', currentY, childrenByParentId, expandedIds, positions)
  }

  return positions
}

function layoutNode(
  node: PlanItem,
  level: PlanLevel,
  startY: number,
  childrenByParentId: Map<string, PlanItem[]>,
  expandedIds: Set<string>,
  positions: Map<string, NodePosition>
): number {
  const x = getColumnX(level)
  const width = NODE_WIDTH[level]
  const height = NODE_HEIGHT[level]

  positions.set(node.id, { x, y: startY, width, height })

  if (!expandedIds.has(node.id)) {
    return startY + height + ROW_GAP
  }

  const children = childrenByParentId.get(node.id) ?? []
  if (children.length === 0) {
    return startY + height + ROW_GAP
  }

  // 실제 자식 아이템의 level 필드를 사용 (분기 폴백 시 monthly가 될 수 있음)
  const childLevel = children[0].level as PlanLevel

  let childY = startY
  for (const child of children) {
    childY = layoutNode(child, childLevel, childY, childrenByParentId, expandedIds, positions)
  }

  return Math.max(startY + height + ROW_GAP, childY)
}

export function formatPeriodKey(periodKey: string, level: PlanLevel): string {
  if (level === 'annual') return `${periodKey}년`

  if (level === 'quarterly') {
    const q = parseInt(periodKey.split('-Q')[1])
    const monthRanges = ['1–3월', '4–6월', '7–9월', '10–12월']
    return `${q}분기 (${monthRanges[q - 1]})`
  }

  if (level === 'monthly') {
    const month = parseInt(periodKey.split('-')[1])
    return `${month}월`
  }

  if (level === 'weekly') {
    const [yearStr, weekPart] = periodKey.split('-W')
    const week = parseInt(weekPart)
    return `${week}주차`
  }

  if (level === 'daily') {
    const [year, month, day] = periodKey.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return `${month}/${day} (${days[date.getDay()]})`
  }

  return periodKey
}

export function isTodayPeriod(periodKey: string, level: PlanLevel): boolean {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const day = today.getDate()

  if (level === 'annual') return periodKey === String(year)

  if (level === 'quarterly') {
    const quarter = Math.ceil(month / 3)
    return periodKey === `${year}-Q${quarter}`
  }

  if (level === 'monthly') {
    return periodKey === `${year}-${String(month).padStart(2, '0')}`
  }

  if (level === 'weekly') {
    const d = new Date(today)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
    const week1 = new Date(d.getFullYear(), 0, 4)
    const weekNum =
      1 +
      Math.round(
        ((d.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7
      )
    return periodKey === `${year}-W${String(weekNum).padStart(2, '0')}`
  }

  if (level === 'daily') {
    return (
      periodKey ===
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    )
  }

  return false
}

export function getStatusProgress(status: string): number {
  const map: Record<string, number> = {
    completed: 100,
    in_progress: 50,
    on_hold: 20,
    pending: 0,
  }
  return map[status] ?? 0
}

export function getCategoryColor(category: string): string {
  const map: Record<string, string> = {
    사업: '#3b82f6',
    건강운동: '#22c55e',
    독서자기계발: '#a855f7',
    투자경매: '#eab308',
    개인가족: '#ec4899',
  }
  return map[category] ?? '#6b7280'
}

export function getStatusBorderColor(status: string): string {
  const map: Record<string, string> = {
    completed: '#22c55e',
    in_progress: '#3b82f6',
    on_hold: '#f97316',
    pending: '#d1d5db',
  }
  return map[status] ?? '#d1d5db'
}

export function getStatusBgColor(status: string): string {
  const map: Record<string, string> = {
    completed: 'rgba(34,197,94,0.06)',
    in_progress: 'rgba(59,130,246,0.06)',
    on_hold: 'rgba(249,115,22,0.06)',
    pending: 'rgba(255,255,255,1)',
  }
  return map[status] ?? 'rgba(255,255,255,1)'
}
