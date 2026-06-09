'use client'

import { useState } from 'react'
import { Calendar, BarChart2 } from 'lucide-react'
import FitnessDashboard from './FitnessDashboard'
import ProgressView from './ProgressView'

type HomeView = 'week' | 'history'

export default function FitnessHome({ onTabChange }: { onTabChange?: (tab: string) => void }) {
  const [view, setView] = useState<HomeView>('week')

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setView('week')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            view === 'week' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Calendar size={14} /> 이번 주
        </button>
        <button
          onClick={() => setView('history')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            view === 'history' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          <BarChart2 size={14} /> 기록
        </button>
      </div>

      {view === 'week' && <FitnessDashboard onTabChange={onTabChange} />}
      {view === 'history' && <ProgressView />}
    </div>
  )
}
