'use client'

import { createContext } from 'react'
import type { ArrowType } from '@/lib/brain-types'

interface BrainContextValue {
  // Node actions
  onAddWing: (moduleId: string) => void
  onDelete: (nodeId: string) => void
  onUpdateTitle: (nodeId: string, title: string) => void
  onUpdateContent: (nodeId: string, content: string) => void
  onContextMenu: (nodeId: string, isWing: boolean, x: number, y: number, extra?: { isGroup?: boolean }) => void
  // Edge actions
  onEdgeChangeType: (edgeId: string, color: string) => void
  onEdgeChangeLabel: (edgeId: string, label: string) => void
  onEdgeChangeArrow: (edgeId: string, arrowType: ArrowType) => void
  onEdgeDelete: (edgeId: string) => void
  // Group actions
  onGroupResize: (groupId: string, width: number, height: number) => void
  onRemoveModuleFromGroup: (moduleId: string) => void
}

export const BrainCtx = createContext<BrainContextValue>({
  onAddWing: () => {},
  onDelete: () => {},
  onUpdateTitle: () => {},
  onUpdateContent: () => {},
  onContextMenu: () => {},
  onEdgeChangeType: () => {},
  onEdgeChangeLabel: () => {},
  onEdgeChangeArrow: () => {},
  onEdgeDelete: () => {},
  onGroupResize: () => {},
  onRemoveModuleFromGroup: () => {},
})
