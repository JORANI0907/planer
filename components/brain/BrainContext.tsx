'use client'

import { createContext } from 'react'
interface BrainContextValue {
  // Node actions
  onAddWing: (moduleId: string) => void
  onDelete: (nodeId: string) => void
  onUpdateTitle: (nodeId: string, title: string) => void
  onUpdateContent: (nodeId: string, content: string) => void
  onContextMenu: (nodeId: string, isWing: boolean, x: number, y: number) => void
  // Edge actions
  onEdgeChangeType: (edgeId: string, color: string) => void
  onEdgeChangeLabel: (edgeId: string, label: string) => void
  onEdgeDelete: (edgeId: string) => void
}

export const BrainCtx = createContext<BrainContextValue>({
  onAddWing: () => {},
  onDelete: () => {},
  onUpdateTitle: () => {},
  onUpdateContent: () => {},
  onContextMenu: () => {},
  onEdgeChangeType: () => {},
  onEdgeChangeLabel: () => {},
  onEdgeDelete: () => {},
})
