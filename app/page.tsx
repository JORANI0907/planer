import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { CATEGORIES, getCurrentYear, getCurrentMonth, getCurrentQuarter } from '@/lib/types'

async function getDashboardStats() {
  const year = getCurrentYear()
  const quarter = getCurrentQuarter()
  const month = getCurrentMonth()
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const quarterKey = `${year}-Q${quarter}`

  const [quarterly, monthly] = await Promise.all([
    supabase.from('plan_items').select('status, categories').eq('level', 'quarterly').eq('period_key', quarterKey),
    supabase.from('plan_items').select('status, categories').eq('level', 'monthly').eq('period_key', monthKey),
  ])

  return {
    quarterly: quarterly.data ?? [],
    monthly: monthly.data ?? [],
    year,
    quarter,
    month,
  }
}

function ProgressBar({ items }: { items: { status: string }[] }) {
  if (items.length === 0) return <div className="text-xs text-gray-400">계획 없음</div>
  const completed = items.filter(i => i.status === 'completed').length
  const inProgress = items.filter(i => i.status === 'in_progress').length
  const pct = Math.round((completed / items.length) * 100)

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>완료 {completed}/{items.length}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
        <span>진행중 {inProgress}</span>
        <span>미시작 {items.filter(i => i.status === 'pending').length}</span>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const { quarterly, monthly, year, quarter, month } = await getDashboardStats()
  const monthName = ['', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'][month]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-5 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">{year}년 {quarter}분기 · {monthName} 현황</p>
      </div>

      {/* 빠른 이동 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { href: '/decade', icon: '🚀', label: '10년 계획', desc: '큰 그림' },
          { href: `/quarterly?year=${year}`, icon: '📊', label: `${quarter}분기 계획`, desc: `${year}년` },
          { href: `/monthly?year=${year}&month=${month}`, icon: '📆', label: `${monthName} 계획`, desc: '이번달' },
          { href: '/weekly', icon: '📋', label: '주간 계획', desc: '이번주' },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all group">
            <span className="text-2xl">{item.icon}</span>
            <p className="font-semibold text-gray-900 mt-2 text-sm group-hover:text-blue-600">{item.label}</p>
            <p className="text-xs text-gray-400">{item.desc}</p>
          </Link>
        ))}
      </div>

      {/* 진행 현황 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">{quarter}분기 진행 현황</h2>
            <Link href="/quarterly" className="text-xs text-blue-500 hover:underline">전체 보기 →</Link>
          </div>
          <ProgressBar items={quarterly} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">{monthName} 진행 현황</h2>
            <Link href="/monthly" className="text-xs text-blue-500 hover:underline">전체 보기 →</Link>
          </div>
          <ProgressBar items={monthly} />
        </div>
      </div>

      {/* 카테고리별 이번달 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">이번달 카테고리별 현황</h2>
        {monthly.length === 0 ? (
          <p className="text-sm text-gray-400">이번달 계획이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {CATEGORIES.map(cat => {
              const catItems = monthly.filter(i => (i.categories as string[]).includes(cat.value))
              if (catItems.length === 0) return null
              const completed = catItems.filter(i => i.status === 'completed').length
              return (
                <div key={cat.value} className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat.color} min-w-[110px] text-center`}>
                    {cat.label}
                  </span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full"
                      style={{ width: `${(completed / catItems.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-12 text-right">{completed}/{catItems.length}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
