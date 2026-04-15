'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ThoughtNode, ThoughtNodeType } from '@/lib/brain-types'
import {
  getRootNodes, getChildNodes, createThoughtNode, updateThoughtNode,
} from '@/lib/brain-api'
import { MandalaGrid } from '@/components/brain/MandalaGrid'
import { NodeDetailPanel } from '@/components/brain/NodeDetailPanel'
import { BreadcrumbNav } from '@/components/brain/BreadcrumbNav'
import { RootSelector } from '@/components/brain/RootSelector'
import { AddNodeModal } from '@/components/brain/AddNodeModal'

// 그리드 포지션 → 자식 배열 인덱스 (4는 center라 제외, 0~3 → pos 0~3, 4~7 → pos 5~8)
function positionToChildIndex(pos: number): number {
  return pos < 4 ? pos : pos - 1
}

export default function BrainPage() {
  const [roots, setRoots] = useState<ThoughtNode[]>([])
  const [stack, setStack] = useState<ThoughtNode[]>([]) // drill-down 경로
  const [childNodes, setChildNodes] = useState<ThoughtNode[]>([]) // 현재 center의 자식들
  const [childrenMap, setChildrenMap] = useState<Record<string, boolean>>({}) // node → has children
  const [selectedNode, setSelectedNode] = useState<ThoughtNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [addingPosition, setAddingPosition] = useState<number | null>(null)

  const currentCenter = stack[stack.length - 1] ?? null

  // 루트 목록 로드
  useEffect(() => {
    getRootNodes().then(r => { setRoots(r); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  // 현재 center의 자식 로드
  const loadChildren = useCallback(async (center: ThoughtNode) => {
    const kids = await getChildNodes(center.id)
    setChildNodes(kids)
    // 각 자식이 하위 자식을 갖는지 체크
    const map: Record<string, boolean> = {}
    await Promise.all(
      kids.map(async k => {
        const grandkids = await getChildNodes(k.id)
        map[k.id] = grandkids.length > 0
      })
    )
    setChildrenMap(map)
  }, [])

  useEffect(() => {
    if (currentCenter) loadChildren(currentCenter)
  }, [currentCenter, loadChildren])

  // 9칸 배열 구성 (position 기준)
  const gridCells: (ThoughtNode | null)[] = Array(9).fill(null)
  if (currentCenter) {
    gridCells[4] = currentCenter
    for (const child of childNodes) {
      if (child.grid_position !== 4) {
        gridCells[child.grid_position] = child
      }
    }
  }

  // 루트 선택
  function handleSelectRoot(node: ThoughtNode) {
    setStack([node])
    setSelectedNode(null)
  }

  // 드릴다운 (한 단계 깊이)
  function handleDrillDown(node: ThoughtNode) {
    setStack(prev => [...prev, node])
    setSelectedNode(null)
    setChildNodes([])
    setChildrenMap({})
  }

  // 빵부스러기 탐색
  function handleNavigate(index: number) {
    if (index === -1) {
      setStack([])
      setSelectedNode(null)
    } else {
      setStack(prev => prev.slice(0, index + 1))
      setSelectedNode(null)
    }
  }

  // 노드 추가
  async function handleAddNode(title: string, type: ThoughtNodeType) {
    if (addingPosition === null || !currentCenter) return
    const newNode = await createThoughtNode({
      parent_id: currentCenter.id,
      title,
      type,
      grid_position: addingPosition,
      sort_order: childNodes.length,
    })
    setChildNodes(prev => [...prev, newNode])
    setAddingPosition(null)
    setSelectedNode(newNode)
  }

  // 루트 생성
  async function handleCreateRoot(title: string, type: ThoughtNodeType) {
    const newRoot = await createThoughtNode({
      parent_id: null,
      title,
      type,
      grid_position: 4,
      sort_order: roots.length,
    })
    setRoots(prev => [...prev, newRoot])
    setStack([newRoot])
  }

  // 노드 업데이트
  function handleNodeUpdated(updated: ThoughtNode) {
    // stack 내 업데이트
    setStack(prev => prev.map(n => n.id === updated.id ? updated : n))
    // 자식 목록 업데이트
    setChildNodes(prev => prev.map(n => n.id === updated.id ? updated : n))
    // 루트 업데이트
    setRoots(prev => prev.map(n => n.id === updated.id ? updated : n))
    setSelectedNode(updated)
  }

  // 노드 삭제
  function handleNodeDeleted(id: string) {
    setChildNodes(prev => prev.filter(n => n.id !== id))
    setRoots(prev => prev.filter(n => n.id !== id))
    // stack에서 삭제된 경우 상위로 이동
    const stackIdx = stack.findIndex(n => n.id === id)
    if (stackIdx !== -1) setStack(prev => prev.slice(0, stackIdx))
    setSelectedNode(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 text-sm">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="mb-4 md:mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🧠</span>
          <h1 className="text-lg font-bold text-gray-900">생각 확장 맵</h1>
        </div>
        {stack.length > 0 && (
          <BreadcrumbNav stack={stack} onNavigate={handleNavigate} />
        )}
      </div>

      {/* 본문 */}
      {stack.length === 0 ? (
        <div className="flex-1">
          <RootSelector roots={roots} onSelect={handleSelectRoot} onCreateRoot={handleCreateRoot} />
        </div>
      ) : (
        <div className="flex gap-4 md:gap-6 flex-1 min-h-0">
          {/* 만다라 캔버스 */}
          <div className="flex-1 flex flex-col items-center justify-start pt-2">
            <div className="w-full max-w-md">
              {/* 힌트 */}
              <p className="text-center text-xs text-gray-400 mb-3">
                클릭 → 편집 · 더블클릭 / ▶ → 확장 보기 · + → 새 생각 추가
              </p>
              <MandalaGrid
                centerNode={gridCells[4]!}
                children={gridCells}
                childrenMap={childrenMap}
                selectedId={selectedNode?.id ?? null}
                onSelect={setSelectedNode}
                onDrillDown={handleDrillDown}
                onAddNode={pos => setAddingPosition(pos)}
              />
            </div>

            {/* 하단 액션 */}
            <div className="mt-6 flex gap-2">
              {stack.length > 1 && (
                <button
                  onClick={() => handleNavigate(stack.length - 2)}
                  className="px-4 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  ← 상위로
                </button>
              )}
              <button
                onClick={() => handleNavigate(-1)}
                className="px-4 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                🏠 주제 목록
              </button>
            </div>
          </div>

          {/* 우측 편집 패널 */}
          {selectedNode && (
            <div className="w-72 shrink-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hidden md:flex">
              <NodeDetailPanel
                node={selectedNode}
                onUpdated={handleNodeUpdated}
                onDeleted={handleNodeDeleted}
                onClose={() => setSelectedNode(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* 모바일 편집 패널 (선택 시 하단 sheet) */}
      {selectedNode && stack.length > 0 && (
        <div className="md:hidden fixed inset-x-0 bottom-0 bg-white rounded-t-2xl border-t border-gray-200 shadow-2xl z-30 max-h-[65vh] overflow-hidden flex flex-col">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-2 mb-1 shrink-0" />
          <NodeDetailPanel
            node={selectedNode}
            onUpdated={handleNodeUpdated}
            onDeleted={handleNodeDeleted}
            onClose={() => setSelectedNode(null)}
          />
        </div>
      )}

      {/* 노드 추가 모달 */}
      {addingPosition !== null && (
        <AddNodeModal
          onConfirm={handleAddNode}
          onClose={() => setAddingPosition(null)}
        />
      )}
    </div>
  )
}
