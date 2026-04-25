'use client'

import { createContext, useContext } from 'react'

export interface ConnectionContextValue {
  colorMap: Map<string, string>
  connectingId: string | null
  highlightedIds: Set<string>
  onConnectClick: (itemId: string) => void
}

export const ConnectionContext = createContext<ConnectionContextValue>({
  colorMap: new Map(),
  connectingId: null,
  highlightedIds: new Set(),
  onConnectClick: () => {},
})

export function useConnection() {
  return useContext(ConnectionContext)
}

export function ConnectionDot({ itemId }: { itemId: string }) {
  const { colorMap, connectingId, highlightedIds, onConnectClick } = useConnection()
  const color = colorMap.get(itemId)
  const isActive = connectingId === itemId
  const isHighlighted = highlightedIds.has(itemId)
  const hasConn = !!color

  const borderColor = isActive ? '#3b82f6' : isHighlighted ? (color ?? '#22c55e') : (color ?? '#d1d5db')
  const bgColor = isActive ? '#dbeafe' : isHighlighted ? `${color ?? '#22c55e'}30` : (hasConn ? color : 'transparent')
  const shadow = isActive
    ? '0 0 0 3px rgba(59,130,246,0.25)'
    : isHighlighted
    ? `0 0 0 3px ${color ?? '#22c55e'}35`
    : 'none'
  const anim = isActive || isHighlighted ? 'connPulse 1.2s ease-in-out infinite' : 'none'

  return (
    <button
      data-dot-id={itemId}
      onClick={e => { e.stopPropagation(); onConnectClick(itemId) }}
      title={isActive ? '취소' : isHighlighted ? '이 항목과 연결됨 (클릭하여 연결)' : (hasConn ? '연결 편집' : '연결 추가')}
      style={{
        width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${borderColor}`,
        backgroundColor: bgColor,
        cursor: 'pointer', padding: 0,
        boxShadow: shadow,
        transition: 'all 0.15s',
        animation: anim,
      }}
    />
  )
}
