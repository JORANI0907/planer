'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  ReactFlow,
  Background, Controls, MiniMap, MarkerType,
  useNodesState, useEdgesState, addEdge,
  BackgroundVariant, type Connection, type Node, type Edge,
  type NodeMouseHandler, type EdgeMouseHandler,
  ReactFlowProvider, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { ThoughtNode, ThoughtEdge, ThoughtNodeType, EdgeRelationType } from '@/lib/brain-types'
import { NODE_TYPE_CONFIG } from '@/lib/brain-types'
import {
  getCanvasNodes, getCanvasEdges, createModule, createWing,
  updateNode, updateNodePosition, deleteNode, createEdge, updateEdge, deleteEdge,
} from '@/lib/brain-api'
import { ModuleNode, type ModuleNodeData } from './ModuleNode'
import { ThoughtEdge as ThoughtEdgeComp, type ThoughtEdgeData } from './ThoughtEdge'
import { NodeEditPanel, EdgeEditPanel } from './NodeEditPanel'
import { BrainCtx } from './BrainContext'

const nodeTypes = { module: ModuleNode }
const edgeTypes = { thought: ThoughtEdgeComp }

const DEFAULT_MARKER = {
  type: MarkerType.ArrowClosed,
  width: 14,
  height: 14,
  color: '#94a3b8',
}

// DB → React Flow Node 변환
function toRFNode(n: ThoughtNode): Node<ModuleNodeData> {
  return {
    id: n.id,
    type: 'module',
    position: { x: n.pos_x, y: n.pos_y },
    data: { label: n.title, nodeType: n.type, content: n.content, tags: n.tags, isWing: n.node_kind === 'wing' },
  }
}

// DB → React Flow Edge 변환
function toRFEdge(e: ThoughtEdge): Edge<ThoughtEdgeData> {
  return {
    id: e.id,
    source: e.source_id,
    target: e.target_id,
    type: 'thought',
    markerEnd: { ...DEFAULT_MARKER, color: '#6b7280' },
    data: { label: e.label ?? '', relationType: e.relation_type },
  }
}

// 날개→부모 연결 엣지 생성
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

