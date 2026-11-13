import { supabase } from './supabase'
import type { ThoughtNode } from './brain-types'
import { DEFAULT_COLOR } from './mindmap-theme'

// 주제(root) 아래 모든 후손 노드를 parent_id 체인으로 로드.
export async function getMindNodes(topicId: string): Promise<ThoughtNode[]> {
  const all: ThoughtNode[] = []
  let frontier = [topicId]
  let guard = 0
  while (frontier.length > 0 && guard++ < 100) {
    const { data, error } = await supabase.from('thought_nodes').select('*').in('parent_id', frontier)
    if (error) throw error
    const batch = data ?? []
    if (batch.length === 0) break
    all.push(...batch)
    frontier = batch.map((n) => n.id)
  }
  return all
}

// 하위 생각(자식) 추가
export async function addNode(parentId: string, title = ''): Promise<ThoughtNode> {
  const { count } = await supabase
    .from('thought_nodes')
    .select('*', { count: 'exact', head: true })
    .eq('parent_id', parentId)
  const { data, error } = await supabase
    .from('thought_nodes')
    .insert({
      parent_id: parentId,
      title,
      type: 'memo',
      node_kind: 'module',
      pos_x: 0,
      pos_y: 0,
      grid_position: 4,
      color: DEFAULT_COLOR,
      sort_order: count ?? 0,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function renameNode(id: string, title: string): Promise<void> {
  const { error } = await supabase.from('thought_nodes').update({ title }).eq('id', id)
  if (error) throw error
}

export async function setNodeColor(id: string, color: string): Promise<void> {
  const { error } = await supabase.from('thought_nodes').update({ color }).eq('id', id)
  if (error) throw error
}

export async function reparentNode(id: string, newParentId: string, sortOrder: number): Promise<void> {
  const { error } = await supabase.from('thought_nodes').update({ parent_id: newParentId, sort_order: sortOrder }).eq('id', id)
  if (error) throw error
}

// 노드 + 모든 후손 삭제 (클라이언트가 가진 전체 노드 목록으로 후손 계산)
export async function deleteSubtree(id: string, allNodes: ThoughtNode[]): Promise<string[]> {
  const childrenOf = new Map<string, string[]>()
  for (const n of allNodes) {
    if (!n.parent_id) continue
    const a = childrenOf.get(n.parent_id) ?? []
    a.push(n.id)
    childrenOf.set(n.parent_id, a)
  }
  const toDelete: string[] = []
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    toDelete.push(cur)
    stack.push(...(childrenOf.get(cur) ?? []))
  }
  const { error } = await supabase.from('thought_nodes').delete().in('id', toDelete)
  if (error) throw error
  return toDelete
}

/**
 * 기존 자유 연결선(thought_edges)을 parent_id 트리로 1회 변환(비파괴).
 * - 주제 바로 밑(flat)에 있고 들어오는 연결선이 있는 노드 → 그 연결의 출발 노드를 부모로.
 * - 사이클 방지, 그룹 노드의 크기 JSON content 제거(트리에선 불필요).
 * - content(생각 내용)·title 은 보존. 반환: 변경 여부.
 */
export async function normalizeTopicTree(topicId: string): Promise<boolean> {
  const nodes = await getMindNodes(topicId)
  if (nodes.length === 0) return false
  const ids = nodes.map((n) => n.id)
  const idSet = new Set(ids)
  const byId = new Map(nodes.map((n) => [n.id, n]))

  const { data: edges } = await supabase
    .from('thought_edges')
    .select('source_id,target_id')
    .or(`source_id.in.(${ids.join(',')}),target_id.in.(${ids.join(',')})`)

  // target 당 첫 번째 들어오는 source
  const incoming = new Map<string, string>()
  for (const e of (edges ?? []) as { source_id: string; target_id: string }[]) {
    if (!idSet.has(e.target_id)) continue
    const srcOk = idSet.has(e.source_id) || e.source_id === topicId
    if (srcOk && !incoming.has(e.target_id)) incoming.set(e.target_id, e.source_id)
  }

  const newParent = new Map<string, string>()
  for (const n of nodes) {
    const src = incoming.get(n.id)
    if (src && n.parent_id === topicId && src !== n.id) newParent.set(n.id, src)
  }

  const updates: { id: string; parent_id: string }[] = []
  for (const [childId, parentId] of newParent) {
    // 사이클 검사: parentId 조상을 따라가며 childId 를 만나면 skip
    let cur: string | undefined = parentId
    let safe = true
    let guard = 0
    while (cur && guard++ < 1000) {
      if (cur === childId) { safe = false; break }
      if (cur === topicId) break
      cur = newParent.get(cur) ?? byId.get(cur)?.parent_id ?? undefined
    }
    if (safe) updates.push({ id: childId, parent_id: parentId })
  }

  const groupClears = nodes
    .filter((n) => n.node_kind === 'group' && n.content && n.content.trim().startsWith('{'))
    .map((n) => n.id)

  if (updates.length === 0 && groupClears.length === 0) return false

  for (const u of updates) {
    await supabase.from('thought_nodes').update({ parent_id: u.parent_id }).eq('id', u.id)
  }
  for (const gid of groupClears) {
    await supabase.from('thought_nodes').update({ content: null }).eq('id', gid)
  }
  return true
}
