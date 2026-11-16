'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, User, Rocket, Map, Brain, RefreshCw, Target, StickyNote,
  ShoppingCart, LayoutGrid, Dumbbell, MoreHorizontal, X, Settings, Check,
} from 'lucide-react'

// 탭 2계열(전략축/일정축) 정리. 그룹 순서·라벨은 GROUP_ORDER/GROUP_LABELS 로 렌더.
type NavGroup = 'home' | 'strategy' | 'schedule' | 'tools'
const ALL_NAV_ITEMS: { href: string; label: string; icon: React.ReactNode; group: NavGroup }[] = [
  { href: '/', label: '대시보드', icon: <Home size={20} />, group: 'home' },
  { href: '/memo', label: '메모장', icon: <StickyNote size={20} />, group: 'home' },
  // 전략축: 큰그림(장기계획) → 세부전략(+실행항목)
  { href: '/decade', label: '장기계획', icon: <Rocket size={20} />, group: 'strategy' },
  { href: '/strategy', label: '세부전략', icon: <Target size={20} />, group: 'strategy' },
  // 일정축
  { href: '/flowmap-v2', label: '세부일정', icon: <Map size={20} />, group: 'schedule' },
  // 도구/독립
  { href: '/brain', label: '생각확장', icon: <Brain size={20} />, group: 'tools' },
  { href: '/routine', label: '필수과업', icon: <RefreshCw size={20} />, group: 'tools' },
  { href: '/profile', label: '인적사항', icon: <User size={20} />, group: 'tools' },
  { href: '/shopping', label: '구입 목록', icon: <ShoppingCart size={20} />, group: 'tools' },
  { href: '/fitness', label: '운동 비서', icon: <Dumbbell size={20} />, group: 'tools' },
  { href: '/split', label: '분할 보기', icon: <LayoutGrid size={20} />, group: 'tools' },
]

const GROUP_ORDER: NavGroup[] = ['home', 'strategy', 'schedule', 'tools']
const GROUP_LABELS: Record<NavGroup, string | null> = {
  home: null,
  strategy: '전략축',
  schedule: '일정축',
  tools: '도구',
}

// 모바일 하단 탭 기본 4개: 대시보드 · 메모장 · 세부전략 · 세부일정
const DEFAULT_BOTTOM_HREFS = ['/', '/memo', '/strategy', '/flowmap-v2']
// 키 버전을 올리면 예전에 저장된 탭 구성(삭제된 /flowmap 등)을 무시하고 새 기본값을 쓴다
const STORAGE_KEY = 'planner-bottom-nav-hrefs-v2'

function useBottomNavHrefs() {
  const [hrefs, setHrefs] = useState<string[]>(DEFAULT_BOTTOM_HREFS)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as string[]
        // 현재 존재하는 메뉴만 남긴다 (삭제된 경로가 저장돼 있으면 탭이 비는 문제 방지)
        const valid = Array.isArray(parsed)
          ? parsed.filter((h) => ALL_NAV_ITEMS.some((item) => item.href === h))
          : []
        if (valid.length > 0) {
          setHrefs(valid.slice(0, 4))
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
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="JDH PLANER" className="w-11 h-11 rounded-2xl flex-shrink-0 object-cover" />
          <div>
            <h1 className="font-bold text-gray-900 text-sm leading-tight">인생 플래너</h1>
            <p className="text-xs text-gray-500 mt-0.5">푯대를 향해 나아가는 자</p>
            <p className="text-xs text-gray-400 mt-0.5">인류에 유의미한 일을 하자</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        {GROUP_ORDER.map((group) => {
          const items = ALL_NAV_ITEMS.filter((i) => i.group === group)
          if (items.length === 0) return null
          const groupLabel = GROUP_LABELS[group]
          return (
            <div key={group} className="space-y-1 mb-1">
              {groupLabel && (
                <p className="px-3 pt-4 pb-1 text-[11px] font-semibold text-gray-400 tracking-wide">
                  {groupLabel}
                </p>
              )}
              {items.map((item) => {
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
            </div>
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
