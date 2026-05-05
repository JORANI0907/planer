'use client'

import { useEffect, useState } from 'react'
import { Flag } from 'lucide-react'

export function OpeningAnimation() {
  const [phase, setPhase] = useState<'enter' | 'burst' | 'exit' | 'done'>('enter')

  useEffect(() => {
    // 이미 본 경우 스킵
    if (sessionStorage.getItem('opening-shown')) {
      setPhase('done')
      return
    }

    const t1 = setTimeout(() => setPhase('burst'), 700)
    const t2 = setTimeout(() => setPhase('exit'), 1400)
    const t3 = setTimeout(() => {
      setPhase('done')
      sessionStorage.setItem('opening-shown', '1')
    }, 1900)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  if (phase === 'done') return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: 'radial-gradient(circle at center, #1e1b4b 0%, #0f172a 100%)',
        opacity: phase === 'exit' ? 0 : 1,
        transition: phase === 'exit' ? 'opacity 0.5s ease-out' : 'none',
        pointerEvents: phase === 'exit' ? 'none' : 'all',
      }}
    >
      {/* 폭발 파티클 */}
      {phase === 'burst' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {Array.from({ length: 16 }, (_, i) => {
            const angle = (i / 16) * 360
            const dist = 80 + Math.random() * 60
            const size = 4 + Math.random() * 6
            const colors = ['#818cf8', '#a78bfa', '#60a5fa', '#f472b6', '#34d399', '#fbbf24']
            const color = colors[i % colors.length]
            const rad = (angle * Math.PI) / 180
            const tx = Math.cos(rad) * dist
            const ty = Math.sin(rad) * dist
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  backgroundColor: color,
                  transform: `translate(${tx}px, ${ty}px) scale(0)`,
                  animation: `burst-particle 0.6s ease-out forwards`,
                  animationDelay: `${i * 15}ms`,
                }}
              />
            )
          })}
        </div>
      )}

      {/* 중앙 콘텐츠 */}
      <div
        className="flex flex-col items-center gap-4 text-center"
        style={{
          transform: phase === 'burst' ? 'scale(1.08)' : phase === 'enter' ? 'scale(0.85)' : 'scale(1)',
          opacity: phase === 'enter' ? 0 : 1,
          transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
        }}
      >
        <div
          style={{
            filter: phase === 'burst' ? 'drop-shadow(0 0 24px #818cf8)' : 'none',
            transition: 'filter 0.3s',
          }}
        >
          <Flag size={64} />
        </div>
        <div>
          <p className="text-white font-bold text-xl tracking-wide">인생 플래너</p>
          <p className="text-indigo-300 text-sm mt-1">푯대를 향해 나아가는 자</p>
          <p className="text-indigo-400/70 text-xs mt-0.5">인류에 유의미한 일을 하자</p>
        </div>
      </div>

      <style>{`
        @keyframes burst-particle {
          0%   { transform: translate(0,0) scale(0); opacity: 1; }
          60%  { opacity: 1; }
          100% { transform: translate(var(--tx, 80px), var(--ty, 80px)) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
