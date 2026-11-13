'use client'

import { createContext } from 'react'

export interface MindCtxValue {
  onAddChild: (id: string) => void
  onAddSibling: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onOpenDetail: (id: string) => void
  onSetColor: (id: string, color: string) => void
  onStartEdit: (id: string) => void
  onStopEdit: () => void
}

export const MindCtx = createContext<MindCtxValue>({
  onAddChild: () => {},
  onAddSibling: () => {},
  onDelete: () => {},
  onRename: () => {},
  onOpenDetail: () => {},
  onSetColor: () => {},
  onStartEdit: () => {},
  onStopEdit: () => {},
})
