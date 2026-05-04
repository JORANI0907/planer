'use client'

import { createContext, useContext } from 'react'
import type { PlanConnection } from '@/lib/plan-connections'

export interface ConnectionContextValue {
  colorMap: Map<string, string>
  connectingId: string | null
  highlightedIds: Set<string>
  onConnectClick: (itemId: string) => void
  connections: PlanConnection[]
}

export const ConnectionContext = createContext<ConnectionContextValue>({
  colorMap: new Map(),
  connectingId: null,
  highlightedIds: new Set(),
  onConnectClick: () => {},
  connections: [],
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

  // 연결 모드: 원형 점 대신 텍스트 버튼으로 교체해 클릭하기 쉽게
  if (connectingId && !isActive) {
    return (
      <button
        data-dot-id={itemId}
        onClick={e => { e.stopPropagation(); onConnectClick(itemId) }}
        title={isHighlighted ? '연결 해제' : '이 항목과 연결'}
        style={{
          padding: '1px 6px', borderRadius: 8, flexShrink: 0,
          fontSize: 9, fontWeight: 700, cursor: 'pointer', lineHeight: 1.4,
          whiteSpace: 'nowrap', transition: 'all 0.1s',
          border: `1.5px solid ${isHighlighted ? '#ef4444' : '#16a34a'}`,
          backgroundColor: isHighlighted ? '#fff1f2' : '#f0fdf4',
          color: isHighlighted ? '#ef4444' : '#16a34a',
        }}
      >
        {isHighlighted ? '✕ 해제' : '+ 연결'}
      </button>
    )
  }

  const borderColor = isActive ? '#3b82f6' : (color ?? '#d1d5db')
  const bgColor = isActive ? '#dbeafe' : (hasConn ? color : 'transparent')
  const anim = isActive ? 'connPulse 1.2s ease-in-out infinite' : 'none'

  return (
    <button
      data-dot-id={itemId}
      onClick={e => { e.stopPropagation(); onConnectClick(itemId) }}
      title={isActive ? '취소 (다시 클릭)' : hasConn ? '연결 관리' : '연결 추가'}
      style={{
        width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${borderColor}`,
        backgroundColor: bgColor,
        cursor: 'pointer', padding: 0,
        boxShadow: isActive ? '0 0 0 3px rgba(59,130,246,0.25)' : 'none',
        transition: 'all 0.15s',
        animation: anim,
      }}
    />
  )
}
