'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Bot, User, Sparkles } from 'lucide-react'

type Message = { role: 'user' | 'assistant'; content: string }

const QUICK_ACTIONS = [
  { label: '오늘 운동 분석', prompt: '오늘 내가 한 운동 세션을 분석해주고, 잘한 점과 개선할 점을 알려줘.' },
  { label: '식단 점검', prompt: '오늘 식단을 근비대 목표 기준으로 분석해줘. 부족한 영양소와 개선 방법도 알려줘.' },
  { label: '이번 주 컨설팅', prompt: '이번 주 전체 운동과 식단을 종합 분석해서 주간 피드백을 해줘. 다음 주 전략도 제안해줘.' },
  { label: '운동 프로그램 짜줘', prompt: '내 현재 1RM 데이터와 프로그램을 바탕으로 다음 4주 운동 프로그램을 짜줘. 세트/렙/중량 포함해서.' },
  { label: '식단 플랜 짜줘', prompt: '근비대 목표에 맞는 하루 식단 플랜을 짜줘. 아침/점심/저녁/간식으로 나눠서 매크로 수치 포함해줘.' },
  { label: '점진적 과부하 전략', prompt: '내 현재 컴파운드 리프트 1RM을 기반으로 향후 8주 점진적 과부하 전략을 세워줘.' },
]

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

export default function FitnessCoach() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '안녕하세요! 피트니스 AI 코치입니다 💪\n\n운동 기록과 식단 데이터를 바탕으로 맞춤형 분석과 조언을 드립니다. 아래 빠른 메뉴를 누르거나 자유롭게 질문해 주세요.',
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: Message = { role: 'user', content: text.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const res = await fetch('/api/fitness/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok || !res.body) throw new Error('응답 오류')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: accumulated }
          return updated
        })
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: '죄송합니다. 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
      {/* 빠른 액션 */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-3">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action.label}
            onClick={() => sendMessage(action.prompt)}
            disabled={isLoading}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700 active:bg-blue-50 disabled:opacity-40 transition-colors"
          >
            <Sparkles size={11} className="text-purple-500" />
            {action.label}
          </button>
        ))}
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-3">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
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
          onKeyDown={handleKeyDown}
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