// ─── Add Node/Wing 모달 ────────────────────────────────────────
function AddModal({ title, onConfirm, onClose }: { title: string; onConfirm: (t: string, type: ThoughtNodeType) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  const [type, setType] = useState<ThoughtNodeType>('idea')
  const NODE_TYPES: ThoughtNodeType[] = ['idea', 'logic', 'concern', 'action', 'business', 'memo']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-4">{title}</h3>
        <form onSubmit={e => { e.preventDefault(); if (text.trim()) onConfirm(text.trim(), type) }} className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {NODE_TYPES.map(t => {
              const cfg = NODE_TYPE_CONFIG[t]
              return (
                <button key={t} type="button" onClick={() => setType(t)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all"
                  style={type === t ? { backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.color } : { borderColor: '#e5e7eb', color: '#9ca3af' }}
                >
                  {cfg.icon} {cfg.label}
                </button>
              )
            })}
          </div>
          <input autoFocus value={text} onChange={e => setText(e.target.value)}
            placeholder="제목을 입력하세요..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400" />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">취소</button>
            <button type="submit" disabled={!text.trim()}
              className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: '#6366f1' }}>추가</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── 연결 모달 ─────────────────────────────────────────────────
function ConnectModal({ onConfirm, onClose }: { onConfirm: (rel: EdgeRelationType, label: string) => void; onClose: () => void }) {
  const [rel, setRel] = useState<EdgeRelationType>('related')
  const [label, setLabel] = useState('')
  const TYPES: EdgeRelationType[] = ['supports', 'contradicts', 'leads_to', 'related']
  const LABELS: Record<EdgeRelationType, string> = { supports: '지지', contradicts: '반박', leads_to: '이어짐', related: '관련' }
  const COLORS: Record<EdgeRelationType, string> = { supports: '#059669', contradicts: '#dc2626', leads_to: '#2563eb', related: '#6b7280' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xs mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-4">연결 설정</h3>
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            {TYPES.map(t => (
              <button key={t} onClick={() => setRel(t)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all"
                style={rel === t ? { backgroundColor: COLORS[t] + '15', borderColor: COLORS[t], color: COLORS[t] } : { borderColor: '#e5e7eb', color: '#6b7280' }}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[t] }} />
                {LABELS[t]}
              </button>
            ))}
          </div>
          <input value={label} onChange={e => setLabel(e.target.value)}
            placeholder="라벨 (선택)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400" />
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm border border-gray-200 text-gray-600">취소</button>
            <button onClick={() => onConfirm(rel, label)} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#6366f1' }}>연결</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Inner Canvas (ReactFlow 내부) ────────────────────────────
function CanvasInner({ topicId, topicTitle }: { topicId: string; topicTitle: string }) {
  const { screenToFlowPosition } = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ModuleNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<ThoughtEdgeData>>([])

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [nodeDataMap, setNodeDataMap] = useState<Record<string, ThoughtNode>>({})

  // 모달 상태
  const [addPos, setAddPos] = useState<{ x: number; y: number } | null>(null)
  const [wingParentId, setWingParentId] = useState<string | null>(null)
  const [pendingConn, setPendingConn] = useState<Connection | null>(null)

  // 로드
  useEffect(() => {
    Promise.all([getCanvasNodes(topicId), getCanvasEdges(topicId)]).then(([dbNodes, dbEdges]) => {
      const map: Record<string, ThoughtNode> = {}
      dbNodes.forEach(n => { map[n.id] = n })
      setNodeDataMap(map)

      const rfNodes = dbNodes.map(toRFNode)
      const rfEdges: Edge<ThoughtEdgeData>[] = dbEdges.map(toRFEdge)

      // 날개 연결선 자동 생성
      dbNodes.filter(n => n.node_kind === 'wing').forEach(wing => {
        if (wing.parent_id) rfEdges.push(wingEdge(wing.id, wing.parent_id))
      })

      setNodes(rfNodes)
      setEdges(rfEdges)
    })
  }, [topicId])

  // 컨텍스트 값
  const brainCtxValue = useMemo(() => ({
    onAddWing: (moduleId: string) => setWingParentId(moduleId),
    onDelete: async (nodeId: string) => {
      if (!confirm('이 노드를 삭제할까요?')) return
      await deleteNode(nodeId)
      setNodes(ns => ns.filter(n => n.id !== nodeId))
      setEdges(es => es.filter(e => e.source !== nodeId && e.target !== nodeId && e.id !== `wing-${nodeId}`))
      if (selectedNodeId === nodeId) setSelectedNodeId(null)
    },
  }), [selectedNodeId])

  // 드래그 후 위치 저장 (debounce)
  const dragTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    if (dragTimer.current) clearTimeout(dragTimer.current)
    dragTimer.current = setTimeout(() => {
      updateNodePosition(node.id, node.position.x, node.position.y)
    }, 400)
  }, [])

  // 빈 캔버스 더블클릭 → 모듈 추가
  const handlePaneDoubleClick = useCallback((e: React.MouseEvent) => {
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setAddPos(pos)
  }, [screenToFlowPosition])

  // 모듈 추가 확정
  async function handleAddModule(title: string, type: ThoughtNodeType) {
    if (!addPos) return
    const node = await createModule(topicId, title, type, addPos.x - 50, addPos.y - 50)
    setNodeDataMap(m => ({ ...m, [node.id]: node }))
    setNodes(ns => [...ns, toRFNode(node)])
    setAddPos(null)
  }

  // 날개 추가 확정
  async function handleAddWing(title: string, type: ThoughtNodeType) {
    if (!wingParentId) return
    const parentNode = nodes.find(n => n.id === wingParentId)
    const px = parentNode?.position.x ?? 0
    const py = parentNode?.position.y ?? 0
    const wing = await createWing(wingParentId, title, type, px + 160, py + 40)
    setNodeDataMap(m => ({ ...m, [wing.id]: wing }))
    setNodes(ns => [...ns, toRFNode(wing)])
    setEdges(es => [...es, wingEdge(wing.id, wingParentId)])
    setWingParentId(null)
  }

  // 연결선 드래그 완료
  const handleConnect = useCallback((conn: Connection) => {
    setPendingConn(conn)
  }, [])

  // 연결 확정
  async function confirmConnect(rel: EdgeRelationType, label: string) {
    if (!pendingConn) return
    const dbEdge = await createEdge({
      source_id: pendingConn.source!,
      target_id: pendingConn.target!,
      relation_type: rel,
      label: label || undefined,
      source_handle: pendingConn.sourceHandle ?? 'right',
      target_handle: pendingConn.targetHandle ?? 'left',
    })
    setEdges(es => addEdge({
      id: dbEdge.id,
      source: dbEdge.source_id,
      target: dbEdge.target_id,
      type: 'thought',
      markerEnd: DEFAULT_MARKER,
      data: { label: dbEdge.label ?? '', relationType: dbEdge.relation_type },
    }, es))
    setPendingConn(null)
  }

  // 노드 클릭
  const handleNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedNodeId(node.id)
    setSelectedEdgeId(null)
  }, [])

  // 엣지 클릭
  const handleEdgeClick: EdgeMouseHandler = useCallback((_, edge) => {
    if ((edge.data as ThoughtEdgeData)?.isWingEdge) return
    setSelectedEdgeId(edge.id)
    setSelectedNodeId(null)
  }, [])

  // 빈 곳 클릭 → 선택 해제
  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
  }, [])

  // 노드 저장
  async function handleSaveNode(id: string, updates: { title: string; content: string; type: ThoughtNodeType; tags: string[] }) {
    const updated = await updateNode(id, updates)
    setNodeDataMap(m => ({ ...m, [id]: updated }))
    setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, label: updated.title, nodeType: updated.type, content: updated.content, tags: updated.tags } } : n))
  }

  // 엣지 저장
  async function handleSaveEdge(id: string, updates: { label: string; relation_type: EdgeRelationType }) {
    const updated = await updateEdge(id, updates)
    setEdges(es => es.map(e => e.id === id ? { ...e, data: { ...e.data, label: updated.label ?? '', relationType: updated.relation_type } } : e))
  }

  // 엣지 삭제
  async function handleDeleteEdge(id: string) {
    await deleteEdge(id)
    setEdges(es => es.filter(e => e.id !== id))
    setSelectedEdgeId(null)
  }

  const selectedNodeData = selectedNodeId ? nodeDataMap[selectedNodeId] : null
  const selectedEdge = selectedEdgeId ? edges.find(e => e.id === selectedEdgeId) : null
  const showPanel = !!(selectedNodeData || selectedEdge)

  return (
    <BrainCtx.Provider value={brainCtxValue}>
      <div className="flex h-full min-h-0">
        {/* 캔버스 */}
        <div className="flex-1 min-w-0 relative" style={{ height: '100%' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onNodeDragStop={handleNodeDragStop}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onPaneClick={handlePaneClick}
            onDoubleClick={handlePaneDoubleClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: 'thought', markerEnd: DEFAULT_MARKER }}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
            <Controls style={{ bottom: 16, left: 16 }} />
            <MiniMap
              style={{ bottom: 16, right: showPanel ? 308 : 16 }}
              nodeColor={n => {
                const d = n.data as ModuleNodeData
                return NODE_TYPE_CONFIG[d.nodeType]?.bg ?? '#e5e7eb'
              }}
              maskColor="rgba(249,250,251,0.6)"
            />
          </ReactFlow>

          {/* 힌트 오버레이 */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full px-4 py-1.5 text-xs text-gray-500 shadow-sm">
              더블클릭으로 모듈 추가 · 핸들 드래그로 연결 · 드래그로 이동
            </div>
          </div>
        </div>

        {/* 우측 편집 패널 */}
        {showPanel && (
          <div className="w-72 shrink-0 bg-white border-l border-gray-200 shadow-md flex flex-col overflow-hidden">
            {selectedNodeData && (
              <NodeEditPanel
                id={selectedNodeData.id}
                title={selectedNodeData.title}
                content={selectedNodeData.content}
                nodeType={selectedNodeData.type}
                tags={selectedNodeData.tags}
                onSave={handleSaveNode}
                onClose={() => setSelectedNodeId(null)}
              />
            )}
            {selectedEdge && (
              <EdgeEditPanel
                id={selectedEdge.id}
                label={(selectedEdge.data as ThoughtEdgeData)?.label ?? null}
                relationType={(selectedEdge.data as ThoughtEdgeData)?.relationType ?? 'related'}
                onSave={handleSaveEdge}
                onDelete={handleDeleteEdge}
                onClose={() => setSelectedEdgeId(null)}
              />
            )}
          </div>
        )}
      </div>

      {/* 모달들 */}
      {addPos && <AddModal title="새 모듈 추가" onConfirm={handleAddModule} onClose={() => setAddPos(null)} />}
      {wingParentId && <AddModal title="날개 추가" onConfirm={handleAddWing} onClose={() => setWingParentId(null)} />}
      {pendingConn && <ConnectModal onConfirm={confirmConnect} onClose={() => setPendingConn(null)} />}
    </BrainCtx.Provider>
  )
}

// ─── Export: ReactFlowProvider 래핑 ───────────────────────────
export function BrainCanvas({ topicId, topicTitle }: { topicId: string; topicTitle: string }) {
  return (
    <ReactFlowProvider>
      <CanvasInner topicId={topicId} topicTitle={topicTitle} />
    </ReactFlowProvider>
  )
}
