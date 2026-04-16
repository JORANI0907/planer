import { Position, type InternalNode, type Node } from '@xyflow/react'

// 사각형 노드의 경계에서 다른 노드 방향으로의 교차점
function rectIntersection(
  source: InternalNode,
  targetCenter: { x: number; y: number }
): { x: number; y: number } {
  const w = (source.measured.width ?? 150) / 2
  const h = (source.measured.height ?? 64) / 2
  const sx = source.internals.positionAbsolute.x + w
  const sy = source.internals.positionAbsolute.y + h
  const tx = targetCenter.x
  const ty = targetCenter.y

  const xx1 = (tx - sx) / (2 * w) - (ty - sy) / (2 * h)
  const yy1 = (tx - sx) / (2 * w) + (ty - sy) / (2 * h)
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1)
  const xx3 = a * xx1
  const yy3 = a * yy1
  return {
    x: w * (xx3 + yy3) + sx,
    y: h * (yy3 - xx3) + sy,
  }
}

// 원형 노드 경계 교차점
function circleIntersection(
  source: InternalNode,
  targetCenter: { x: number; y: number }
): { x: number; y: number } {
  const w = source.measured.width ?? 80
  const h = source.measured.height ?? 80
  const cx = source.internals.positionAbsolute.x + w / 2
  const cy = source.internals.positionAbsolute.y + h / 2
  const r = Math.min(w, h) / 2
  const dx = targetCenter.x - cx
  const dy = targetCenter.y - cy
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  return {
    x: cx + (dx / dist) * r,
    y: cy + (dy / dist) * r,
  }
}

function nodeCenter(node: InternalNode) {
  return {
    x: node.internals.positionAbsolute.x + (node.measured.width ?? 150) / 2,
    y: node.internals.positionAbsolute.y + (node.measured.height ?? 64) / 2,
  }
}

function getIntersection(node: InternalNode, targetCenter: { x: number; y: number }) {
  const isWing = (node.data as { isWing?: boolean } | undefined)?.isWing === true
  return isWing ? circleIntersection(node, targetCenter) : rectIntersection(node, targetCenter)
}

// 교차점이 노드의 어느 면에 있는지 (Top/Right/Bottom/Left)
function getEdgePosition(node: InternalNode, p: { x: number; y: number }): Position {
  const w = node.measured.width ?? 150
  const h = node.measured.height ?? 64
  const nx = node.internals.positionAbsolute.x
  const ny = node.internals.positionAbsolute.y
  const epsX = w * 0.15
  const epsY = h * 0.15
  if (p.x <= nx + epsX) return Position.Left
  if (p.x >= nx + w - epsX) return Position.Right
  if (p.y <= ny + epsY) return Position.Top
  return Position.Bottom
}

export function getEdgeParams(source: InternalNode, target: InternalNode) {
  const sc = nodeCenter(source)
  const tc = nodeCenter(target)
  const sp = getIntersection(source, tc)
  const tp = getIntersection(target, sc)
  return {
    sx: sp.x,
    sy: sp.y,
    tx: tp.x,
    ty: tp.y,
    sourcePos: getEdgePosition(source, sp),
    targetPos: getEdgePosition(target, tp),
  }
}
