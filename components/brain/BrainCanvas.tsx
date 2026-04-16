'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  ReactFlow,
  Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge,
  BackgroundVariant, type Connection, type Node, type Edge,
  ReactFlowProvider, useReactFlow,
  ConnectionMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { ThoughtNode, ThoughtEdge, EdgeRelationType } from '@/lib/brain-types'
import { mapRelationType, EDGE_RELATION_CONFIG } from '@/lib/brain-types'
import {
  getCanvasNodes, getCanvasEdges, createModule, createWing,
  updateNode, updateNodePosition, deleteNode, createEdge, updateEdge, deleteEdge,
} from '@/lib/brain-api'
import { ModuleNode, type ModuleNodeData } from './ModuleNode'
import { ThoughtEdge as ThoughtEdgeComp, type ThoughtEdgeData } from './ThoughtEdge'
import { BrainCtx } from './BrainContext'

const nodeTypes = { module: ModuleNode }
const edgeTypes = { thought: ThoughtEdgeComp }

function toRFNode(n: ThoughtNode, autoFocus = false): Node<ModuleNodeData> {
  return {
    id: n.id,
    type: 'module',
    position: { x: n.pos_x, y: n.pos_y },
    data: {
      label: n.title,
      content: n.content,
      isWing: n.node_kind === 'wing',
      autoFocus,
    },
  }
}

function toRFEdge(e: ThoughtEdge): Edge<ThoughtEdgeData> {
  const relType = mapRelationType(e.relation_type)
  return {
    id: e.id,
    source: e.source_id,
    target: e.target_id,
    type: 'thought',
    data: { label: e.label ?? '', relationType: relType },
  }
}

function wingEdge(wingId: string, parentId: string): Edge<ThoughtEdgeData> {
  return {
    id: `wing-${wingId}`,
    source: parentId,
    target: wingId,
    type: 'thought',
    data: { isWingEdge: true },
    style: { pointerEvents: 'none' },
  }
}

function nodeCenter(node: Node): { x: number; y: number } {
  const isWing = (node.data as ModuleNodeData).isWing
  const w = isWing ? 80 : 150
  const h = isWing ? 80 : 64
  return { x: node.position.x + w / 2, y: node.position.y + h / 2 }
}

const PROX_THRESHOLD = 140
function findProximityTarget(dragged: Node, allNodes: Node[]): Node | null {
  const dc = nodeCenter(dragged)
  let closest: Node | null = null
  let minDist = PROX_THRESHOLD
  for (const n of allNodes) {
    if (n.id === dragged.id) continue
    const nc = nodeCenter(n)
    const dist = Math.sqrt((dc.x - nc.x) ** 2 + (dc.y - nc.y) ** 2)
    if (dist < minDist) { minDist = dist; closest = n }
  }
  return closest
}

// ─── Context Menu ─────────────────────────────────────────────
interface CtxMenu {
  x: number; y: number
  type: 'canvas' | 'node' | 'edge'
  nodeId?: string
  isWing?: boolean
  edgeId?: string
  edgeRelationType?: EdgeRelationType
  canvasPos?: { x: number; y: number }
}

