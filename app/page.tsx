'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getPlanItems } from '@/lib/api'
import { getPendingCount } from '@/lib/shopping-api'
import { getCurrentYear, getCurrentQuarter, getCurrentMonth } from '@/lib/types'
import type { PlanItem } from '@/lib/types'
import DailyPage from './daily/page'
import { DashboardItemCard } from '@/components/flowmap/FlowTreeView'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

function fmtPeriod(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

type Period = 'annual' | 'quarterly' | 'monthly' | 'daily'

// ── 기간별 계획 목록 뷰어 ─────────────────────────────────────

function PeriodPlanSection({ period, periodKey, year, quarter, month }: {
  period: Exclude<Period, 'daily'>
  periodKey: string
  year: number
  quarter: number
  month: number
}) {
  const [items, setItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedItem, setCopiedItem] = useState<PlanItem | null>(null)

  useEffect(() => {
    setLoading(true)
    getPlanItems(period, periodKey)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period, periodKey])

  const sectionTitle =
    period === 'annual' ? `${year}년 연간 계획` :
    period === 'quarterly' ? `${year}년 ${quarter}분기 계획` :
    `${year}년 ${month}월 계획`

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
        <div className="w-7 h-7 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-sm">불러오는 중...</span>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-700">{sectionTitle}</h2>
        <span className="text-xs text-gray-400">{items.length}개</span>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-gray-500 font-medium text-sm">등록된 계획이 없습니다</p>
          <p className="text-xs text-gray-400 mt-1">플로우맵에서 계획을 추가하세요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <DashboardItemCard
              key={item.id}
              item={item}
              isSelected={false}
              showProgress={period === 'annual'}
              onSelect={() => {}}
              onUpdated={updated => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
              onDeleted={deleted => setItems(prev => prev.filter(i => i.id !== deleted.id))}
              onCopy={setCopiedItem}
            />
          ))}
        </div>
      )}

      {copiedItem && (
        <div style={{
          position: 'fixed', bottom: 56, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#1e293b', color: '#fff', padding: '8px 16px', borderRadius: 10,
          fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 50, maxWidth: 400,
        }}>
          <span>📋</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            &quot;{copiedItem.title}&quot; 복사됨
          </span>
          <button onClick={() => setCopiedItem(null)}
            style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 10 }}>
            취소
          </button>
        </div>
      )}
    </div>
  )
}

// ── 메인 대시보드 ────────────────────────────────────────────

