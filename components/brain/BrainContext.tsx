'use client'

import { createContext } from 'react'

interface BrainContextValue {
  onAddWing: (moduleId: string) => void
  onDelete: (nodeId: string) => void
}

export const BrainCtx = createContext<BrainContextValue>({
  onAddWing: () => {},
  onDelete: () => {},
})
