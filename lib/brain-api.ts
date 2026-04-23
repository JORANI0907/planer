import { supabase } from './supabase'
import type { ThoughtNode, ThoughtEdge, EdgeRelationType } from './brain-types'

const DEFAULT_COLOR = '#94a3b8'

// ─── Topics ───────────────────────────────────────────────────

export async function getTopics(): Promise<ThoughtNode[]> {
  const { data, error } = await supabase
    .from('thought_nodes')
    .select('*')
    .eq('node_kind', 'topic')
    .is('parent_id', null)
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function createTopic(title: string): Promise<ThoughtNode> {
  const { data, error } = await supabase
    .from('thought_nodes')
    .insert({ parent_id: null, title, type: 'memo', node_kind: 'topic', pos_x: 0, pos_y: 0, grid_position: 4, color: DEFAULT_COLOR })
    .select().single()
  if (error) throw error
  return data
}

export async function deleteTopic(id: string): Promise<void> {
  const { error } = await supabase.from('thought_nodes').delete().eq('id', id)
  if (error) throw error
}

// ─── Modules & Wings ──────────────────────────────────────────

export async function getCanvasNodes(topicId: string): Promise<ThoughtNode[]> {
  const { data: modules, error: me } = await supabase
    .from('thought_nodes')
    .select('*')
    .eq('parent_id', topicId)
    .eq('node_kind', 'module')
  if (me) throw me
  if (!modules || modules.length === 0) return []

  const allNodes: ThoughtNode[] = [...modules]
  let parentIds = modules.map(m => m.id)

  while (parentIds.length > 0) {
    const { data: wings, error: we } = await supabase
      .from('thought_nodes')
      .select('*')
      .in('parent_id', parentIds)
      .eq('node_kind', 'wing')
    if (we) throw we
    if (!wings || wings.length === 0) break
    allNodes.push(...wings)
    parentIds = wings.map(w => w.id)
  }

  return allNodes
}

export async function createModule(
  topicId: string, title: string, x: number, y: number
): Promise<ThoughtNode> {
  const { data, error } = await supabase
    .from('thought_nodes')
    .insert({ parent_id: topicId, title, type: 'memo', node_kind: 'module', pos_x: x, pos_y: y, grid_position: 4, color: DEFAULT_COLOR })
    .select().single()
  if (error) throw error
  return data
}

export async function createWing(
  moduleId: string, title: string, x: number, y: number
): Promise<{ wing: ThoughtNode; edge: ThoughtEdge }> {
  const { data: wingData, error: wingError } = await supabase
    .from('thought_nodes')
    .insert({ parent_id: moduleId, title, type: 'memo', node_kind: 'wing', pos_x: x, pos_y: y, grid_position: 4, color: DEFAULT_COLOR })
    .select().single()
  if (wingError) throw wingError

  const { data: edgeData, error: edgeError } = await supabase
    .from('thought_edges')
    .insert({ source_id: moduleId, target_id: wingData.id, relation_type: 'wing' })
    .select().single()
  if (edgeError) throw edgeError

  return { wing: wingData, edge: edgeData }
}

export async function updateNode(
  id: string,
  updates: Partial<Pick<ThoughtNode, 'title' | 'content' | 'tags'>>
): Promise<ThoughtNode> {
  const { data, error } = await supabase
    .from('thought_nodes').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function updateNodePosition(id: string, x: number, y: number): Promise<void> {
  const { error } = await supabase
    .from('thought_nodes').update({ pos_x: x, pos_y: y }).eq('id', id)
  if (error) throw error
}

export async function deleteNode(id: string): Promise<void> {
  const { error } = await supabase.from('thought_nodes').delete().eq('id', id)
  if (error) throw error
}

// ─── Edges ────────────────────────────────────────────────────

export async function getCanvasEdges(topicId: string): Promise<ThoughtEdge[]> {
  const nodes = await getCanvasNodes(topicId)
  const nodeIds = nodes.map(n => n.id)
  if (nodeIds.length === 0) return []

  const { data, error } = await supabase
    .from('thought_edges')
    .select('*')
    .or(`source_id.in.(${nodeIds.join(',')}),target_id.in.(${nodeIds.join(',')})`)
  if (error) throw error
  return data ?? []
}

export async function createEdge(params: {
  source_id: string
  target_id: string
  label?: string
  relation_type: EdgeRelationType
  source_handle?: string
  target_handle?: string
}): Promise<ThoughtEdge> {
  const { data, error } = await supabase
    .from('thought_edges')
    .upsert({ ...params }, { onConflict: 'source_id,target_id' })
    .select().single()
  if (error) throw error
  return data
}

export async function updateEdge(
  id: string,
  updates: Partial<Pick<ThoughtEdge, 'label' | 'relation_type'>>
): Promise<ThoughtEdge> {
  const { data, error } = await supabase
    .from('thought_edges').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteEdge(id: string): Promise<void> {
  const { error } = await supabase.from('thought_edges').delete().eq('id', id)
  if (error) throw error
}
