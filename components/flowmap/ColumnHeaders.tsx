'use client'

import type { PlanLevel } from '@/lib/types'
import { getColumnX, NODE_WIDTH, LEVEL_LABEL } from '@/lib/flowmap-layout'

const LEVELS: PlanLevel[] = ['annual', 'quarterly', 'monthly', 'weekly', 'daily']

const LEVEL_COLORS: Record<PlanLevel, string> = {
  annual: '#3b82f6',
  quarterly: '#8b5cf6',
  monthly: '#06b6d4',
  weekly: '#10b981',
  daily: '#f59e0b',
}

interface ColumnHeadersProps {
  visibleLevels: PlanLevel[]
}

export function ColumnHeaders({ visibleLevels }: ColumnHeadersProps) {
  return (
    <>
      {LEVELS.filter((l) => visibleLevels.includes(l)).map((level) => {
        const x = getColumnX(level)
        const width = NODE_WIDTH[level]
        const color = LEVEL_COLORS[level]

        return (
          <div
            key={level}
            style={{
              position: 'absolute',
              left: x,
              top: 0,
              width,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: color,
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#374151',
                letterSpacing: '0.03em',
              }}
            >
              {LEVEL_LABEL[level]} 계획
            </span>
          </div>
        )
      })}

      {/* Divider line */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 40,
          right: 0,
          height: 1,
          backgroundColor: '#e5e7eb',
        }}
      />
    </>
  )
}
