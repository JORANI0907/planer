import { supabase } from '@/lib/supabase'

export interface PlanConnection {
  id: string
  source_id: string
  target_id: string
  source_level: string
  target_level: string
  created_at: string
}

// 인접 색상이 최대 대비를 갖도록 hue 180° 반대편끼리 교번 배치
export const CONNECTION_COLORS = [
  '#ef4444', '#3b82f6', // 빨강 ↔ 파랑
  '#84cc16', '#a855f7', // 연두 ↔ 보라
  '#f97316', '#14b8a6', // 주황 ↔ 청록
  '#eab308', '#6366f1', // 노랑 ↔ 인디고
  '#22c55e', '#ec4899', // 초록 ↔ 핑크
  '#06b6d4', '#f59e0b', // 시안 ↔ 앰버
  '#d946ef', '#10b981', // 퓨시아 ↔ 에메랄드
  '#0ea5e9', '#f43f5e', // 스카이 ↔ 로즈
  '#dc2626', '#0284c7', // 진빨강 ↔ 진파랑
  '#65a30d', '#7c3aed', // 진연두 ↔ 진보라
  '#ea580c', '#0d9488', // 진주황 ↔ 진청록
  '#ca8a04', '#4f46e5', // 진노랑 ↔ 진인디고
  '#16a34a', '#d97706', // 진초록 ↔ 진앰버
  '#0891b2', '#8b5cf6', // 진시안 ↔ 바이올렛
  '#059669', '#64748b', // 진에메랄드 ↔ 슬레이트
]

const LEVEL_PRIORITY: Record<string, number> = {
  annual: 0, quarterly: 1, monthly: 2, weekly: 3, daily: 4,
}

export function buildColorMap(connections: PlanConnection[]): Map<string, string> {
  const parent = new Map<string, string>()
  const levelMap = new Map<string, string>()

  for (const c of connections) {
    if (!levelMap.has(c.source_id)) levelMap.set(c.source_id, c.source_level)
    if (!levelMap.has(c.target_id)) levelMap.set(c.target_id, c.target_level)
  }

  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x)
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!))
    return parent.get(x)!
  }

  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b)
    if (ra === rb) return
    const la = LEVEL_PRIORITY[levelMap.get(ra) ?? 'daily'] ?? 4
    const lb = LEVEL_PRIORITY[levelMap.get(rb) ?? 'daily'] ?? 4
    if (la <= lb) parent.set(rb, ra)
    else parent.set(ra, rb)
  }

  for (const c of connections) union(c.source_id, c.target_id)

  const rootColor = new Map<string, string>()
  let colorIdx = 0
  const colorMap = new Map<string, string>()
  for (const id of levelMap.keys()) {
    const root = find(id)
    if (!rootColor.has(root)) {
      rootColor.set(root, CONNECTION_COLORS[colorIdx % CONNECTION_COLORS.length])
      colorIdx++
    }
    colorMap.set(id, rootColor.get(root)!)
  }
  return colorMap
}

interface RawConn { id: string; source_id: string; target_id: string; created_at: string }
interface RawItem { id: string; level: string; period_key: string }

export async function getConnectionsForYear(year: number): Promise<PlanConnection[]> {
  const { data: conns } = await supabase
    .from('plan_item_connections')
    .select('id, source_id, target_id, created_at')
  if (!conns || conns.length === 0) return []

  const ids = [...new Set((conns as RawConn[]).flatMap(c => [c.source_id, c.target_id]))]
  const { data: items } = await supabase
    .from('plan_items')
    .select('id, level, period_key')
    .in('id', ids)

  const itemMap = new Map((items as RawItem[] ?? []).map(i => [i.id, i]))
  return (conns as RawConn[]).filter(c => {
    const si = itemMap.get(c.source_id)
    const ti = itemMap.get(c.target_id)
    if (!si || !ti) return false
    const sy = parseInt(si.period_key.split('-')[0])
    const ty = parseInt(ti.period_key.split('-')[0])
    return sy === year || ty === year
  }).map(c => ({
    id: c.id,
    source_id: c.source_id,
    target_id: c.target_id,
    source_level: itemMap.get(c.source_id)?.level ?? 'daily',
    target_level: itemMap.get(c.target_id)?.level ?? 'daily',
    created_at: c.created_at,
  }))
}

export async function createConnection(a: string, b: string): Promise<PlanConnection> {
  const [source_id, target_id] = a < b ? [a, b] : [b, a]
  const { data: conn, error } = await supabase
    .from('plan_item_connections')
    .insert({ source_id, target_id })
    .select('id, source_id, target_id, created_at')
    .single()
  if (error) throw error

  const c = conn as RawConn
  const { data: items } = await supabase
    .from('plan_items')
    .select('id, level')
    .in('id', [c.source_id, c.target_id])

  const itemMap = new Map((items as Pick<RawItem, 'id' | 'level'>[] ?? []).map(i => [i.id, i]))
  return {
    id: c.id,
    source_id: c.source_id,
    target_id: c.target_id,
    source_level: itemMap.get(c.source_id)?.level ?? 'daily',
    target_level: itemMap.get(c.target_id)?.level ?? 'daily',
    created_at: c.created_at,
  }
}

export async function deleteConnectionBetween(a: string, b: string): Promise<void> {
  const [source_id, target_id] = a < b ? [a, b] : [b, a]
  await supabase.from('plan_item_connections').delete().match({ source_id, target_id })
}

export function isConnected(connections: PlanConnection[], a: string, b: string): boolean {
  const [s, t] = a < b ? [a, b] : [b, a]
  return connections.some(c => c.source_id === s && c.target_id === t)
}
