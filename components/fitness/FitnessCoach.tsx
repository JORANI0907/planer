'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Bot, User, Sparkles, CheckCircle, Save, Dumbbell, Utensils } from 'lucide-react'
import type { ExerciseMuscleGroup } from '@/lib/fitness-types'
import {
  getExercises, createProgram, createSplit, addExerciseToSplit,
  createExercise, upsertDiet, getChatHistory, saveChatMessage,
} from '@/lib/fitness-api'

// ─── Types ───────────────────────────────────────────────────

type GeneratedProgram = {
  name: string
  description: string
  splits: Array<{ name: string; exercises: Array<{ name: string; target_sets: number; target_reps: string }> }>
  coaching_note: string
}

type GeneratedDiet = {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  water_l: number
  memo: string
  coaching_note: string
}

type MessageAction =
  | { type: 'program'; data: GeneratedProgram }
  | { type: 'diet'; data: GeneratedDiet }

type Message = {
  role: 'user' | 'assistant'
  content: string
  action?: MessageAction
}

// ─── Helpers ─────────────────────────────────────────────────

function inferMuscleGroup(name: string): ExerciseMuscleGroup {
  if (/벤치|체스트|가슴|플라이|체스트/.test(name)) return '가슴'
  if (/데드|로우|풀업|랫|등/.test(name)) return '등'
  if (/오버헤드|숄더|어깨|레터럴|프론트/.test(name)) return '어깨'
  if (/스쿼트|레그|하체|런지|힙|글루트/.test(name)) return '하체'
  if (/트라이셉|삼두/.test(name)) return '삼두'
  if (/바이셉|이두|컬/.test(name)) return '이두'
  if (/크런치|플랭크|복근/.test(name)) return '복근'
  return '기타'
}

const COMPOUND_PATTERN = /벤치프레스|데드리프트|스쿼트|오버헤드프레스|바벨로우|풀업|딥스/

// ─── Sub-components ──────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-purple-500 to-blue-600'}`}>
        {isUser ? <User size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
      </div>
      <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-blue-600 text-white rounded-tr-sm'
          : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'
      }`}>
        {msg.content}
      </div>
    </div>
  )
}

function ProgramCard({ data, onSave }: { data: GeneratedProgram; onSave: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave()
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ml-11 mt-2 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Dumbbell size={15} className="text-blue-600" />
        <span className="font-bold text-gray-900 text-sm">{data.name}</span>
      </div>
      {data.description && <p className="text-xs text-gray-500">{data.description}</p>}
      <div className="space-y-2">
        {data.splits.map((split, i) => (
          <div key={i} className="bg-white rounded-xl p-3 space-y-1.5">
            <p className="text-xs font-semibold text-gray-700">{split.name}</p>
            <div className="flex flex-col gap-1">
              {split.exercises.map((ex, j) => (
                <div key={j} className="flex items-center justify-between text-[11px] px-2 py-1 bg-blue-50 rounded-lg">
                  <span className="text-blue-800 font-medium">{ex.name}</span>
                  <span className="text-blue-500 font-mono shrink-0 ml-2">{ex.target_sets}세트 × {ex.target_reps}회</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {saved ? (
        <div className="flex items-center gap-2 text-green-600 text-sm font-medium py-1">
          <CheckCircle size={14} />
          프로그램 탭에 저장되었습니다 ✓
        </div>
      ) : (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold active:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? '저장 중...' : '프로그램 탭에 저장하기'}
        </button>
      )}
    </div>
  )
}

function DietCard({ data, onSave }: { data: GeneratedDiet; onSave: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave()
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  const macros = [
    { label: '칼로리', value: data.calories, unit: 'kcal' },
    { label: '단백질', value: data.protein_g, unit: 'g' },
    { label: '탄수화물', value: data.carbs_g, unit: 'g' },
    { label: '지방', value: data.fat_g, unit: 'g' },
    { label: '수분', value: data.water_l, unit: 'L' },
  ]

  return (
    <div className="ml-11 mt-2 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Utensils size={15} className="text-purple-600" />
        <span className="font-bold text-gray-900 text-sm">오늘의 식단 목표</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {macros.map(item => (
          <div key={item.label} className="bg-white rounded-xl px-3 py-2">
            <p className="text-[10px] text-gray-400">{item.label}</p>
            <p className="font-bold text-gray-900 text-sm">
              {item.value}
              <span className="text-[10px] font-normal text-gray-400 ml-0.5">{item.unit}</span>
            </p>
          </div>
        ))}
      </div>
      {data.memo && (
        <div className="bg-white rounded-xl p-3">
          <p className="text-[11px] text-gray-500 leading-relaxed">{data.memo}</p>
        </div>
      )}
      {saved ? (
        <div className="flex items-center gap-2 text-green-600 text-sm font-medium py-1">
          <CheckCircle size={14} />
          식단 탭에 오늘 목표로 저장되었습니다 ✓
        </div>
      ) : (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold active:bg-purple-700 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? '저장 중...' : '오늘 식단 목표로 설정'}
        </button>
      )}
    </div>
  )
}

// ─── Quick Actions ────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: '오늘 운동 분석', prompt: '오늘 내가 한 운동 세션을 분석해주고, 잘한 점과 개선할 점을 알려줘.', kind: 'chat' as const },
  { label: '식단 점검', prompt: '오늘 식단을 근비대 목표 기준으로 분석해줘. 부족한 영양소와 개선 방법도 알려줘.', kind: 'chat' as const },
  { label: '이번 주 컨설팅', prompt: '이번 주 전체 운동과 식단을 종합 분석해서 주간 피드백을 해줘.', kind: 'chat' as const },
  { label: '✨ 운동 프로그램', prompt: '', kind: 'generate-program' as const },
  { label: '✨ 식단 플랜', prompt: '', kind: 'generate-diet' as const },
  { label: '점진적 과부하 전략', prompt: '내 현재 컴파운드 1RM을 기반으로 8주 점진적 과부하 전략을 세워줘.', kind: 'chat' as const },
]

const PROGRAM_WIZARD_QUESTION = `프로그램을 맞춤 설계하기 전에 몇 가지 여쭤볼게요 💪