export default function DashboardPage() {
  const today = new Date()
  const year = getCurrentYear()
  const quarter = getCurrentQuarter()
  const month = getCurrentMonth()
  const dayName = DAY_NAMES[today.getDay()]

  const [aStats, setAStats] = useState({ total: 0, done: 0 })
  const [qStats, setQStats] = useState({ total: 0, done: 0 })
  const [mStats, setMStats] = useState({ total: 0, done: 0 })
  const [dStats, setDStats] = useState({ total: 0, done: 0 })
  const [shoppingPending, setShoppingPending] = useState(0)
  const [showTop, setShowTop] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('daily')

  useEffect(() => {
    const aKey = `${year}`
    const qKey = `${year}-Q${quarter}`
    const mKey = `${year}-${String(month).padStart(2, '0')}`
    const dKey = fmtPeriod(today)

    Promise.all([
      getPlanItems('annual', aKey),
      getPlanItems('quarterly', qKey),
      getPlanItems('monthly', mKey),
      getPlanItems('daily', dKey),
    ]).then(([a, q, m, d]) => {
      setAStats({ total: a.length, done: a.filter(i => i.status === 'completed').length })
      setQStats({ total: q.length, done: q.filter(i => i.status === 'completed').length })
      setMStats({ total: m.length, done: m.filter(i => i.status === 'completed').length })
      setDStats({ total: d.length, done: d.filter(i => i.status === 'completed').length })
    }).catch(() => {})

    getPendingCount().then(setShoppingPending).catch(() => {})
  }, [])

  const aPct = aStats.total ? Math.round((aStats.done / aStats.total) * 100) : 0
  const qPct = qStats.total ? Math.round((qStats.done / qStats.total) * 100) : 0
  const mPct = mStats.total ? Math.round((mStats.done / mStats.total) * 100) : 0
  const dPct = dStats.total ? Math.round((dStats.done / dStats.total) * 100) : 0

  const periodKey =
    selectedPeriod === 'annual' ? `${year}` :
    selectedPeriod === 'quarterly' ? `${year}-Q${quarter}` :
    `${year}-${String(month).padStart(2, '0')}`

  return (
    <div className="max-w-2xl mx-auto">

      {/* 인사 헤더 */}
      <div className="mb-4">
        <p className="text-sm text-gray-400 mb-1">
          {year}년 {month}월 {today.getDate()}일 {dayName}요일 · {quarter}분기
        </p>
        <h1 className="text-2xl font-bold text-gray-900">오늘 하루도 화이팅! 🚩</h1>
        <p className="text-sm text-gray-500 mt-1">푯대를 향해 한 걸음씩 나아가고 있습니다</p>
      </div>

      {/* 진행률 & 메뉴 토글 */}
      <button
        onClick={() => setShowTop(v => !v)}
        className="w-full flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-2.5 mb-4 hover:bg-gray-50 transition-colors"
        aria-expanded={showTop}
      >
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          진행률 & 메뉴
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          {showTop ? '접기' : '펼치기'}
          <span className={`transition-transform ${showTop ? 'rotate-180' : ''}`}>▾</span>
        </span>
      </button>

      {showTop && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <NavCard href="/flowmap" icon="🗺️" title="플로우맵" desc="전체 계획 한눈에" color="#3b82f6" />
          <NavCard href="/decade" icon="🚀" title="10년 계획" desc="장기 비전 & 목표" color="#8b5cf6" />
          <NavCard href="/brain" icon="🧠" title="생각 확장 맵" desc="아이디어 연결하기" color="#06b6d4" />
          <NavCard href="/daily" icon="✅" title="일일 계획" desc="오늘 할 일 관리" color="#22c55e" />
          <NavCard
            href="/shopping"
            icon="🛒"
            title="구입 관리"
            desc={shoppingPending > 0 ? `구입 예정 ${shoppingPending}건` : '필요한 물건 목록'}
            color="#f59e0b"
            badge={shoppingPending > 0 ? shoppingPending : undefined}
          />
        </div>
      )}

      {/* 진행률 게이지 + 기간 선택 버튼 4개 */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatButton
          label="연간" pct={aPct} done={aStats.done} total={aStats.total} color="#6366f1"
          isActive={selectedPeriod === 'annual'}
          onClick={() => setSelectedPeriod('annual')}
        />
        <StatButton
          label={`${quarter}분기`} pct={qPct} done={qStats.done} total={qStats.total} color="#3b82f6"
          isActive={selectedPeriod === 'quarterly'}
          onClick={() => setSelectedPeriod('quarterly')}
        />
        <StatButton
          label={`${month}월`} pct={mPct} done={mStats.done} total={mStats.total} color="#8b5cf6"
          isActive={selectedPeriod === 'monthly'}
          onClick={() => setSelectedPeriod('monthly')}
        />
        <StatButton
          label="오늘" pct={dPct} done={dStats.done} total={dStats.total} color="#22c55e"
          isActive={selectedPeriod === 'daily'}
          onClick={() => setSelectedPeriod('daily')}
        />
      </div>

      {/* 기간별 계획 섹션 */}
      <div className="mt-2">
        {selectedPeriod === 'daily' ? (
          <DailyPage />
        ) : (
          <PeriodPlanSection
            period={selectedPeriod}
            periodKey={periodKey}
            year={year}
            quarter={quarter}
            month={month}
          />
        )}
      </div>
    </div>
  )
}

// ── 진행률 게이지 버튼 ────────────────────────────────────────

function StatButton({ label, pct, done, total, color, isActive, onClick }: {
  label: string; pct: number; done: number; total: number; color: string
  isActive: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border text-center p-3 w-full transition-all hover:shadow-sm"
      style={{
        borderColor: isActive ? color : '#e5e7eb',
        boxShadow: isActive ? `0 0 0 2px ${color}28` : 'none',
      }}
    >
      <div className="text-xs text-gray-500 mb-1.5 truncate">{label}</div>
      <div className="text-xl font-bold mb-1.5" style={{ color }}>{pct}%</div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mx-1">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="text-xs text-gray-400 mt-1.5">{done}/{total}</div>
    </button>
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