// ─── Inner Canvas ─────────────────────────────────────────────
function CanvasInner({ topicId, topicTitle }: { topicId: string; topicTitle: string }) {
  const { screenToFlowPosition } = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ModuleNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<ThoughtEdgeData>>([])
  const [, setNodeDataMap] = useState<Record<string, ThoughtNode>>({})
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [ctxEdgeLabel, setCtxEdgeLabel] = useState('')
  const [proximityId, setProximityId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getCanvasNodes(topicId), getCanvasEdges(topicId)]).then(([dbNodes, dbEdges]) => {
      const map: Record<string, ThoughtNode> = {}
      dbNodes.forEach(n => { map[n.id] = n })
      setNodeDataMap(map)

      const rfNodes = dbNodes.map(n => toRFNode(n))
      const rfEdges: Edge<ThoughtEdgeData>[] = dbEdges.map(toRFEdge)
      dbNodes.filter(n => n.node_kind === 'wing').forEach(wing => {
        if (wing.parent_id) rfEdges.push(wingEdge(wing.id, wing.parent_id))
      })
      setNodes(rfNodes)
      setEdges(rfEdges)
    })
  }, [topicId])

  const nodesWithProximity = useMemo(() =>
    nodes.map(n => n.id === proximityId
      ? { ...n, style: { ...n.style, filter: 'drop-shadow(0 0 8px #6366f1)' } }
      : n
    ), [nodes, proximityId])

  const brainCtxValue = useMemo(() => ({
    onAddWing: (moduleId: string) => {
      setCtxMenu(null)
      const parentNode = nodes.find(n => n.id === moduleId)
      const px = parentNode?.position.x ?? 0
      const py = parentNode?.position.y ?? 0
      createWing(moduleId, '', px + 180, py).then(wing => {
        setNodeDataMap(m => ({ ...m, [wing.id]: wing }))
        setNodes(ns => [...ns, toRFNode(wing, true)])
        setEdges(es => [...es, wingEdge(wing.id, moduleId)])
      })
    },
    onDelete: async (nodeId: string) => {
      setCtxMenu(null)
      if (!confirm('이 모듈을 삭제할까요?')) return
      await deleteNode(nodeId)
      setNodes(ns => ns.filter(n => n.id !== nodeId))
      setEdges(es => es.filter(e => e.source !== nodeId && e.target !== nodeId && e.id !== `wing-${nodeId}`))
    },
    onUpdateTitle: async (nodeId: string, title: string) => {
      const updated = await updateNode(nodeId, { title })
      setNodeDataMap(m => ({ ...m, [nodeId]: updated }))
      setNodes(ns => ns.map(n => n.id === nodeId
        ? { ...n, data: { ...n.data, label: updated.title, autoFocus: false } }
        : n
      ))
    },
    onUpdateContent: async (nodeId: string, content: string) => {
      const updated = await updateNode(nodeId, { content })
      setNodeDataMap(m => ({ ...m, [nodeId]: updated }))
      setNodes(ns => ns.map(n => n.id === nodeId
        ? { ...n, data: { ...n.data, content: updated.content } }
        : n
      ))
    },
    onContextMenu: (nodeId: string, isWing: boolean, x: number, y: number) => {
      setCtxMenu({ x, y, type: 'node', nodeId, isWing })
    },
    onEdgeChangeType: async (edgeId: string, type: EdgeRelationType) => {
      const updated = await updateEdge(edgeId, { relation_type: type })
      setEdges(es => es.map(e => e.id === edgeId
        ? { ...e, data: { ...e.data, relationType: mapRelationType(updated.relation_type) } }
        : e
      ))
    },
    onEdgeChangeLabel: async (edgeId: string, label: string) => {
      const updated = await updateEdge(edgeId, { label })
      setEdges(es => es.map(e => e.id === edgeId
        ? { ...e, data: { ...e.data, label: updated.label ?? '' } }
        : e
      ))
    },
    onEdgeDelete: async (edgeId: string) => {
      await deleteEdge(edgeId)
      setEdges(es => es.filter(e => e.id !== edgeId))
    },
  }), [nodes, setNodes, setEdges])

  // 드래그 후 위치 저장 + 근접 자동 연결
  const dragTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleNodeDragStop = useCallback(async (_: React.MouseEvent, node: Node) => {
    if (dragTimer.current) clearTimeout(dragTimer.current)

    if (proximityId) {
      const alreadyConnected = edges.some(e =>
        (e.source === node.id && e.target === proximityId) ||
        (e.source === proximityId && e.target === node.id)
      )
      if (!alreadyConnected) {
        const dbEdge = await createEdge({
          source_id: node.id,
          target_id: proximityId,
          relation_type: 'center',
        })
        setEdges(es => addEdge({
          id: dbEdge.id,
          source: dbEdge.source_id,
          target: dbEdge.target_id,
          type: 'thought',
          data: { label: '', relationType: 'center' },
        }, es))
      }
      setProximityId(null)
    }

    dragTimer.current = setTimeout(() => {
      updateNodePosition(node.id, node.position.x, node.position.y)
    }, 400)
  }, [proximityId, edges])

  const handleNodeDrag = useCallback((_: React.MouseEvent, node: Node) => {
    const target = findProximityTarget(node, nodes)
    setProximityId(target?.id ?? null)
  }, [nodes])

  // 핸들 드래그로 연결 (floating edge라서 source/target handle 정보는 의미 없음)
  const handleConnect = useCallback(async (conn: Connection) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return
    const dbEdge = await createEdge({
      source_id: conn.source,
      target_id: conn.target,
      relation_type: 'center',
    })
    setEdges(es => addEdge({
      id: dbEdge.id,
      source: dbEdge.source_id,
      target: dbEdge.target_id,
      type: 'thought',
      data: { label: '', relationType: 'center' },
    }, es))
  }, [])

  const handlePaneContextMenu = useCallback((e: MouseEvent | React.MouseEvent) => {
    e.preventDefault()
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setCtxMenu({ x: e.clientX, y: e.clientY, type: 'canvas', canvasPos: pos })
  }, [screenToFlowPosition])

  const handleEdgeContextMenu = useCallback((e: MouseEvent | React.MouseEvent, edge: Edge) => {
    e.preventDefault()
    if ((edge.data as ThoughtEdgeData)?.isWingEdge) return
    const edgeData = (edge.data ?? {}) as ThoughtEdgeData
    setCtxEdgeLabel(edgeData.label ?? '')
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      type: 'edge', edgeId: edge.id,
      edgeRelationType: edgeData.relationType ?? 'center',
    })
  }, [])

  // Delete / Backspace 로 선택된 엣지 삭제
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const selected = edges.filter(ed => ed.selected && !(ed.data as ThoughtEdgeData)?.isWingEdge)
      if (selected.length === 0) return
      e.preventDefault()
      selected.forEach(ed => brainCtxValue.onEdgeDelete(ed.id))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [edges, brainCtxValue])

  const closeCtxMenu = useCallback(() => setCtxMenu(null), [])

  async function handleCreateModule() {
    if (!ctxMenu?.canvasPos) return
    const { x, y } = ctxMenu.canvasPos
    const node = await createModule(topicId, '', x - 75, y - 30)
    setNodeDataMap(m => ({ ...m, [node.id]: node }))
    setNodes(ns => [...ns, toRFNode(node, true)])
    setCtxMenu(null)
  }

  return (
    <BrainCtx.Provider value={brainCtxValue}>
      <div className="flex h-full min-h-0" onClick={closeCtxMenu}>
        <div className="flex-1 min-w-0 relative" style={{ height: '100%' }}>
          <ReactFlow
            nodes={nodesWithProximity}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}
            onPaneContextMenu={handlePaneContextMenu}
            onEdgeContextMenu={handleEdgeContextMenu}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={{ type: 'thought' }}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            connectionRadius={40}
            elevateEdgesOnSelect
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
            <Controls style={{ bottom: 16, left: 16 }} />
            <MiniMap
              style={{ bottom: 16, right: 16 }}
              maskColor="rgba(249,250,251,0.6)"
              nodeColor={n => (n.data as ModuleNodeData)?.isWing ? '#bae6fd' : '#cbd5e1'}
            />
          </ReactFlow>

          {/* 상단 툴바 힌트 */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full px-4 py-1.5 text-xs text-gray-600 shadow-sm flex items-center gap-3">
              <span><b>빈 공간 우클릭</b> 모듈 생성</span>
              <span className="text-gray-300">·</span>
              <span><b>+버튼 드래그</b> 연결</span>
              <span className="text-gray-300">·</span>
              <span><b>모듈 끌어 근접</b> 자동 연결</span>
              <span className="text-gray-300">·</span>
              <span><b>선 우클릭</b> 색상/내용</span>
            </div>
          </div>

          {proximityId && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <div className="bg-indigo-600 text-white rounded-full px-3 py-1 text-xs shadow-md">
                놓으면 자동 연결됩니다
              </div>
            </div>
          )}
        </div>

        {/* 컨텍스트 메뉴 */}
        {ctxMenu && (
          <div
            style={{
              position: 'fixed',
              top: ctxMenu.y,
              left: ctxMenu.x,
              zIndex: 1000,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
              padding: '4px 0',
              minWidth: 160,
            }}
            onClick={e => e.stopPropagation()}
          >
            {ctxMenu.type === 'canvas' && (
              <button
                onClick={handleCreateModule}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: '#1e293b', background: 'none', border: 'none', cursor: 'pointer' }}
                className="hover:bg-gray-50"
              >
                + 본 모듈 생성
              </button>
            )}

            {ctxMenu.type === 'node' && !ctxMenu.isWing && (
              <>
                <button
                  onClick={() => brainCtxValue.onAddWing(ctxMenu.nodeId!)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: '#1e293b', background: 'none', border: 'none', cursor: 'pointer' }}
                  className="hover:bg-gray-50"
                >
                  ◎ 날개 생성
                </button>
                <div style={{ height: 1, background: '#f1f5f9', margin: '2px 0' }} />
                <button
                  onClick={() => brainCtxValue.onDelete(ctxMenu.nodeId!)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                  className="hover:bg-red-50"
                >
                  삭제
                </button>
              </>
            )}

            {ctxMenu.type === 'node' && ctxMenu.isWing && (
              <button
                onClick={() => brainCtxValue.onDelete(ctxMenu.nodeId!)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                className="hover:bg-red-50"
              >
                삭제
              </button>
            )}

            {ctxMenu.type === 'edge' && (
              <>
                <div style={{ padding: '7px 14px 5px', fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>선 종류</div>
                {(['center', 'assist', 'negative'] as EdgeRelationType[]).map(rt => {
                  const c = EDGE_RELATION_CONFIG[rt]
                  const isActive = ctxMenu.edgeRelationType === rt
                  return (
                    <button
                      key={rt}
                      onClick={async () => {
                        await brainCtxValue.onEdgeChangeType(ctxMenu.edgeId!, rt)
                        setCtxMenu(m => m ? { ...m, edgeRelationType: rt } : null)
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        width: '100%', textAlign: 'left', padding: '7px 14px',
                        fontSize: 12, color: isActive ? c.color : '#374151',
                        background: isActive ? `${c.color}18` : 'none',
                        border: 'none', cursor: 'pointer', fontWeight: isActive ? 700 : 400,
                      }}
                      className="hover:bg-gray-50"
                    >
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, display: 'inline-block', flexShrink: 0 }} />
                      {c.label}
                    </button>
                  )
                })}
                <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />
                <div style={{ padding: '4px 10px 6px' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>선 내용</div>
                  <input
                    value={ctxEdgeLabel}
                    onChange={e => setCtxEdgeLabel(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter') {
                        await brainCtxValue.onEdgeChangeLabel(ctxMenu.edgeId!, ctxEdgeLabel)
                        setCtxMenu(null)
                      }
                      if (e.key === 'Escape') setCtxMenu(null)
                    }}
                    onBlur={async () => { await brainCtxValue.onEdgeChangeLabel(ctxMenu.edgeId!, ctxEdgeLabel) }}
                    placeholder="내용 입력 후 Enter..."
                    autoFocus
                    style={{
                      width: '100%', fontSize: 11,
                      border: '1px solid #e2e8f0', borderRadius: 6,
                      padding: '4px 8px', outline: 'none', color: '#374151',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ height: 1, background: '#f1f5f9', margin: '2px 0' }} />
                <button
                  onClick={async () => {
                    await brainCtxValue.onEdgeDelete(ctxMenu.edgeId!)
                    setCtxMenu(null)
                  }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                  className="hover:bg-red-50"
                >
                  연결 끊기
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </BrainCtx.Provider>
  )
}

export function BrainCanvas({ topicId, topicTitle }: { topicId: string; topicTitle: string }) {
  return (
    <ReactFlowProvider>
      <CanvasInner topicId={topicId} topicTitle={topicTitle} />
    </ReactFlowProvider>
  )
}
