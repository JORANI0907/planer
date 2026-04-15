import { supabase } from './supabase'
import type { ThoughtNode, ThoughtEdge, ThoughtNodeType, EdgeRelationType } from './brain-types'

// ─── Nodes ────────────────────────────────────────────────────

export async function getRootNodes(): Promise<ThoughtNode[]> {
  const { data, error } = await supabase
    .from('thought_nodes')
    .select('*')
    .is('parent_id', null)
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function getChildNodes(parentId: string): Promise<ThoughtNode[]> {
  const { data, error } = await supabase
    .from('thought_nodes')
    .select('*')
    .eq('parent_id', parentId)
    .order('grid_position')
  if (error) throw error
  return data ?? []
}

export async function getDescendants(rootId: string): Promise<ThoughtNode[]> {
  // 재귀 CTE로 모든 하위 노드 가져오기
  const { data, error } = await supabase.rpc('get_thought_descendants', { root_id: rootId })
  if (error) {
    // fallback: 단순 쿼리
    const { data: fd, error: fe } = await supabase
      .from('thought_nodes')
      .select('*')
      .eq('parent_id', rootId)
      .order('grid_position')
    if (fe) throw fe
    return fd ?? []
  }
  return data ?? []
}

export async function createThoughtNode(params: {
  parent_id: string | null
  title: string
  type: ThoughtNodeType
  grid_position: number
  color?: string
  sort_order?: number
}): Promise<ThoughtNode> {
  const { data, error } = await supabase
    .from('thought_nodes')
    .insert({
      parent_id: params.parent_id,
      title: params.title,
      type: params.type,
      grid_position: params.grid_position,
      color: params.color ?? '#6366f1',
      sort_order: params.sort_order ?? 0,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateThoughtNode(
  id: string,
  updates: Partial<Pick<ThoughtNode, 'title' | 'content' | 'type' | 'color' | 'tags' | 'sort_order'>>
): Promise<ThoughtNode> {
  const { data, error } = await supabase
    .from('thought_nodes')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteThoughtNode(id: string): Promise<void> {
  const { error } = await supabase.from('thought_nodes').delete().eq('id', id)
  if (error) throw error
}

// ─── Edges ────────────────────────────────────────────────────

export async function getEdgesForNodes(nodeIds: string[]): Promise<ThoughtEdge[]> {
  if (nodeIds.length === 0) return []
  const { data, error } = await supabase
    .from('thought_edges')
    .select('*')
    .or(`source_id.in.(${nodeIds.join(',')}),target_id.in.(${nodeIds.join(',')})`)
  if (error) throw error
  return data ?? []
}

export async function createThoughtEdge(params: {
  source_id: string
  target_id: string
  label?: string
  relation_type: EdgeRelationType
}): Promise<ThoughtEdge> {
  const { data, error } = await supabase
    .from('thought_edges')
    .upsert(params, { onConflict: 'source_id,target_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteThoughtEdge(id: string): Promise<void> {
  const { error } = await supabase.from('thought_edges').delete().eq('id', id)
  if (error) throw error
}
