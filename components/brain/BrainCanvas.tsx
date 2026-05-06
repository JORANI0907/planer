'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  ReactFlow,
  Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge,
  BackgroundVariant, type Connection, type Node, type Edge,
  ReactFlowProvider, useReactFlow,
  ConnectionMode, MarkerType,
} from '@xyflow/react'
import type { ThoughtNode, ThoughtEdge, ArrowType } from '@/lib/brain-types'
import { mapRelationType, EDGE_COLORS, getEdgeColor } from '@/lib/brain-types'
import {
  getCanvasNodes, getCanvasEdges, createModule, createWing, createGroup,
  updateNode, updateNodePosition, deleteNode, deleteGroup,
  createEdge, updateEdge, deleteEdge,
  addModuleToGroup, removeModuleFromGroup, updateGroupSize, parseGroupSize,
} from '@/lib/brain-api'
import { ModuleNode, type ModuleNodeData } from './ModuleNode'
import { GroupNode, type GroupNodeData } from './GroupNode'
import { ThoughtEdge as ThoughtEdgeComp, type ThoughtEdgeData } from './ThoughtEdge'
import { BrainCtx } from './BrainContext'

const nodeTypes = { module: ModuleNode, group: GroupNode }
const edgeTypes = { thought: ThoughtEdgeComp }

// ─── Node conversion ──────────────────────────────────────────
function toRFGroupNode(n: ThoughtNode): Node<GroupNodeData> {
  const size = parseGroupSize(n.content)
  return {
    id: n.id,
    type: 'group',
    position: { x: n.pos_x, y: n.pos_y },
    style: { width: size.w, height: size.h },
    zIndex: 0,
    data: { label: n.title, isGroup: true as const },
  }
}

function toRFNode(n: ThoughtNode, groupId: string | null, autoFocus = false): Node<ModuleNodeData> {
  return {
    id: n.id,
    type: 'module',
    position: { x: n.pos_x, y: n.pos_y },
    zIndex: 1,
    data: {
      label: n.title,
      content: n.content,
      isWing: n.node_kind === 'wing',
      autoFocus,
      groupId,
    },
  }
}

function buildMarkers(arrowType: ArrowType, color: string) {
  const marker = { type: MarkerType.ArrowClosed, color, width: 20, height: 20 }
  return {
    markerEnd: (arrowType === 'forward' || arrowType === 'both') ? marker : undefined,
    markerStart: (arrowType === 'backward' || arrowType === 'both') ? marker : undefined,
  }
}

function toRFEdge(e: ThoughtEdge): Edge<ThoughtEdgeData> {
  const relType = mapRelationType(e.relation_type)
  const color = getEdgeColor(relType)
  const arrowType = (e.source_handle as ArrowType | null) ?? 'none'
  return {
    id: e.id,
    source: e.source_id,
    target: e.target_id,
    type: 'thought',
    zIndex: 2,
    ...buildMarkers(arrowType, color),
    data: { label: e.label ?? '', relationType: relType, arrowType },
  }
}

function wingEdge(wingId: string, parentId: string): Edge<ThoughtEdgeData> {
  return {
    id: `wing-${wingId}`,
    source: parentId,
    target: wingId,
    type: 'thought',
    zIndex: 2,
    data: { isWingEdge: true },
  }
}

