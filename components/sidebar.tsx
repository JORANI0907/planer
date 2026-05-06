'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, User, Rocket, Map, Brain, RefreshCw,
  ShoppingCart, LayoutGrid, Flag, MoreHorizontal, X, Settings, Check,
} from 'lucide-react'

const ALL_NAV_ITEMS: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: '/', label: '대시보드', icon: <Home size={20} /> },
  { href: '/profile', label: '인적사항', icon: <User size={20} /> },
  { href: '/decade', label: '10년 계획', icon: <Rocket size={20} /> },
  { href: '/flowmap', label: '플로우맵', icon: <Map size={20} /> },
  { href: '/brain', label: '생각확장', icon: <Brain size={20} /> },
  { href: '/routine', label: '필수과업', icon: <RefreshCw size={20} /> },
  { href: '/shopping', label: '구입 관리', icon: <ShoppingCart size={20} /> },
  { href: '/split', label: '분할 보기', icon: <LayoutGrid size={20} /> },
]

const DEFAULT_BOTTOM_HREFS = ['/', '/profile', '/decade', '/flowmap']
const STORAGE_KEY = 'planner-bottom-nav-hrefs'

function useBottomNavHrefs() {
  const [hrefs, setHrefs] = useState<string[]>(DEFAULT_BOTTOM_HREFS)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as string[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHrefs(parsed.slice(0, 4))
        }
      }
    } catch {}
  }, [])

  const save = (newHrefs: string[]) => {
    const clamped = newHrefs.slice(0, 4)
    setHrefs(clamped)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped))
    } catch {}
  }

  return { hrefs, save }
}

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
        {ALL_NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
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
  const { hrefs, save } = useBottomNavHrefs()
  const [showMore, setShowMore] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editHrefs, setEditHrefs] = useState<string[]>([])

  const bottomItems = ALL_NAV_ITEMS
    .filter((item) => hrefs.includes(item.href))
    .sort((a, b) => hrefs.indexOf(a.href) - hrefs.indexOf(b.href))

  const moreItems = ALL_NAV_ITEMS.filter((item) => !hrefs.includes(item.href))

  const openEdit = () => {
    setEditHrefs([...hrefs])
    setEditMode(true)
  }

  const toggleEditItem = (href: string) => {
    if (editHrefs.includes(href)) {
      setEditHrefs(editHrefs.filter((h) => h !== href))
    } else if (editHrefs.length < 4) {
      setEditHrefs([...editHrefs, href])
    }
  }

  const saveEdit = () => {
    save(editHrefs)
    setEditMode(false)
    setShowMore(false)
  }

  const closeSheet = () => {
    setShowMore(false)
    setEditMode(false)
  }

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 safe-area-inset-bottom">
        <div className="flex items-stretch">
          {bottomItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-center transition-colors min-h-[56px] ${
                  isActive ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                <span className="flex items-center justify-center">{item.icon}</span>
                <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              </Link>
            )
          })}
          <button
            onClick={() => setShowMore(true)}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-center text-gray-400 min-h-[56px]"
          >
            <MoreHorizontal size={20} />
            <span className="text-[10px] font-medium leading-tight">더보기</span>
          </button>
        </div>
      </nav>

      {showMore && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/30"
          onClick={closeSheet}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {!editMode ? (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="font-semibold text-sm text-gray-900">더보기</span>
                  <button onClick={closeSheet} className="text-gray-400 p-1">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-2">
                  {moreItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/' && pathname.startsWith(item.href))
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeSheet}
                        className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span>{item.icon}</span>
                        {item.label}
                      </Link>
                    )
                  })}
                  <div className="border-t border-gray-100 mt-2 pt-2">
                    <button
                      onClick={openEdit}
                      className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 w-full"
                    >
                      <Settings size={20} />
                      메뉴 편집
                    </button>
                  </div>
                </div>
                <div className="h-safe-area-inset-bottom pb-2" />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <button
                    onClick={() => setEditMode(false)}
                    className="text-sm text-gray-500"
                  >
                    취소
                  </button>
                  <span className="font-semibold text-sm text-gray-900">메뉴 편집</span>
                  <button
                    onClick={saveEdit}
                    className="text-sm font-semibold text-blue-600"
                  >
                    저장
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-xs text-gray-400 px-3 py-2">
                    하단 바에 표시할 메뉴를 4개까지 선택하세요 ({editHrefs.length}/4)
                  </p>
                  {ALL_NAV_ITEMS.map((item) => {
                    const selected = editHrefs.includes(item.href)
                    const disabled = !selected && editHrefs.length >= 4
                    return (
                      <button
                        key={item.href}
                        onClick={() => !disabled && toggleEditItem(item.href)}
                        className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium w-full text-left transition-colors ${
                          selected
                            ? 'bg-blue-50 text-blue-700'
                            : disabled
                            ? 'text-gray-300'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span>{item.icon}</span>
                        <span className="flex-1">{item.label}</span>
                        {selected && <Check size={16} className="text-blue-600" />}
                      </button>
                    )
                  })}
                </div>
                <div className="h-safe-area-inset-bottom pb-2" />
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
