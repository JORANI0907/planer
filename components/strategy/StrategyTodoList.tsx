'use client'

import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { getStrategyTodos, createStrategyTodo } from '@/lib/strategy-api'
import { updatePlanItem, deletePlanItem } from '@/lib/api'
import type { PlanItem } from '@/lib/types'

/**
 * 전략/마일스톤에 귀속된 실행항목(=TO-DO) 목록.
 * 여기서 추가한 항목은 strategy_node_id 로 연결되어 TO-DO 탭에도 함께 나타난다.
 */
export function StrategyTodoList({ nodeId }: { nodeId: string }) {
  const [items, setItems] = useState<PlanItem[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStrategyTodos(nodeId)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [nodeId])

  async function add() {
    const t = input.trim()
    if (!t) return
    setInput('')
    try {
      const it = await createStrategyTodo(nodeId, t, items.length)
      setItems((p) => [...p, it])
    } catch (e) {
      alert('실행항목 추가 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  async function toggle(it: PlanItem) {
    const next = it.status === 'completed' ? 'pending' : 'completed'
    setItems((p) => p.map((x) => (x.id === it.id ? { ...x, status: next } : x)))
    try {
      await updatePlanItem(it.id, { status: next })
    } catch {
      /* 롤백 생략 — 다음 로드 시 정정 */
    }
  }

  async function remove(it: PlanItem) {
    setItems((p) => p.filter((x) => x.id !== it.id))
    try {
      await deletePlanItem(it.id)
    } catch {
      /* noop */
    }
  }

  const doneCount = items.filter((i) => i.status === 'completed').length

  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-bold text-gray-800">실행항목</span>
        {items.length > 0 && (
          <span className="text-xs text-gray-400">{doneCount}/{items.length}</span>
        )}
        <span className="ml-auto text-[11px] text-gray-400">TO-DO 탭에도 함께 표시됩니다</span>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="실행할 일 추가..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={add} className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700" title="추가">
          <Plus size={16} />
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">불러오는 중...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-gray-400">아직 실행항목이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 group px-1 py-1 rounded hover:bg-gray-50">
              <input
                type="checkbox"
                checked={it.status === 'completed'}
                onChange={() => toggle(it)}
                className="w-4 h-4 shrink-0"
              />
              <span className={`flex-1 text-sm ${it.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {it.title}
              </span>
              <button onClick={() => remove(it)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 shrink-0" title="삭제">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
