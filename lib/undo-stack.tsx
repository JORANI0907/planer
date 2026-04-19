'use client'

import { createContext, useContext, useState, useCallback } from 'react'

export type UndoEntry = {
  id: string
  label: string
  timestamp: number
  restore: () => Promise<void>
}

type UndoContextValue = {
  stack: UndoEntry[]
  push: (entry: Omit<UndoEntry, 'id' | 'timestamp'>) => void
  undoLatest: () => Promise<boolean>
  dismiss: (id: string) => void
  undoing: boolean
}

const MAX_STACK = 3

const UndoCtx = createContext<UndoContextValue | null>(null)

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<UndoEntry[]>([])
  const [undoing, setUndoing] = useState(false)

  const push = useCallback((entry: Omit<UndoEntry, 'id' | 'timestamp'>) => {
    const id = `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setStack(prev => [{ ...entry, id, timestamp: Date.now() }, ...prev].slice(0, MAX_STACK))
  }, [])

  const undoLatest = useCallback(async () => {
    const latest = stack[0]
    if (!latest || undoing) return false
    setUndoing(true)
    try {
      await latest.restore()
      setStack(prev => prev.filter(e => e.id !== latest.id))
      return true
    } catch (err) {
      console.error('[undo]', err)
      alert('되돌리기에 실패했습니다. 이미 다른 항목을 변경했거나 관련 데이터가 없을 수 있습니다.')
      setStack(prev => prev.filter(e => e.id !== latest.id))
      return false
    } finally {
      setUndoing(false)
    }
  }, [stack, undoing])

  const dismiss = useCallback((id: string) => {
    setStack(prev => prev.filter(e => e.id !== id))
  }, [])

  return (
    <UndoCtx.Provider value={{ stack, push, undoLatest, dismiss, undoing }}>
      {children}
    </UndoCtx.Provider>
  )
}

export function useUndo(): UndoContextValue {
  const ctx = useContext(UndoCtx)
  if (!ctx) {
    // Fallback: allow components to be used outside provider (no-op)
    return {
      stack: [],
      push: () => {},
      undoLatest: async () => false,
      dismiss: () => {},
      undoing: false,
    }
  }
  return ctx
}
