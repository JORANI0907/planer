'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { supabase } from '@/lib/supabase'
import { updateNode } from '@/lib/brain-api'
import {
  getMindNodes,
  addNode,
  renameNode,
  setNodeColor,
  deleteSubtree,
  normalizeTopicTree,
} from '@/lib/mindmap-api'
import type { ThoughtNode } from '@/lib/brain-types'
import { layoutTree } from '@/lib/mindmap-layout'
import { branchColorOf, paletteFor, DEFAULT_COLOR } from '@/lib/mindmap-theme'
import { MindCtx } from './MindMapContext'
import { MindNode, type MindNodeData } from './MindNode'
import { ModuleDetailModal } from '@/components/brain/ModuleDetailModal'

const nodeTypes = { mind: MindNode }

export function MindMapCanvas({ topicId, topicTitle }: { topicId: string; topicTitle: string }) {
  const [nodes, setNodes] = useState<ThoughtNode[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      await normalizeTopicTree(topicId) // 기존 연결선 → 트리 1회 변환(비파괴)
      const { data: root } = await supabase.from('thought_nodes').select('*').eq('id', topicId).single()
      const desc = await getMindNodes(topicId)
      setNodes(root ? [root as ThoughtNode, ...desc] : desc)
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  // ── 액션 ──────────────────────────────────────────────
  const addChild = useCallback(async (parentId: string) => {
    const created = await addNode(parentId, '')
    setNodes((ns) => [...ns, created])
    setSelectedId(created.id)
    setEditingId(created.id)
  }, [])

  const addSibling = useCallback(async (id: string) => {
    const n = nodes.find((x) => x.id === id)
    if (!n || !n.parent_id) return
    const created = await addNode(n.parent_id, '')
    setNodes((ns) => [...ns, created])
    setSelectedId(created.id)
    setEditingId(created.id)
  }, [nodes])

  const del = useCallback(async (id: string) => {
    if (id === topicId) return
    if (!confirm('이 생각과 하위 생각을 모두 삭제할까요?')) return
    const removed = await deleteSubtree(id, nodes)
    const removedSet = new Set(removed)
    setNodes((ns) => ns.filter((n) => !removedSet.has(n.id)))
    setSelectedId(null)
    setEditingId(null)
  }, [nodes, topicId])

  const rename = useCallback(async (id: string, title: string) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, title } : n)))
    try { await renameNode(id, title) } catch { /* noop */ }
  }, [])

  const setColor = useCallback(async (id: string, color: string) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, color } : n)))
    try { await setNodeColor(id, color) } catch { /* noop */ }
  }, [])

  const saveDetailContent = useCallback(async (id: string, html: string) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, content: html } : n)))
    try { await updateNode(id, { content: html }) } catch { /* noop */ }
  }, [])

  const ctxValue = useMemo(() => ({
    onAddChild: addChild,
    onAddSibling: addSibling,
    onDelete: del,
    onRename: rename,
    onOpenDetail: (id: string) => setDetailId(id),
    onSetColor: setColor,
    onStartEdit: (id: string) => setEditingId(id),
    onStopEdit: () => setEditingId(null),
  }), [addChild, addSibling, del, rename, setColor])

  // ── 키보드 (편집 중이 아닐 때) ──────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editingId) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (!selectedId) return
      if (e.key === 'Tab') { e.preventDefault(); addChild(selectedId) }
      else if (e.key === 'Enter') { e.preventDefault(); selectedId === topicId ? addChild(selectedId) : addSibling(selectedId) }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); del(selectedId) }
      else if (e.key === 'F2') { e.preventDefault(); setEditingId(selectedId) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, editingId, topicId, addChild, addSibling, del])

  // ── 레이아웃 + React Flow 노드/엣지 ────────────────────
  const pos = useMemo(() => layoutTree(topicId, nodes), [topicId, nodes])
  const parentOf = useMemo(() => new Map(nodes.map((n) => [n.id, n.parent_id])), [nodes])
  const colorOf = useMemo(() => new Map(nodes.map((n) => [n.id, n.color || DEFAULT_COLOR])), [nodes])

  const rfNodes: Node<MindNodeData>[] = useMemo(() => nodes.map((n) => ({
    id: n.id,
    type: 'mind',
    position: pos[n.id] ?? { x: 0, y: 0 },
    draggable: false,
    selected: selectedId === n.id,
    data: {
      label: n.title,
      color: n.id === topicId ? (n.color || DEFAULT_COLOR) : branchColorOf(n.id, topicId, parentOf, colorOf),
      isRoot: n.id === topicId,
      editing: editingId === n.id,
      hasContent: !!(n.content && n.content.trim()),
    },
  })), [nodes, pos, selectedId, editingId, topicId, parentOf, colorOf])

  const rfEdges: Edge[] = useMemo(() => {
    const idSet = new Set(nodes.map((n) => n.id))
    return nodes
      .filter((n) => n.parent_id && idSet.has(n.parent_id))
      .map((n) => ({
        id: `e-${n.id}`,
        source: n.parent_id as string,
        target: n.id,
        type: 'smoothstep',
        style: { stroke: paletteFor(branchColorOf(n.id, topicId, parentOf, colorOf)).line, strokeWidth: 2 },
      }))
  }, [nodes, topicId, parentOf, colorOf])

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedId(node.id)
    if (editingId && editingId !== node.id) setEditingId(null)
  }, [editingId])

  const detailNode = nodes.find((n) => n.id === detailId) ?? null

  if (loading) {
    return <div className="h-full flex items-center justify-center text-sm text-gray-400">불러오는 중...</div>
  }

  return (
    <MindCtx.Provider value={ctxValue}>
      <div className="relative h-full">
        <ReactFlow
          key={topicId}
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={() => { setSelectedId(null); setEditingId(null) }}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
          className="bg-[#fafafa]"
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#e2e8f0" />
          <Controls showInteractive={false} />
        </ReactFlow>

        {/* 도움말 */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur rounded-xl shadow-sm border border-gray-100 px-3 py-2 text-[11px] text-gray-500 leading-relaxed pointer-events-none">
          <span className="font-semibold text-gray-700">생각 뻗기</span> · 노드 선택 후{' '}
          <kbd className="px-1 bg-gray-100 rounded">Tab</kbd> 하위 ·{' '}
          <kbd className="px-1 bg-gray-100 rounded">Enter</kbd> 형제 ·{' '}
          <kbd className="px-1 bg-gray-100 rounded">더블클릭</kbd> 이름 ·{' '}
          <kbd className="px-1 bg-gray-100 rounded">⤢</kbd> 상세
        </div>

        {detailNode && (
          <ModuleDetailModal
            title={detailNode.title}
            content={detailNode.content ?? ''}
            onClose={() => setDetailId(null)}
            onSaveTitle={(t) => rename(detailNode.id, t)}
            onSaveContent={(html) => saveDetailContent(detailNode.id, html)}
          />
        )}
      </div>
    </MindCtx.Provider>
  )
}
