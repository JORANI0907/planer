'use client'

import { useEffect, useRef, useState } from 'react'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { updateStrategyNode, deleteStrategyNode, nextStatus } from '@/lib/strategy-api'
import { STRATEGY_STATUS_CONFIG, type StrategyNode } from '@/lib/strategy-types'

type Gran = 'annual' | 'quarterly' | 'monthly'

function parsePeriodKey(key: string | null): { gran: Gran; year: number; q: number; month: number } {
  const now = new Date()
  const base = { gran: 'quarterly' as Gran, year: now.getFullYear(), q: Math.ceil((now.getMonth() + 1) / 3), month: now.getMonth() + 1 }
  if (!key) return base
  if (/^\d{4}$/.test(key)) return { ...base, gran: 'annual', year: Number(key) }
  const qm = key.match(/^(\d{4})-Q([1-4])$/)
  if (qm) return { ...base, gran: 'quarterly', year: Number(qm[1]), q: Number(qm[2]) }
  const mm = key.match(/^(\d{4})-(\d{2})$/)
  if (mm) return { ...base, gran: 'monthly', year: Number(mm[1]), month: Number(mm[2]) }
  return base
}

function buildPeriodKey(gran: Gran, year: number, q: number, month: number): string {
  if (gran === 'annual') return `${year}`
  if (gran === 'quarterly') return `${year}-Q${q}`
  return `${year}-${String(month).padStart(2, '0')}`
}

export function StrategyEditModal({
  node,
  onClose,
  onPatch,
  onDeleted,
}: {
  node: StrategyNode
  onClose: () => void
  onPatch: (id: string, updates: Partial<StrategyNode>) => void
  onDeleted: (id: string) => void
}) {
  const isMilestone = node.kind === 'milestone'
  const [titleVal, setTitleVal] = useState(node.title)
  const [status, setStatus] = useState(node.status)
  const [usePeriod, setUsePeriod] = useState(!!node.target_period_key)
  const parsed = parsePeriodKey(node.target_period_key)
  const [gran, setGran] = useState<Gran>(parsed.gran)
  const [year, setYear] = useState(parsed.year)
  const [q, setQ] = useState(parsed.q)
  const [month, setMonth] = useState(parsed.month)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const descTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  useEffect(() => () => { if (descTimer.current) clearTimeout(descTimer.current) }, [])

  async function patch(updates: Partial<StrategyNode>) {
    onPatch(node.id, updates) // 낙관적: 바뀐 필드만 즉시 반영
    try {
      await updateStrategyNode(node.id, updates)
    } catch (e) {
      alert('저장 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  function commitTitle() {
    const t = titleVal.trim() || (isMilestone ? '(단계)' : '(전략)')
    if (t !== node.title) patch({ title: t })
  }

  async function cycleStatus() {
    const s = nextStatus(status)
    setStatus(s)
    await patch({ status: s })
  }

  async function savePeriod(on: boolean, g: Gran, y: number, qq: number, mm: number) {
    const key = on ? buildPeriodKey(g, y, qq, mm) : null
    await patch({ target_period_key: key })
  }

  function handleDescChange(html: string) {
    if (descTimer.current) clearTimeout(descTimer.current)
    setSaveStatus('saving')
    descTimer.current = setTimeout(async () => {
      await patch({ description: html })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    }, 700)
  }

  async function handleDelete() {
    if (!confirm(isMilestone ? '이 마일스톤을 삭제할까요?' : '이 전략을 삭제할까요?\n하위 마일스톤도 함께 삭제됩니다.')) return
    await deleteStrategyNode(node.id)
    onDeleted(node.id)
  }

  const statusConf = STRATEGY_STATUS_CONFIG[status]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${isMilestone ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
              {isMilestone ? '마일스톤' : '전략'}
            </span>
            <input
              value={titleVal}
              onChange={(e) => setTitleVal(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitTitle() } }}
              placeholder={isMilestone ? '단계 이름' : '전략 이름'}
              className="flex-1 min-w-0 text-lg font-bold text-gray-900 outline-none bg-transparent"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saveStatus === 'saving' && <span className="text-xs text-gray-400">저장 중...</span>}
            {saveStatus === 'saved' && <span className="text-xs text-green-500">저장됨 ✓</span>}
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none p-1">✕</button>
          </div>
        </div>

        {/* Meta: 상태 + (마일스톤) 목표시점 */}
        <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50">
          <button type="button" onClick={cycleStatus} className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusConf.color}`}>
            {statusConf.label} ↻
          </button>

          {isMilestone && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={usePeriod}
                  onChange={(e) => { setUsePeriod(e.target.checked); savePeriod(e.target.checked, gran, year, q, month) }}
                />
                목표시점
              </label>
              {usePeriod && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => { const y = Number(e.target.value); setYear(y); savePeriod(true, gran, y, q, month) }}
                    className="w-20 border border-gray-200 rounded-md px-2 py-1 text-xs"
                  />
                  <select
                    value={gran}
                    onChange={(e) => { const g = e.target.value as Gran; setGran(g); savePeriod(true, g, year, q, month) }}
                    className="border border-gray-200 rounded-md px-2 py-1 text-xs"
                  >
                    <option value="annual">연간</option>
                    <option value="quarterly">분기</option>
                    <option value="monthly">월</option>
                  </select>
                  {gran === 'quarterly' && (
                    <select value={q} onChange={(e) => { const v = Number(e.target.value); setQ(v); savePeriod(true, gran, year, v, month) }} className="border border-gray-200 rounded-md px-2 py-1 text-xs">
                      {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Q{n}</option>)}
                    </select>
                  )}
                  {gran === 'monthly' && (
                    <select value={month} onChange={(e) => { const v = Number(e.target.value); setMonth(v); savePeriod(true, gran, year, q, v) }} className="border border-gray-200 rounded-md px-2 py-1 text-xs">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}월</option>)}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          <button type="button" onClick={handleDelete} className="ml-auto text-xs text-red-500 hover:text-red-600 font-medium">삭제</button>
        </div>

        {/* Description */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <RichTextEditor value={node.description ?? ''} onChange={handleDescChange} placeholder={isMilestone ? '이 단계의 할 일·완료조건을 적어보세요...' : '이 전략의 방향·핵심을 적어보세요...'} />
        </div>
      </div>
    </div>
  )
}