function deduplicateEdges(edgeList: Edge<ThoughtEdgeData>[]): Edge<ThoughtEdgeData>[] {
  const seen = new Set<string>()
  return edgeList.filter(e => {
    const key = [e.source, e.target].sort().join('↔')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const GROUP_PAD = 50
const MODULE_W = 150
const MODULE_H = 80

async function fitGroupToMembers(
  groupId: string,
  memberNodes: Node[]
): Promise<{ pos: { x: number; y: number }; w: number; h: number } | null> {
  if (memberNodes.length === 0) return null
  const minX = Math.min(...memberNodes.map(n => n.position.x)) - GROUP_PAD
  const minY = Math.min(...memberNodes.map(n => n.position.y)) - GROUP_PAD - 24
  const maxX = Math.max(...memberNodes.map(n => n.position.x + MODULE_W)) + GROUP_PAD
  const maxY = Math.max(...memberNodes.map(n => n.position.y + MODULE_H)) + GROUP_PAD
  const pos = { x: minX, y: minY }
  const w = Math.max(maxX - minX, 240)
  const h = Math.max(maxY - minY, 160)
  await Promise.all([updateNodePosition(groupId, pos.x, pos.y), updateGroupSize(groupId, w, h)])
  return { pos, w, h }
}

function nodeCenter(node: Node): { x: number; y: number } {
  const isGroup = (node.data as GroupNodeData)?.isGroup
  const isWing = (node.data as ModuleNodeData).isWing
  const w = isGroup
    ? ((node.style?.width as number) ?? 360)
    : isWing ? 80 : 150
  const h = isGroup
    ? ((node.style?.height as number) ?? 260)
    : isWing ? 80 : 64
  return { x: node.position.x + w / 2, y: node.position.y + h / 2 }
}

const PROX_THRESHOLD = 140
function findProximityTarget(dragged: Node, allNodes: Node[]): Node | null {
  if ((dragged.data as GroupNodeData)?.isGroup) return null
  const dc = nodeCenter(dragged)
  let closest: Node | null = null
  let minDist = PROX_THRESHOLD
  for (const n of allNodes) {
    if (n.id === dragged.id) continue
    if ((n.data as GroupNodeData)?.isGroup) continue
    const nc = nodeCenter(n)
    const dist = Math.sqrt((dc.x - nc.x) ** 2 + (dc.y - nc.y) ** 2)
    if (dist < minDist) { minDist = dist; closest = n }
  }
  return closest
}

// 모듈이 그룹 박스 내부에 있는지 판단
function findGroupAtPosition(
  nodePos: { x: number; y: number },
  groups: Node[]
): Node | null {
  for (const g of groups) {
    const gw = (g.style?.width as number) ?? 360
    const gh = (g.style?.height as number) ?? 260
    if (
      nodePos.x > g.position.x &&
      nodePos.x < g.position.x + gw &&
      nodePos.y > g.position.y &&
      nodePos.y < g.position.y + gh
    ) return g
  }
  return null
}

// ─── Context Menu ─────────────────────────────────────────────
interface CtxMenu {
  x: number; y: number
  type: 'canvas' | 'node' | 'edge'
  nodeId?: string
  isWing?: boolean
  isGroup?: boolean
  edgeId?: string
  edgeRelationType?: string
  edgeArrowType?: ArrowType
  canvasPos?: { x: number; y: number }
}

// ─── Inner Canvas ─────────────────────────────────────────────
function CanvasInner({ topicId, topicTitle }: { topicId: string; topicTitle: string }) {
  const { screenToFlowPosition } = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ModuleNodeData | GroupNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<ThoughtEdgeData>>([])
  const [, setNodeDataMap] = useState<Record<string, ThoughtNode>>({})
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [ctxEdgeLabel, setCtxEdgeLabel] = useState('')
  const [proximityId, setProximityId] = useState<string | null>(null)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [hoverGroupId, setHoverGroupId] = useState<string | null>(null)
  const paneLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const paneLongPressFired = useRef(false)

  const joinGroup = useCallback(async (moduleId: string, groupId: string) => {
    const currentGroupId = (nodes.find(n => n.id === moduleId)?.data as ModuleNodeData)?.groupId
    if (currentGroupId === groupId) return
    await addModuleToGroup(moduleId, groupId)
    const groupMemberIds = new Set([
      groupId,
      ...nodes.filter(n => (n.data as ModuleNodeData).groupId === groupId).map(n => n.id),
    ])
    const newRFEdges: Edge<ThoughtEdgeData>[] = []
    for (const e of edges) {
      const srcMatch = e.source === moduleId
      const tgtMatch = e.target === moduleId
      if (!srcMatch && !tgtMatch) continue
      const otherId = srcMatch ? e.target : e.source
      if (groupMemberIds.has(otherId)) continue
      const alreadyExists = edges.some(ex =>
        (ex.source === groupId && ex.target === otherId) ||
        (ex.source === otherId && ex.target === groupId)
      )
      if (alreadyExists) continue
      try {
        const relType = (e.data as ThoughtEdgeData)?.relationType ?? '#94a3b8'
        const dbEdge = await createEdge({
          source_id: srcMatch ? groupId : otherId,
          target_id: srcMatch ? otherId : groupId,
          relation_type: relType,
        })
        newRFEdges.push(toRFEdge(dbEdge))
      } catch { /* skip */ }
    }
    // 그룹 크기 자동 맞춤
    const moduleNode = nodes.find(n => n.id === moduleId)
    const existingMembers = nodes.filter(n => (n.data as ModuleNodeData).groupId === groupId)
    const allMembers = moduleNode ? [...existingMembers, moduleNode] : existingMembers
    const fit = await fitGroupToMembers(groupId, allMembers)

    setNodes(ns => ns.map(n => {
      if (n.id === moduleId) return { ...n, data: { ...n.data, groupId } }
      if (fit && n.id === groupId) return { ...n, position: fit.pos, style: { ...n.style, width: fit.w, height: fit.h } }
      return n
    }))
    setEdges(es => deduplicateEdges([...es, ...newRFEdges]))
  }, [nodes, edges])

  // 그룹 드래그 시 멤버 위치 추적
  const groupDragRef = useRef<{
    groupId: string
    startPos: { x: number; y: number }
    memberStartPositions: Record<string, { x: number; y: number }>
  } | null>(null)

  useEffect(() => {
    const touch = typeof window !== 'undefined' &&
      (('ontouchstart' in window) || (navigator.maxTouchPoints ?? 0) > 0)
    setIsTouchDevice(touch)
  }, [])

  useEffect(() => {
    Promise.all([getCanvasNodes(topicId), getCanvasEdges(topicId)]).then(([dbNodes, dbEdges]) => {
      const map: Record<string, ThoughtNode> = {}
      dbNodes.forEach(n => { map[n.id] = n })
      setNodeDataMap(map)

      const groupSet = new Set(dbNodes.filter(n => n.node_kind === 'group').map(g => g.id))

      const rfNodes: Node<ModuleNodeData | GroupNodeData>[] = dbNodes.map(n => {
        if (n.node_kind === 'group') return toRFGroupNode(n)
        const groupId = n.parent_id && groupSet.has(n.parent_id) ? n.parent_id : null
        return toRFNode(n, groupId)
      })

      const rfEdges: Edge<ThoughtEdgeData>[] = dbEdges.map(toRFEdge)
      // 레거시 날개(DB 엣지 없는 경우)만 가상 엣지 추가
      dbNodes.filter(n => n.node_kind === 'wing').forEach(wing => {
        if (!wing.parent_id) return
        const hasDBEdge = rfEdges.some(e =>
          (e.source === wing.parent_id && e.target === wing.id) ||
          (e.source === wing.id && e.target === wing.parent_id)
        )
        if (!hasDBEdge) rfEdges.push(wingEdge(wing.id, wing.parent_id))
      })

      setNodes(rfNodes)
      setEdges(rfEdges)
    })
  }, [topicId])

  const nodesWithProximity = useMemo(() =>
    nodes.map(n => {
      if (n.id === proximityId) return { ...n, style: { ...n.style, filter: 'drop-shadow(0 0 8px #6366f1)' } }
      if (n.id === hoverGroupId) return { ...n, style: { ...n.style, filter: 'drop-shadow(0 0 14px #6366f1)' } }
      return n
    }), [nodes, proximityId, hoverGroupId])

  const brainCtxValue = useMemo(() => ({
    onAddWing: (moduleId: string) => {
      setCtxMenu(null)
      const parentNode = nodes.find(n => n.id === moduleId)
      const px = parentNode?.position.x ?? 0
      const py = parentNode?.position.y ?? 0
      createWing(moduleId, '', px + 180, py).then(({ wing, edge }) => {
        setNodeDataMap(m => ({ ...m, [wing.id]: wing }))
        setNodes(ns => [...ns, toRFNode(wing, null, true)])
        setEdges(es => [...es, toRFEdge(edge)])
      })
    },
    onDelete: async (nodeId: string) => {
      setCtxMenu(null)
      const target = nodes.find(n => n.id === nodeId)
      const isGroupNode = (target?.data as GroupNodeData)?.isGroup
      const label = (target?.data as ModuleNodeData | GroupNodeData | undefined)?.label || '(제목 없음)'

      if (isGroupNode) {
        if (!confirm(`"${label}" 그룹을 삭제할까요?\n그룹 안의 모듈은 캔버스에 남습니다.`)) return
        await deleteGroup(nodeId, topicId)
        setNodes(ns => ns
          .filter(n => n.id !== nodeId)
          .map(n => (n.data as ModuleNodeData).groupId === nodeId
            ? { ...n, data: { ...n.data, groupId: null } }
            : n
          )
        )
        setEdges(es => es.filter(e => e.source !== nodeId && e.target !== nodeId))
        return
      }

      const isWingNode = (target?.data as ModuleNodeData | undefined)?.isWing
      const msg = isWingNode
        ? `"${label}" 날개를 삭제할까요?`
        : `"${label}" 모듈을 삭제할까요?\n\n⚠ 연결된 날개·선도 함께 삭제되며, 되돌릴 수 없습니다.`
      if (!confirm(msg)) return
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
    onContextMenu: (nodeId: string, isWing: boolean, x: number, y: number, extra?: { isGroup?: boolean }) => {
      setCtxMenu({ x, y, type: 'node', nodeId, isWing, isGroup: extra?.isGroup })
    },
    onEdgeChangeType: async (edgeId: string, type: string) => {
      const updated = await updateEdge(edgeId, { relation_type: type })
      const newColor = getEdgeColor(mapRelationType(updated.relation_type))
      setEdges(es => es.map(e => {
        if (e.id !== edgeId) return e
        const arrowType = (e.data as ThoughtEdgeData)?.arrowType ?? 'none'
        return {
          ...e,
          ...buildMarkers(arrowType, newColor),
          data: { ...e.data, relationType: mapRelationType(updated.relation_type) },
        }
      }))
    },
    onEdgeChangeArrow: async (edgeId: string, arrowType: ArrowType) => {
      await updateEdge(edgeId, { source_handle: arrowType === 'none' ? null : arrowType })
      setEdges(es => es.map(e => {
        if (e.id !== edgeId) return e
        const color = getEdgeColor((e.data as ThoughtEdgeData)?.relationType ?? '#94a3b8')
        return { ...e, ...buildMarkers(arrowType, color), data: { ...e.data, arrowType } }
      }))
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
    onGroupResize: async (groupId: string, width: number, height: number) => {
      await updateGroupSize(groupId, width, height)
      setNodes(ns => ns.map(n => n.id === groupId
        ? { ...n, style: { ...n.style, width, height } }
        : n
      ))
    },
    onRemoveModuleFromGroup: async (moduleId: string) => {
      setCtxMenu(null)
      const oldGroupId = (nodes.find(n => n.id === moduleId)?.data as ModuleNodeData)?.groupId
      await removeModuleFromGroup(moduleId, topicId)
      const remainingMembers = nodes.filter(n =>
        (n.data as ModuleNodeData).groupId === oldGroupId && n.id !== moduleId
      )
      const fit = oldGroupId ? await fitGroupToMembers(oldGroupId, remainingMembers) : null
      setNodes(ns => ns.map(n => {
        if (n.id === moduleId) return { ...n, data: { ...n.data, groupId: null } }
        if (fit && n.id === oldGroupId) return { ...n, position: fit.pos, style: { ...n.style, width: fit.w, height: fit.h } }
        return n
      }))
    },
  }), [nodes, setNodes, setEdges, topicId])

  const dragTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleNodeDragStart = useCallback((_: React.MouseEvent, node: Node) => {
    if (!(node.data as GroupNodeData)?.isGroup) return
    const members = nodes.filter(n => (n.data as ModuleNodeData).groupId === node.id)
    groupDragRef.current = {
      groupId: node.id,
      startPos: { x: node.position.x, y: node.position.y },
      memberStartPositions: Object.fromEntries(
        members.map(m => [m.id, { x: m.position.x, y: m.position.y }])
      ),
    }
  }, [nodes])

  const handleNodeDrag = useCallback((_: React.MouseEvent, node: Node) => {
    if ((node.data as GroupNodeData)?.isGroup) {
      const ref = groupDragRef.current
      if (!ref || ref.groupId !== node.id) return
      const delta = { x: node.position.x - ref.startPos.x, y: node.position.y - ref.startPos.y }
      setNodes(ns => ns.map(n => {
        const mp = ref.memberStartPositions[n.id]
        if (!mp) return n
        return { ...n, position: { x: mp.x + delta.x, y: mp.y + delta.y } }
      }))
      return
    }
    if (!(node.data as ModuleNodeData).isWing) {
      const groups = nodes.filter(n => (n.data as GroupNodeData)?.isGroup)
      const hoverGroup = findGroupAtPosition({ x: node.position.x + 75, y: node.position.y + 32 }, groups)
      setHoverGroupId(hoverGroup?.id ?? null)
    }
    const target = findProximityTarget(node, nodes)
    setProximityId(target?.id ?? null)
  }, [nodes])

  const handleNodeDragStop = useCallback(async (_: React.MouseEvent, node: Node) => {
    if (dragTimer.current) clearTimeout(dragTimer.current)
    setHoverGroupId(null)

    const isGroupNode = (node.data as GroupNodeData)?.isGroup

    if (isGroupNode) {
      const ref = groupDragRef.current
      if (ref?.groupId === node.id) {
        const delta = { x: node.position.x - ref.startPos.x, y: node.position.y - ref.startPos.y }
        Object.entries(ref.memberStartPositions).forEach(([id, mp]) => {
          updateNodePosition(id, mp.x + delta.x, mp.y + delta.y)
        })
        groupDragRef.current = null
      }
      updateNodePosition(node.id, node.position.x, node.position.y)
      return
    }

    // 모듈 드래그 종료: 그룹 박스 가입/탈퇴 감지
    if (!(node.data as ModuleNodeData).isWing) {
      const groups = nodes.filter(n => (n.data as GroupNodeData)?.isGroup)
      const targetGroup = findGroupAtPosition({ x: node.position.x + 75, y: node.position.y + 32 }, groups)
      const currentGroupId = (node.data as ModuleNodeData).groupId

      if (targetGroup && currentGroupId !== targetGroup.id) {
        await joinGroup(node.id, targetGroup.id)
      } else if (!targetGroup && currentGroupId) {
        await removeModuleFromGroup(node.id, topicId)
        const remainingMembers = nodes.filter(n =>
          (n.data as ModuleNodeData).groupId === currentGroupId && n.id !== node.id
        )
        const fit = await fitGroupToMembers(currentGroupId, remainingMembers)
        setNodes(ns => ns.map(n => {
          if (n.id === node.id) return { ...n, data: { ...n.data, groupId: null } }
          if (fit && n.id === currentGroupId) return { ...n, position: fit.pos, style: { ...n.style, width: fit.w, height: fit.h } }
          return n
        }))
      } else if (currentGroupId) {
        // 그룹 내부에서 이동 → 그룹 크기 재맞춤
        const members = nodes
          .filter(n => (n.data as ModuleNodeData).groupId === currentGroupId)
          .map(n => n.id === node.id ? { ...n, position: node.position } : n)
        const fit = await fitGroupToMembers(currentGroupId, members)
        if (fit) {
          setNodes(ns => ns.map(n => n.id === currentGroupId
            ? { ...n, position: fit.pos, style: { ...n.style, width: fit.w, height: fit.h } }
            : n
          ))
        }
      }
    }

    // 근접 자동 연결
    if (proximityId) {
      const alreadyConnected = edges.some(e =>
        (e.source === node.id && e.target === proximityId) ||
        (e.source === proximityId && e.target === node.id)
      )
      if (!alreadyConnected) {
        const dbEdge = await createEdge({
          source_id: node.id,
          target_id: proximityId,
          relation_type: '#94a3b8',
        })
        setEdges(es => addEdge({
          id: dbEdge.id,
          source: dbEdge.source_id,
          target: dbEdge.target_id,
          type: 'thought',
          zIndex: 2,
          data: { label: '', relationType: '#94a3b8' },
        }, es))
      }
      setProximityId(null)
    }

    dragTimer.current = setTimeout(() => {
      updateNodePosition(node.id, node.position.x, node.position.y)
    }, 400)
  }, [proximityId, edges, nodes, topicId, joinGroup])

  const handleConnect = useCallback(async (conn: Connection) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return
    const dbEdge = await createEdge({
      source_id: conn.source,
      target_id: conn.target,
      relation_type: '#94a3b8',
    })
    setEdges(es => addEdge({
      id: dbEdge.id,
      source: dbEdge.source_id,
      target: dbEdge.target_id,
      type: 'thought',
      zIndex: 2,
      data: { label: '', relationType: '#94a3b8' },
    }, es))
  }, [])

  const handlePaneContextMenu = useCallback((e: MouseEvent | React.MouseEvent) => {
    e.preventDefault()
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setCtxMenu({ x: e.clientX, y: e.clientY, type: 'canvas', canvasPos: pos })
  }, [screenToFlowPosition])

  const handlePaneTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const target = e.target as HTMLElement
    if (!target.classList?.contains('react-flow__pane')) return
    const t = e.touches[0]
    const clientX = t.clientX
    const clientY = t.clientY
    paneLongPressFired.current = false
    if (paneLongPressTimer.current) clearTimeout(paneLongPressTimer.current)
    paneLongPressTimer.current = setTimeout(() => {
      paneLongPressFired.current = true
      const pos = screenToFlowPosition({ x: clientX, y: clientY })
      setCtxMenu({ x: clientX, y: clientY, type: 'canvas', canvasPos: pos })
      if (navigator.vibrate) navigator.vibrate(20)
    }, 500)
  }, [screenToFlowPosition])

  const clearPaneLongPress = useCallback(() => {
    if (paneLongPressTimer.current) {
      clearTimeout(paneLongPressTimer.current)
      paneLongPressTimer.current = null
    }
  }, [])

  const handleEdgeContextMenu = useCallback((e: MouseEvent | React.MouseEvent, edge: Edge) => {
    e.preventDefault()
    const { clientX, clientY } = e
    const edgeData = (edge.data ?? {}) as ThoughtEdgeData

    if (edgeData.isWingEdge) {
      createEdge({ source_id: edge.source, target_id: edge.target, relation_type: 'wing' }).then(dbEdge => {
        setEdges(es => es.map(ed => ed.id === edge.id
          ? { ...ed, id: dbEdge.id, zIndex: 2, data: { relationType: 'wing', label: '' } }
          : ed
        ))
        setCtxEdgeLabel('')
        setCtxMenu({ x: clientX, y: clientY, type: 'edge', edgeId: dbEdge.id, edgeRelationType: 'wing' })
      })
      return
    }

    setCtxEdgeLabel(edgeData.label ?? '')
    setCtxMenu({
      x: clientX, y: clientY,
      type: 'edge', edgeId: edge.id,
      edgeRelationType: edgeData.relationType ?? '#94a3b8',
      edgeArrowType: edgeData.arrowType ?? 'none',
    })
  }, [setEdges])

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

  async function handleCreateGroupForModule(moduleId: string) {
    setCtxMenu(null)
    const moduleNode = nodes.find(n => n.id === moduleId)
    if (!moduleNode) return
    const groupX = moduleNode.position.x - GROUP_PAD
    const groupY = moduleNode.position.y - GROUP_PAD - 24
    const groupW = MODULE_W + GROUP_PAD * 2
    const groupH = MODULE_H + GROUP_PAD * 2 + 24
    try {
      const groupDbNode = await createGroup(topicId, '그룹', groupX, groupY)
      await Promise.all([
        addModuleToGroup(moduleId, groupDbNode.id),
        updateGroupSize(groupDbNode.id, groupW, groupH),
      ])
      // 엣지 승계
      const newRFEdges: Edge<ThoughtEdgeData>[] = []
      for (const e of edges) {
        const srcMatch = e.source === moduleId
        const tgtMatch = e.target === moduleId
        if (!srcMatch && !tgtMatch) continue
        const otherId = srcMatch ? e.target : e.source
        const relType = (e.data as ThoughtEdgeData)?.relationType ?? '#94a3b8'
        try {
          const dbEdge = await createEdge({
            source_id: srcMatch ? groupDbNode.id : otherId,
            target_id: srcMatch ? otherId : groupDbNode.id,
            relation_type: relType,
          })
          newRFEdges.push(toRFEdge(dbEdge))
        } catch { /* skip */ }
      }
      const rfGroup: Node<GroupNodeData> = {
        id: groupDbNode.id,
        type: 'group',
        position: { x: groupX, y: groupY },
        style: { width: groupW, height: groupH },
        zIndex: 0,
        data: { label: '그룹', isGroup: true as const },
      }
      setNodes(ns => [rfGroup, ...ns.map(n => n.id === moduleId
        ? { ...n, data: { ...n.data, groupId: groupDbNode.id } }
        : n
      )])
      setEdges(es => deduplicateEdges([...es, ...newRFEdges]))
    } catch (err) {
      console.error('그룹 생성 실패:', err)
      alert('그룹 박스 생성에 실패했습니다.')
    }
  }

  async function handleCreateModule() {
    if (!ctxMenu?.canvasPos) return
    const { x, y } = ctxMenu.canvasPos
    const node = await createModule(topicId, '', x - 75, y - 30)
    setNodeDataMap(m => ({ ...m, [node.id]: node }))
    setNodes(ns => [...ns, toRFNode(node, null, true)])
    setCtxMenu(null)
  }

  async function handleCreateGroup() {
    if (!ctxMenu?.canvasPos) return
    const { x, y } = ctxMenu.canvasPos
    setCtxMenu(null)
    try {
      const node = await createGroup(topicId, '그룹', x - 180, y - 130)
      setNodes(ns => [...ns, toRFGroupNode(node)])
    } catch (err) {
      console.error('그룹 생성 실패:', err)
      alert('그룹 박스 생성에 실패했습니다.')
    }
  }

  return (
    <BrainCtx.Provider value={brainCtxValue}>
      <div className="flex h-full min-h-0" onClick={closeCtxMenu}>
        <div
          className="flex-1 min-w-0 relative"
          style={{ height: '100%' }}
          onTouchStart={handlePaneTouchStart}
          onTouchMove={clearPaneLongPress}
          onTouchEnd={clearPaneLongPress}
          onTouchCancel={clearPaneLongPress}
        >
          <ReactFlow
            nodes={nodesWithProximity}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onNodeDragStart={handleNodeDragStart}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}
            onPaneContextMenu={handlePaneContextMenu}
            onEdgeContextMenu={handleEdgeContextMenu}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={{ type: 'thought', zIndex: 2 }}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            connectionRadius={40}
            elevateEdgesOnSelect
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
            <Controls style={{ bottom: isTouchDevice ? 72 : 16, left: 16 }} />
            {!isTouchDevice && (
              <MiniMap
                style={{ bottom: 16, right: 16 }}
                maskColor="rgba(249,250,251,0.6)"
                nodeColor={n => {
                  if ((n.data as GroupNodeData)?.isGroup) return '#e0e7ff'
                  return (n.data as ModuleNodeData)?.isWing ? '#bae6fd' : '#cbd5e1'
                }}
              />
            )}
          </ReactFlow>

          {/* 상단 툴바 힌트 */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 max-w-[calc(100vw-1rem)] md:max-w-[calc(100vw-17rem)]">
            <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full px-3 md:px-4 py-1.5 text-[11px] md:text-xs text-gray-600 shadow-sm flex items-center gap-2 md:gap-3 overflow-x-auto whitespace-nowrap pointer-events-auto">
              <span><b>{isTouchDevice ? '빈 공간 길게 누름' : '빈 공간 우클릭'}</b> 모듈/그룹</span>
              <span className="text-gray-300">·</span>
              <span><b>+버튼 드래그</b> 연결</span>
              <span className="text-gray-300">·</span>
              <span><b>모듈→박스 드래그</b> 그룹화</span>
              <span className="text-gray-300">·</span>
              <span><b>{isTouchDevice ? '노드 길게 누름' : '노드 우클릭'}</b> 메뉴</span>
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
              top: Math.min(ctxMenu.y, window.innerHeight - 220),
              left: Math.min(ctxMenu.x, window.innerWidth - 180),
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
            {/* 캔버스 우클릭 */}
            {ctxMenu.type === 'canvas' && (
              <>
                <button
                  onClick={handleCreateModule}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: '#1e293b', background: 'none', border: 'none', cursor: 'pointer' }}
                  className="hover:bg-gray-50"
                >
                  + 본 모듈 생성
                </button>
                <div style={{ height: 1, background: '#f1f5f9', margin: '2px 0' }} />
                <button
                  onClick={handleCreateGroup}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer' }}
                  className="hover:bg-indigo-50"
                >
                  ▣ 그룹 박스 생성
                </button>
              </>
            )}

            {/* 본 모듈 우클릭 */}
            {ctxMenu.type === 'node' && !ctxMenu.isWing && !ctxMenu.isGroup && (() => {
              const moduleNode = nodes.find(n => n.id === ctxMenu.nodeId)
              const currentGroupId = (moduleNode?.data as ModuleNodeData)?.groupId
              const availableGroups = nodes.filter(n => (n.data as GroupNodeData)?.isGroup && n.id !== currentGroupId)
              return (
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
                    onClick={() => handleCreateGroupForModule(ctxMenu.nodeId!)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer' }}
                    className="hover:bg-indigo-50"
                  >
                    ▣ 새 그룹 박스 생성
                  </button>
                  {availableGroups.length > 0 && (
                    <>
                      <div style={{ height: 1, background: '#f1f5f9', margin: '2px 0' }} />
                      {availableGroups.map(g => (
                        <button
                          key={g.id}
                          onClick={() => { joinGroup(ctxMenu.nodeId!, g.id); setCtxMenu(null) }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer' }}
                          className="hover:bg-indigo-50"
                        >
                          ▣ &ldquo;{(g.data as GroupNodeData).label}&rdquo; 에 추가
                        </button>
                      ))}
                    </>
                  )}
                  {currentGroupId && (
                    <>
                      <div style={{ height: 1, background: '#f1f5f9', margin: '2px 0' }} />
                      <button
                        onClick={() => brainCtxValue.onRemoveModuleFromGroup(ctxMenu.nodeId!)}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
                        className="hover:bg-gray-50"
                      >
                        ↑ 그룹에서 제거
                      </button>
                    </>
                  )}
                  <div style={{ height: 1, background: '#f1f5f9', margin: '2px 0' }} />
                  <button
                    onClick={() => brainCtxValue.onDelete(ctxMenu.nodeId!)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                    className="hover:bg-red-50"
                  >
                    삭제
                  </button>
                </>
              )
            })()}

            {/* 날개 모듈 우클릭 */}
            {ctxMenu.type === 'node' && ctxMenu.isWing && (
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

            {/* 그룹 박스 우클릭 */}
            {ctxMenu.type === 'node' && ctxMenu.isGroup && (
              <button
                onClick={() => brainCtxValue.onDelete(ctxMenu.nodeId!)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                className="hover:bg-red-50"
              >
                그룹 삭제 (모듈 유지)
              </button>
            )}

            {/* 엣지 우클릭 */}
            {ctxMenu.type === 'edge' && (
              <>
                <div style={{ padding: '8px 12px 6px' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>선 색상</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {EDGE_COLORS.map(color => {
                      const isActive = getEdgeColor(ctxMenu.edgeRelationType ?? '') === color
                      return (
                        <button
                          key={color}
                          onClick={async () => {
                            await brainCtxValue.onEdgeChangeType(ctxMenu.edgeId!, color)
                            setCtxMenu(m => m ? { ...m, edgeRelationType: color } : null)
                          }}
                          style={{
                            width: 24, height: 24,
                            borderRadius: '50%',
                            background: color,
                            border: isActive ? '3px solid #1e293b' : '2px solid transparent',
                            outline: isActive ? `2px solid ${color}` : 'none',
                            outlineOffset: 1,
                            cursor: 'pointer',
                            padding: 0,
                            transform: isActive ? 'scale(1.15)' : 'scale(1)',
                            transition: 'transform 0.1s',
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
                <div style={{ padding: '4px 12px 6px' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 5 }}>화살표 방향</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(
                      [
                        { type: 'none' as ArrowType, symbol: '—', title: '화살표 없음' },
                        { type: 'forward' as ArrowType, symbol: '→', title: '일방향 (앞)' },
                        { type: 'backward' as ArrowType, symbol: '←', title: '일방향 (뒤)' },
                        { type: 'both' as ArrowType, symbol: '↔', title: '양방향' },
                      ]
                    ).map(opt => {
                      const isActive = (ctxMenu.edgeArrowType ?? 'none') === opt.type
                      const arrowColor = getEdgeColor(ctxMenu.edgeRelationType ?? '#94a3b8')
                      return (
                        <button
                          key={opt.type}
                          title={opt.title}
                          onClick={async () => {
                            await brainCtxValue.onEdgeChangeArrow(ctxMenu.edgeId!, opt.type)
                            setCtxMenu(m => m ? { ...m, edgeArrowType: opt.type } : null)
                          }}
                          style={{
                            width: 36, height: 26,
                            borderRadius: 6,
                            background: isActive ? arrowColor : '#f1f5f9',
                            color: isActive ? '#fff' : '#64748b',
                            border: `1.5px solid ${isActive ? arrowColor : '#e2e8f0'}`,
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 0,
                          }}
                        >
                          {opt.symbol}
                        </button>
                      )
                    })}
                  </div>
                </div>
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
