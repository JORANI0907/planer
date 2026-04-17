'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getPlanItems } from '@/lib/api'
import { getPendingCount } from '@/lib/shopping-api'
import { getCurrentYear, getCurrentQuarter, getCurrentMonth } from '@/lib/types'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

function fmtPeriod(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function DashboardPage() {
  const today = new Date()
  const year = getCurrentYear()
  const quarter = getCurrentQuarter()
  const month = getCurrentMonth()
  const dayName = DAY_NAMES[today.getDay()]

  const [qStats, setQStats] = useState({ total: 0, done: 0 })
  const [mStats, setMStats] = useState({ total: 0, done: 0 })
  const [dStats, setDStats] = useState({ total: 0, done: 0 })
  const [shoppingPending, setShoppingPending] = useState(0)

  useEffect(() => {
    const qKey = `${year}-Q${quarter}`
    const mKey = `${year}-${String(month).padStart(2, '0')}`
    const dKey = fmtPeriod(today)

    Promise.all([
      getPlanItems('quarterly', qKey),
      getPlanItems('monthly', mKey),
      getPlanItems('daily', dKey),
    ]).then(([q, m, d]) => {
      setQStats({ total: q.length, done: q.filter(i => i.status === 'completed').length })
      setMStats({ total: m.length, done: m.filter(i => i.status === 'completed').length })
      setDStats({ total: d.length, done: d.filter(i => i.status === 'completed').length })
    }).catch(() => {})

    getPendingCount().then(setShoppingPending).catch(() => {})
  }, [])

  const qPct = qStats.total ? Math.round((qStats.done / qStats.total) * 100) : 0
  const mPct = mStats.total ? Math.round((mStats.done / mStats.total) * 100) : 0
  const dPct = dStats.total ? Math.round((dStats.done / dStats.total) * 100) : 0

  return (
    <div className="max-w-2xl mx-auto">

      {/* 인사 헤더 */}
      <div className="mb-6">
        <p className="text-sm text-gray-400 mb-1">
          {year}년 {month}월 {today.getDate()}일 {dayName}요일 · {quarter}분기
        </p>
        <h1 className="text-2xl font-bold text-gray-900">오늘 하루도 화이팅! 🚩</h1>
        <p className="text-sm text-gray-500 mt-1">푯대를 향해 한 걸음씩 나아가고 있습니다</p>
      </div>

      {/* 진행률 카드 3개 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label={`${quarter}분기`} pct={qPct} done={qStats.done} total={qStats.total} color="#3b82f6" />
        <StatCard label={`${month}월`}     pct={mPct} done={mStats.done} total={mStats.total} color="#8b5cf6" />
        <StatCard label="오늘"             pct={dPct} done={dStats.done} total={dStats.total} color="#22c55e" />
      </div>

      {/* 메인 메뉴 카드 */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <NavCard
          href="/flowmap"
          icon="🗺️"
          title="플로우맵"
          desc="전체 계획 한눈에"
          color="#3b82f6"
        />
        <NavCard
          href="/decade"
          icon="🚀"
          title="10년 계획"
          desc="장기 비전 & 목표"
          color="#8b5cf6"
        />
        <NavCard
          href="/brain"
          icon="🧠"
          title="생각 확장 맵"
          desc="아이디어 연결하기"
          color="#06b6d4"
        />
        <NavCard
          href="/daily"
          icon="✅"
          title="일일 계획"
          desc="오늘 할 일 관리"
          color="#22c55e"
        />
        <NavCard
          href="/shopping"
          icon="🛒"
          title="구입 관리"
          desc={shoppingPending > 0 ? `구입 예정 ${shoppingPending}건` : '필요한 물건 목록'}
          color="#f59e0b"
          badge={shoppingPending > 0 ? shoppingPending : undefined}
        />
      </div>

      {/* 플래너 레벨 바로가기 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
        <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">플래너 바로가기</p>
        <div className="flex flex-wrap gap-2">
          {[
            { href: '/quarterly', label: '분기 계획' },
            { href: '/monthly',   label: '월간 계획' },
            { href: '/weekly',    label: '주간 계획' },
            { href: '/daily',     label: '일일 계획' },
            { href: '/profile',   label: '인적사항' },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}

// ── 진행률 카드 ──────────────────────────────────────────────

function StatCard({ label, pct, done, total, color }: {
  label: string; pct: number; done: number; total: number; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
      <div className="text-xs text-gray-500 mb-1.5">{label}</div>
      <div className="text-xl font-bold mb-1.5" style={{ color }}>{pct}%</div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mx-1">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="text-xs text-gray-400 mt-1.5">{done}/{total}</div>
    </div>
  )
}

// ── 메뉴 카드 ────────────────────────────────────────────────

function NavCard({ href, icon, title, desc, color, badge }: {
  href: string; icon: string; title: string; desc: string; color: string; badge?: number
}) {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4 hover:border-transparent hover:shadow-md transition-all"
      style={{ ['--hover-color' as string]: color }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-colors"
        style={{ backgroundColor: color + '18' }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 group-hover:text-gray-900">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{desc}</p>
      </div>
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute top-2 right-2 min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
          style={{ backgroundColor: color }}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}
