'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, User, Rocket, Map, Brain, RefreshCw, ShoppingCart, LayoutGrid, Flag } from 'lucide-react'

const navItems: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: '/', label: '대시보드', icon: <Home size={20} /> },
  { href: '/profile', label: '인적사항', icon: <User size={20} /> },
  { href: '/decade', label: '10년 계획', icon: <Rocket size={20} /> },
  { href: '/flowmap', label: '플로우맵', icon: <Map size={20} /> },
  { href: '/brain', label: '생각 확장 맵', icon: <Brain size={20} /> },
  { href: '/routine', label: '필수과업', icon: <RefreshCw size={20} /> },
  { href: '/shopping', label: '구입 관리', icon: <ShoppingCart size={20} /> },
  { href: '/split', label: '분할 보기', icon: <LayoutGrid size={20} /> },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex-col shadow-sm z-10">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Flag size={20} />
          <div>
            <h1 className="font-bold text-gray-900 text-sm leading-tight">인생 플래너</h1>
            <p className="text-xs text-gray-500 mt-0.5">푯대를 향해 나아가는 자</p>
            <p className="text-xs text-gray-400 mt-0.5">인류에 유의미한 일을 하자</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-100'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center justify-center">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

    </aside>
  )
}

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 safe-area-inset-bottom">
      <div className="flex items-stretch">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-center transition-colors min-h-[56px] ${
                isActive
                  ? 'text-blue-600'
                  : 'text-gray-400'
              }`}
            >
              <span className="flex items-center justify-center">{item.icon}</span>
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
