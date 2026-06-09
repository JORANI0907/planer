'use client'

import { useState, useEffect } from 'react'
import { LayoutDashboard, Dumbbell, Utensils, BotMessageSquare, Settings2 } from 'lucide-react'
import { LayoutShell } from '@/components/LayoutShell'
import FitnessHome from '@/components/fitness/FitnessHome'
import WorkoutSession from '@/components/fitness/WorkoutSession'
import DietTracker from '@/components/fitness/DietTracker'
import FitnessCoach from '@/components/fitness/FitnessCoach'
import FitnessSettings from '@/components/fitness/FitnessSettings'

type FitnessTab = 'home' | 'session' | 'diet' | 'coach' | 'settings'

const TABS: { key: FitnessTab; label: string; icon: React.ReactNode }[] = [
  { key: 'home',     label: '홈',       icon: <LayoutDashboard size={18} /> },
  { key: 'session',  label: '운동시작',  icon: <Dumbbell size={18} /> },
  { key: 'diet',     label: '식단',      icon: <Utensils size={18} /> },
  { key: 'coach',    label: 'AI 코치',   icon: <BotMessageSquare size={18} /> },
  { key: 'settings', label: '설정',      icon: <Settings2 size={18} /> },
]

const STORAGE_KEY = 'fitness-active-tab-v2'

export default function FitnessPage() {
  const [activeTab, setActiveTab] = useState<FitnessTab>('home')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as FitnessTab | null
      if (saved && TABS.some(t => t.key === saved)) setActiveTab(saved)
    } catch {}
  }, [])

  const handleTabChange = (tab: string) => {
    const validTab = TABS.find(t => t.key === tab)?.key ?? 'home'
    setActiveTab(validTab)
    try { localStorage.setItem(STORAGE_KEY, validTab) } catch {}
  }

  return (
    <LayoutShell>
      <div className="max-w-lg md:max-w-5xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">운동 비서</h1>
          <p className="text-sm text-gray-400 mt-0.5">나만의 운동 & 식단 관리</p>
        </div>

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

        <div>
          {activeTab === 'home'     && <FitnessHome onTabChange={handleTabChange} />}
          {activeTab === 'session'  && <WorkoutSession />}
          {activeTab === 'diet'     && <DietTracker />}
          {activeTab === 'coach'    && <FitnessCoach onTabChange={handleTabChange} />}
          {activeTab === 'settings' && <FitnessSettings />}
        </div>
      </div>
    </LayoutShell>
  )
}
