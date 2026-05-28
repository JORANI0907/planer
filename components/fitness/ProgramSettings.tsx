'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Check, ChevronDown, ChevronUp, Edit2, X } from 'lucide-react'
import type { FitnessExercise, FitnessProgram, FitnessProgramSplit } from '@/lib/fitness-types'
import type { ExerciseMuscleGroup } from '@/lib/fitness-types'
import {
  getPrograms, createProgram, deleteProgram, setActiveProgram,
  getSplitsByProgram, createSplit, deleteSplit, updateSplit,
  getExercises, createExercise, deleteExercise,
  getExercisesBySplit, addExerciseToSplit, removeExerciseFromSplit,
} from '@/lib/fitness-api'

const MUSCLE_GROUPS: ExerciseMuscleGroup[] = ['가슴', '등', '어깨', '하체', '삼두', '이두', '복근', '기타']

export default function ProgramSettings() {
  const [programs, setPrograms] = useState<FitnessProgram[]>([])
  const [exercises, setExercises] = useState<FitnessExercise[]>([])
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null)
  const [splitsByProgram, setSplitsByProgram] = useState<Map<string, FitnessProgramSplit[]>>(new Map())
  const [splitExercises, setSplitExercises] = useState<Map<string, FitnessExercise[]>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  // 신규 프로그램 폼
  const [newProgramName, setNewProgramName] = useState('')
  const [newProgramDesc, setNewProgramDesc] = useState('')
  const [showNewProgram, setShowNewProgram] = useState(false)

  // 신규 분할 폼
  const [newSplitName, setNewSplitName] = useState<Map<string, string>>(new Map())

  // 신규 종목 폼
  const [showNewExercise, setShowNewExercise] = useState(false)
  const [newExName, setNewExName] = useState('')
  const [newExMuscle, setNewExMuscle] = useState<ExerciseMuscleGroup>('가슴')
  const [newExCompound, setNewExCompound] = useState(false)

  const load = useCallback(async () => {
    const [progs, exs] = await Promise.all([getPrograms(), getExercises()])
    setPrograms(progs)
    setExercises(exs)
    setIsLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const loadSplits = useCallback(async (programId: string) => {
    const sp = await getSplitsByProgram(programId)
    setSplitsByProgram(prev => new Map(prev).set(programId, sp))
    // 각 분할의 종목 로드
    await Promise.all(sp.map(async split => {
      const exs = await getExercisesBySplit(split.id)
      setSplitExercises(prev => new Map(prev).set(split.id, exs))
    }))
  }, [])

  const handleToggleProgram = useCallback(async (programId: string) => {
    if (expandedProgram === programId) {
      setExpandedProgram(null)
    } else {
      setExpandedProgram(programId)
      if (!splitsByProgram.has(programId)) await loadSplits(programId)
    }
  }, [expandedProgram, splitsByProgram, loadSplits])

  const handleCreateProgram = useCallback(async () => {
    if (!newProgramName.trim()) return
    const prog = await createProgram({ name: newProgramName.trim(), description: newProgramDesc.trim(), is_active: false })
    setPrograms(prev => [prog, ...prev])
    setNewProgramName(''); setNewProgramDesc(''); setShowNewProgram(false)
  }, [newProgramName, newProgramDesc])

  const handleDeleteProgram = useCallback(async (id: string) => {
    if (!confirm('프로그램을 삭제하시겠습니까?')) return
    await deleteProgram(id)
    setPrograms(prev => prev.filter(p => p.id !== id))
    if (expandedProgram === id) setExpandedProgram(null)
  }, [expandedProgram])

  const handleSetActive = useCallback(async (id: string) => {
    await setActiveProgram(id)
    setPrograms(prev => prev.map(p => ({ ...p, is_active: p.id === id })))
  }, [])

  const handleCreateSplit = useCallback(async (programId: string) => {
    const name = newSplitName.get(programId)?.trim()
    if (!name) return
    const sp = splitsByProgram.get(programId) ?? []
    const newSplit = await createSplit({ program_id: programId, name, sort_order: sp.length })
    setSplitsByProgram(prev => new Map(prev).set(programId, [...sp, newSplit]))
    setSplitExercises(prev => new Map(prev).set(newSplit.id, []))
    setNewSplitName(prev => new Map(prev).set(programId, ''))
  }, [newSplitName, splitsByProgram])

  const handleDeleteSplit = useCallback(async (programId: string, splitId: string) => {
    await deleteSplit(splitId)
    setSplitsByProgram(prev => {
      const next = new Map(prev)
      next.set(programId, (next.get(programId) ?? []).filter(s => s.id !== splitId))
      return next
    })
  }, [])

  const handleAddExToSplit = useCallback(async (splitId: string, exercise: FitnessExercise) => {
    const current = splitExercises.get(splitId) ?? []
    if (current.some(e => e.id === exercise.id)) return
    await addExerciseToSplit(splitId, exercise.id, current.length)
    setSplitExercises(prev => new Map(prev).set(splitId, [...current, exercise]))
  }, [splitExercises])

  const handleRemoveExFromSplit = useCallback(async (splitId: string, exerciseId: string) => {
    await removeExerciseFromSplit(splitId, exerciseId)
    setSplitExercises(prev => new Map(prev).set(splitId, (prev.get(splitId) ?? []).filter(e => e.id !== exerciseId)))
  }, [])

  const handleCreateExercise = useCallback(async () => {
    if (!newExName.trim()) return
    const ex = await createExercise({ name: newExName.trim(), muscle_group: newExMuscle, is_compound: newExCompound, sort_order: exercises.length })
    setExercises(prev => [...prev, ex])
    setNewExName(''); setShowNewExercise(false)
  }, [newExName, newExMuscle, newExCompound, exercises.length])

  const handleDeleteExercise = useCallback(async (id: string) => {
    if (!confirm('종목을 삭제하시겠습니까?')) return
    await deleteExercise(id)
    setExercises(prev => prev.filter(e => e.id !== id))
  }, [])

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-gray-400 text-sm">불러오는 중...</div>
  }

  return (
    <div className="md:grid md:grid-cols-2 md:gap-6 space-y-6 md:space-y-0">
      {/* 왼쪽: 프로그램 관리 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">운동 프로그램</h3>
          <button onClick={() => setShowNewProgram(true)} className="flex items-center gap-1 text-xs text-blue-600 font-medium px-3 py-1.5 bg-blue-50 rounded-lg active:bg-blue-100">
            <Plus size={13} /> 새 프로그램
          </button>
        </div>

        {showNewProgram && (
          <div className="bg-blue-50 rounded-2xl p-4 space-y-2">
            <input type="text" placeholder="프로그램 이름 *" value={newProgramName} onChange={e => setNewProgramName(e.target.value)} className="w-full px-3 py-2 border border-blue-200 rounded-xl text-sm bg-white" autoFocus />
            <input type="text" placeholder="설명 (선택)" value={newProgramDesc} onChange={e => setNewProgramDesc(e.target.value)} className="w-full px-3 py-2 border border-blue-200 rounded-xl text-sm bg-white" />
            <div className="flex gap-2">
              <button onClick={handleCreateProgram} className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold active:bg-blue-700">생성</button>
              <button onClick={() => setShowNewProgram(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-500">취소</button>
            </div>
          </div>
        )}

        {programs.map(prog => {
          const splits = splitsByProgram.get(prog.id) ?? []
          const isExpanded = expandedProgram === prog.id
          return (
            <div key={prog.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="flex items-center p-4">
                <button className="flex-1 flex items-center gap-3 text-left" onClick={() => handleToggleProgram(prog.id)}>
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${prog.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{prog.name}</p>
                    {prog.description && <p className="text-xs text-gray-400 mt-0.5">{prog.description}</p>}
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400 ml-auto" /> : <ChevronDown size={16} className="text-gray-400 ml-auto" />}
                </button>
                <div className="flex items-center gap-1 ml-2">
                  {!prog.is_active && (
                    <button onClick={() => handleSetActive(prog.id)} className="text-xs px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg font-medium active:bg-green-100">활성화</button>
                  )}
                  {prog.is_active && <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg font-medium">활성</span>}
                  <button onClick={() => handleDeleteProgram(prog.id)} className="p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500">분할 구성</p>
                  {splits.map(split => (
                    <div key={split.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-800">{split.name}</span>
                        <button onClick={() => handleDeleteSplit(prog.id, split.id)} className="p-1 text-gray-300 hover:text-red-400"><Trash2 size={13} /></button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(splitExercises.get(split.id) ?? []).map(ex => (
                          <span key={ex.id} className="flex items-center gap-1 text-xs px-2 py-1 bg-white border border-gray-200 rounded-lg">
                            {ex.name}
                            <button onClick={() => handleRemoveExFromSplit(split.id, ex.id)} className="text-gray-300 hover:text-red-400 ml-0.5"><X size={10} /></button>
                          </span>
                        ))}
                      </div>
                      <select
                        onChange={e => {
                          const ex = exercises.find(x => x.id === e.target.value)
                          if (ex) handleAddExToSplit(split.id, ex)
                          e.target.value = ''
                        }}
                        className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-600"
                        defaultValue=""
                      >
                        <option value="" disabled>+ 종목 추가</option>
                        {exercises.filter(ex => !(splitExercises.get(split.id) ?? []).some(e => e.id === ex.id))
                          .map(ex => <option key={ex.id} value={ex.id}>{ex.name} ({ex.muscle_group})</option>)}
                      </select>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="분할 이름 (예: 등/이두)"
                      value={newSplitName.get(prog.id) ?? ''}
                      onChange={e => setNewSplitName(prev => new Map(prev).set(prog.id, e.target.value))}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm"
                      onKeyDown={e => e.key === 'Enter' && handleCreateSplit(prog.id)}
                    />
                    <button onClick={() => handleCreateSplit(prog.id)} className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold active:bg-blue-700">추가</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </section>

      {/* 오른쪽: 종목 마스터 관리 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">종목 관리</h3>
          <button onClick={() => setShowNewExercise(true)} className="flex items-center gap-1 text-xs text-blue-600 font-medium px-3 py-1.5 bg-blue-50 rounded-lg active:bg-blue-100">
            <Plus size={13} /> 새 종목
          </button>
        </div>

        {showNewExercise && (
          <div className="bg-blue-50 rounded-2xl p-4 space-y-2">
            <input type="text" placeholder="종목명 *" value={newExName} onChange={e => setNewExName(e.target.value)} className="w-full px-3 py-2 border border-blue-200 rounded-xl text-sm bg-white" autoFocus />
            <div className="flex gap-2">
              <select value={newExMuscle} onChange={e => setNewExMuscle(e.target.value as ExerciseMuscleGroup)} className="flex-1 px-3 py-2 border border-blue-200 rounded-xl text-sm bg-white">
                {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm px-3 py-2 bg-white border border-blue-200 rounded-xl cursor-pointer shrink-0">
                <input type="checkbox" checked={newExCompound} onChange={e => setNewExCompound(e.target.checked)} />
                컴파운드
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={handleCreateExercise} className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold active:bg-blue-700">추가</button>
              <button onClick={() => setShowNewExercise(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-500">취소</button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {exercises.map((ex, i) => (
            <div key={ex.id} className={`flex items-center justify-between px-4 py-3 ${i < exercises.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">{ex.name}</span>
                {ex.is_compound && <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded">컴파운드</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{ex.muscle_group}</span>
                <button onClick={() => handleDeleteExercise(ex.id)} className="p-1 text-gray-300 hover:text-red-400"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
