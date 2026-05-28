'use client'

import { useState, useEffect } from 'react'
import { LayoutDashboard, Dumbbell, TrendingUp, Utensils, Settings2, BotMessageSquare, UserCircle } from 'lucide-react'
import { LayoutShell } from '@/components/LayoutShell'
import FitnessDashboard from '@/components/fitness/FitnessDashboard'
import WorkoutSession from '@/components/fitness/WorkoutSession'
import ProgressView from '@/components/fitness/ProgressView'
import DietTracker from '@/components/fitness/DietTracker'
import ProgramSettings from '@/components/fitness/ProgramSettings'
import FitnessCoach from '@/components/fitness/FitnessCoach'
import ProfileSettings from '@/components/fitness/ProfileSettings'

type FitnessTab = 'dashboard' | 'session' | 'progress' | 'diet' | 'settings' | 'coach' | 'profile'

const TABS: { key: FitnessTab; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: '대시보드',   icon: <LayoutDashboard size={18} /> },
  { key: 'session',   label: '운동 기록',   icon: <Dumbbell size={18} /> },
  { key: 'progress',  label: '진행 추적',   icon: <TrendingUp size={18} /> },
  { key: 'diet',      label: '식단',        icon: <Utensils size={18} /> },
  { key: 'settings',  label: '프로그램',    icon: <Settings2 size={18} /> },
  { key: 'coach',     label: 'AI 코치',     icon: <BotMessageSquare size={18} /> },
  { key: 'profile',   label: '내 정보',     icon: <UserCircle size={18} /> },
]

const STORAGE_KEY = 'fitness-active-tab'

export default function FitnessPage() {
  const [activeTab, setActiveTab] = useState<FitnessTab>('dashboard')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as FitnessTab | null
      if (saved && TABS.some(t => t.key === saved)) setActiveTab(saved)
    } catch {}
  }, [])

  const handleTabChange = (tab: FitnessTab) => {
    setActiveTab(tab)
    try { localStorage.setItem(STORAGE_KEY, tab) } catch {}
  }

  return (
    <LayoutShell>
      <div className="max-w-lg md:max-w-5xl mx-auto">
        {/* 페이지 헤더 */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">운동 비서</h1>
          <p className="text-sm text-gray-400 mt-0.5">나만의 운동 & 식단 관리</p>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex gap-1 mb-5 bg-gray-100 rounded-2xl p-1 overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div>
          {activeTab === 'dashboard' && <FitnessDashboard onTabChange={t => handleTabChange(t as FitnessTab)} />}
          {activeTab === 'session'   && <WorkoutSession />}
          {activeTab === 'progress'  && <ProgressView />}
          {activeTab === 'diet'      && <DietTracker />}
          {activeTab === 'settings'  && <ProgramSettings />}
          {activeTab === 'coach'     && <FitnessCoach />}
          {activeTab === 'profile'   && <ProfileSettings />}
        </div>
      </div>
    </LayoutShell>
  )
}