• 주당 몇 일 운동하실 예정인가요? (예: 3일, 4일, 5일, 6일)
• 집중하고 싶은 부위가 있나요? (가슴, 등, 하체, 어깨, 전신 균형 등)
• 현재 운동 경력은 어느 정도인가요? (초급 / 중급 / 고급)

자유롭게 말씀해 주세요. 조건을 다 말씀하셨으면 위의 "지금 생성하기" 버튼을 눌러주세요!`

const DIET_WIZARD_QUESTION = `식단 플랜을 맞춤 설계하기 전에 몇 가지 여쭤볼게요 🥗

• 현재 목표는 무엇인가요? (린벌크 / 클린벌크 / 컷팅 / 유지)
• 특별한 식이 제한이 있나요? (채식, 유제품 제한, 알레르기 등)
• 하루 몇 끼를 드시나요? (3끼, 4~5끼 소분식 등)

말씀해 주시면 반영할게요. 준비되면 위의 "지금 생성하기" 버튼을 눌러주세요!`

// ─── Main Component ───────────────────────────────────────────

export default function FitnessCoach() {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: '안녕하세요! 피트니스 AI 코치입니다 💪\n\n운동 기록과 식단 데이터를 바탕으로 맞춤형 분석과 조언을 드립니다.\n✨ "운동 프로그램" / "식단 플랜" 버튼으로 원하는 조건을 대화로 알려주시면 맞춤 계획을 만들어 드릴게요!',
  }])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [wizardMode, setWizardMode] = useState<'idle' | 'program' | 'diet'>('idle')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    async function loadHistory() {
      try {
        const history = await getChatHistory(80)
        if (history.length > 0) {
          setMessages(history.map(m => ({ role: m.role, content: m.content })))
        }
      } catch {}
    }
    loadHistory()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ─ Streaming chat ─

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return
    const userMsg: Message = { role: 'user', content: text.trim() }
    const history = [...messages, userMsg]
    setMessages([...history, { role: 'assistant', content: '' }])
    setInput('')
    setIsLoading(true)
    try {
      const res = await fetch('/api/fitness/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.map(m => ({ role: m.role, content: m.content })) }),
      })
      if (!res.ok || !res.body) throw new Error()
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const u = [...prev]
          u[u.length - 1] = { role: 'assistant', content: acc }
          return u
        })
      }
      saveChatMessage('user', text.trim()).catch(() => {})
      saveChatMessage('assistant', acc).catch(() => {})
    } catch {
      setMessages(prev => {
        const u = [...prev]
        u[u.length - 1] = { role: 'assistant', content: '죄송합니다. 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }
        return u
      })
    } finally {
      setIsLoading(false)
    }
  }

  // ─ Start program wizard (ask questions first) ─

  const startProgramWizard = () => {
    if (isLoading) return
    if (wizardMode === 'program') {
      confirmGenerateProgram()
      return
    }
    setWizardMode('program')
    const userMsg: Message = { role: 'user', content: '운동 프로그램을 만들어줘.' }
    const askMsg: Message = { role: 'assistant', content: PROGRAM_WIZARD_QUESTION }
    setMessages(prev => [...prev, userMsg, askMsg])
    saveChatMessage('user', userMsg.content).catch(() => {})
    saveChatMessage('assistant', askMsg.content).catch(() => {})
  }

  // ─ Confirm and generate program with conversation context ─

  const confirmGenerateProgram = async () => {
    if (isLoading) return
    setWizardMode('idle')
    setIsLoading(true)
    const conversation = messages.filter(m => m.content.trim()).map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])
    try {
      const res = await fetch('/api/fitness/coach/generate-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation }),
      })
      if (!res.ok) throw new Error()
      const data: GeneratedProgram = await res.json()
      setMessages(prev => {
        const u = [...prev]
        u[u.length - 1] = { role: 'assistant', content: data.coaching_note, action: { type: 'program', data } }
        return u
      })
      saveChatMessage('assistant', data.coaching_note).catch(() => {})
    } catch {
      setMessages(prev => {
        const u = [...prev]
        u[u.length - 1] = { role: 'assistant', content: '프로그램 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }
        return u
      })
    } finally {
      setIsLoading(false)
    }
  }

  // ─ Start diet wizard ─

  const startDietWizard = () => {
    if (isLoading) return
    if (wizardMode === 'diet') {
      confirmGenerateDiet()
      return
    }
    setWizardMode('diet')
    const userMsg: Message = { role: 'user', content: '식단 플랜을 만들어줘.' }
    const askMsg: Message = { role: 'assistant', content: DIET_WIZARD_QUESTION }
    setMessages(prev => [...prev, userMsg, askMsg])
    saveChatMessage('user', userMsg.content).catch(() => {})
    saveChatMessage('assistant', askMsg.content).catch(() => {})
  }

  // ─ Confirm and generate diet with conversation context ─

  const confirmGenerateDiet = async () => {
    if (isLoading) return
    setWizardMode('idle')
    setIsLoading(true)
    const conversation = messages.filter(m => m.content.trim()).map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])
    try {
      const res = await fetch('/api/fitness/coach/generate-diet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation }),
      })
      if (!res.ok) throw new Error()
      const data: GeneratedDiet = await res.json()
      setMessages(prev => {
        const u = [...prev]
        u[u.length - 1] = { role: 'assistant', content: data.coaching_note, action: { type: 'diet', data } }
        return u
      })
      saveChatMessage('assistant', data.coaching_note).catch(() => {})
    } catch {
      setMessages(prev => {
        const u = [...prev]
        u[u.length - 1] = { role: 'assistant', content: '식단 플랜 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }
        return u
      })
    } finally {
      setIsLoading(false)
    }
  }

  // ─ Save handlers ─

  const handleSaveProgram = async (data: GeneratedProgram) => {
    const allExercises = await getExercises()
    const exMap = new Map(allExercises.map(e => [e.name.toLowerCase(), e]))

    const program = await createProgram({ name: data.name, description: data.description, is_active: false })

    for (let i = 0; i < data.splits.length; i++) {
      const split = data.splits[i]
      const newSplit = await createSplit({ program_id: program.id, name: split.name, sort_order: i })

      for (let j = 0; j < split.exercises.length; j++) {
        const exData = split.exercises[j]
        let exercise = exMap.get(exData.name.toLowerCase())
        if (!exercise) {
          exercise = await createExercise({
            name: exData.name,
            muscle_group: inferMuscleGroup(exData.name),
            is_compound: COMPOUND_PATTERN.test(exData.name),
            sort_order: 999,
          })
          exMap.set(exData.name.toLowerCase(), exercise)
        }
        await addExerciseToSplit(newSplit.id, exercise.id, j, exData.target_sets, exData.target_reps)
      }
    }
  }

  const handleSaveDiet = async (data: GeneratedDiet) => {
    const today = new Date().toISOString().split('T')[0]
    await upsertDiet({
      date: today,
      calories: data.calories,
      protein_g: data.protein_g,
      carbs_g: data.carbs_g,
      fat_g: data.fat_g,
      water_l: data.water_l,
      memo: data.memo,
    })
  }

  const handleQuickAction = (qa: typeof QUICK_ACTIONS[0]) => {
    if (qa.kind === 'generate-program') startProgramWizard()
    else if (qa.kind === 'generate-diet') startDietWizard()
    else sendMessage(qa.prompt)
  }

  // ─ Render ─

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
      {/* 빠른 액션 */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-3">
        {QUICK_ACTIONS.map(qa => (
          <button
            key={qa.label}
            onClick={() => handleQuickAction(qa)}
            disabled={isLoading}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-medium transition-colors disabled:opacity-40
              ${qa.kind !== 'chat'
                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-700 hover:from-blue-100 hover:to-indigo-100'
                : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-700 active:bg-blue-50'}`}
          >
            {qa.kind === 'chat' && <Sparkles size={11} className="text-purple-400 shrink-0" />}
            {qa.label}
          </button>
        ))}
      </div>

      {/* Wizard 배너 */}
      {wizardMode !== 'idle' && (
        <div className="mb-3 flex items-center justify-between gap-3 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl">
          <div className="flex items-center gap-2 text-sm text-blue-700 min-w-0">
            <Sparkles size={14} className="shrink-0" />
            <span className="truncate">
              {wizardMode === 'program' ? '조건을 알려주신 후 생성해드릴게요' : '식단 조건을 알려주신 후 생성해드릴게요'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setWizardMode('idle')}
              className="text-xs text-gray-400 hover:text-gray-600 px-2"
            >
              취소
            </button>
            <button
              onClick={() => wizardMode === 'program' ? confirmGenerateProgram() : confirmGenerateDiet()}
              disabled={isLoading}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg active:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              지금 생성하기 →
            </button>
          </div>
        </div>
      )}

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-3">
        {messages.map((msg, i) => {
          const action = msg.action
          return (
            <div key={i}>
              <MessageBubble msg={msg} />
              {action?.type === 'program' && (
                <ProgramCard data={action.data} onSave={() => handleSaveProgram(action.data)} />
              )}
              {action?.type === 'diet' && (
                <DietCard data={action.data} onSave={() => handleSaveDiet(action.data)} />
              )}
            </div>
          )
        })}
        {isLoading && messages[messages.length - 1]?.content === '' && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-600 shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="px-4 py-3 bg-white border border-gray-100 rounded-2xl rounded-tl-sm shadow-sm">
              <Loader2 size={16} className="animate-spin text-gray-400" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="mt-2 flex gap-2 items-end bg-white border border-gray-200 rounded-2xl p-2 shadow-sm">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
          }}
          placeholder="운동이나 식단에 대해 무엇이든 물어보세요..."
          rows={1}
          className="flex-1 resize-none text-sm text-gray-800 placeholder-gray-400 outline-none px-2 py-1.5 max-h-32 leading-relaxed"
          style={{ height: 'auto', minHeight: '36px' }}
          onInput={e => {
            const t = e.target as HTMLTextAreaElement
            t.style.height = 'auto'
            t.style.height = `${t.scrollHeight}px`
          }}
          disabled={isLoading}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          className="w-9 h-9 flex items-center justify-center bg-blue-600 text-white rounded-xl shrink-0 disabled:opacity-40 active:bg-blue-700 transition-colors"
        >
          {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>
    </div>
  )
}
