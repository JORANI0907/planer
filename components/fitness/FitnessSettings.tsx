'use client'

import { useState } from 'react'
import { User, Dumbbell } from 'lucide-react'
import ProfileSettings from './ProfileSettings'
import ProgramSettings from './ProgramSettings'

type SettingsView = 'profile' | 'program'

export default function FitnessSettings() {
  const [view, setView] = useState<SettingsView>('profile')

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setView('profile')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            view === 'profile' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          <User size={14} /> 내 정보
        </button>
        <button
          onClick={() => setView('program')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            view === 'program' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Dumbbell size={14} /> 프로그램
        </button>
      </div>

      {view === 'profile' && <ProfileSettings />}
      {view === 'program' && <ProgramSettings />}
    </div>
  )
}
