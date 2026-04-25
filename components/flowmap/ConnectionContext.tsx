'use client'

import { createContext, useContext } from 'react'

export interface ConnectionContextValue {
  colorMap: Map<string, string>
  connectingId: string | null
  onConnectClick: (itemId: string) => void
}

export const ConnectionContext = createContext<ConnectionContextValue>({
  colorMap: new Map(),
  connectingId: null,
  onConnectClick: () => {},
})

export function useConnection() {
  return useContext(ConnectionContext)
}

export function ConnectionDot({ itemId }: { itemId: string }) {
  const { colorMap, connectingId, onConnectClick } = useConnection()
  const color = colorMap.get(itemId)
  const isActive = connectingId === itemId

  return (
    <button
      onClick={e => { e.stopPropagation(); onConnectClick(itemId) }}
      title={isActive ? '취소' : (color ? '연결 편집' : '연결 추가')}
      style={{
        width: 11, height: 11, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${isActive ? '#3b82f6' : (color ?? '#d1d5db')}`,
        backgroundColor: color && !isActive ? color : (isActive ? '#dbeafe' : 'transparent'),
        cursor: 'pointer', padding: 0,
        boxShadow: isActive ? '0 0 0 3px rgba(59,130,246,0.2)' : 'none',
        transition: 'all 0.15s',
        animation: isActive ? 'connPulse 1.2s ease-in-out infinite' : 'none',
      }}
    />
  )
}
