'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import {
  getStrategyNodes,
  createStrategyNode,
  swapStrategyOrder,
  pushMilestoneToSchedule,
  getScheduledMilestoneIds,
} from '@/lib/strategy-api'
import { STRATEGY_STATUS_CONFIG, type StrategyNode } from '@/lib/strategy-types'
import { StrategyEditModal } from './StrategyEditModal'

const bySort = (a: StrategyNode, b: StrategyNode) =>
  a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)

function periodLabel(key: string | null): string | null {
  if (!key) return null
  if (/^\d{4}$/.test(key)) return `${key}`
  const qm = key.match(/^(\d{4})-Q([1-4])$/)
  if (qm) return `${qm[1]} ${qm[2]}분기`
  const mm = key.match(/^(\d{4})-(\d{2})$/)
  if (mm) return `${mm[1]}.${mm[2]}`
  return key
}

export function StrategyBoard({ lifeGoalId }: { lifeGoalId: string }) {
  const [nodes, setNodes] = useState<StrategyNode[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [scheduledIds, setScheduledIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ns = await getStrategyNodes(lifeGoalId)
      setNodes(ns)
      const mIds = ns.filter((n) => n.kind === 'milestone').map((n) => n.id)
      setScheduledIds(await getScheduledMilestoneIds(mIds))
    } finally {
      setLoading(false)
    }
  }, [lifeGoalId])

  async function pushToSchedule(m: StrategyNode) {
    try {
      await pushMilestoneToSchedule(m)
      setScheduledIds((prev) => new Set(prev).add(m.id)) // 버튼 → "✓ 일정 연결됨"
    } catch (e) {
      alert('일정 투입 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  useEffect(() => { load() }, [load])

  const strategies = nodes.filter((n) => n.kind === 'strategy').sort(bySort)
  const milestonesOf = (sid: string) =>
    nodes.filter((n) => n.kind === 'milestone' && n.parent_id === sid).sort(bySort)

  async function addStrategy() {
    try {
      const created = await createStrategyNode({
        life_goal_id: lifeGoalId, kind: 'strategy', title: '', sort_order: strategies.length,
      })
      setNodes((ns) => [...ns, created])
      setEditId(created.id)
    } catch (e) {
      alert('전략 추가 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  async function addMilestone(strategyId: string) {
    try {
      const count = milestonesOf(strategyId).length
      const created = await createStrategyNode({
        life_goal_id: lifeGoalId, kind: 'milestone', parent_id: strategyId, title: '', sort_order: count,
      })
      setNodes((ns) => [...ns, created])
      setEditId(created.id)
    } catch (e) {
      alert('마일스톤 추가 실패: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  // 필드 단위 병합(낙관적 업데이트). 여러 필드를 동시에 저장해도 서로 덮어쓰지 않는다.
  function onPatch(id: string, updates: Partial<StrategyNode>) {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...updates } : n)))
  }

  function onDeleted(id: string) {
    setNodes((ns) => ns.filter((n) => n.id !== id && n.parent_id !== id))
    setEditId(null)
  }

  async function moveMilestone(list: StrategyNode[], idx: number, dir: -1 | 1) {
    const j = idx + dir
    if (j < 0 || j >= list.length) return
    await swapStrategyOrder(list[idx], list[j])
    await load()
  }

  const editing = nodes.find((n) => n.id === editId) ?? null

  if (loading) {
    return <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
  }

  return (
    <div className="flex flex-col gap-4">
      {strategies.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-12 text-center">
          <p className="text-sm text-gray-500">아직 전략이 없습니다.</p>
          <p className="text-xs text-gray-400 mt-1">이 목표를 이루기 위한 전략을 추가해보세요.</p>
          <button onClick={addStrategy} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
            <Plus size={16} /> 전략 추가
          </button>
        </div>
      ) : (
        <>
          {strategies.map((s) => {
            const milestones = milestonesOf(s.id)
            const sConf = STRATEGY_STATUS_CONFIG[s.status]
            return (
              <section key={s.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 md:p-5">
                {/* 전략 헤더 */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${sConf.color.split(' ')[0]}`} />
                      <button onClick={() => setEditId(s.id)} className="text-left text-base font-bold text-gray-900 hover:text-blue-600 truncate">
                        {s.title || '(제목 없는 전략)'}
                      </button>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${sConf.color}`}>{sConf.label}</span>
                    </div>
                    {s.description && s.description.replace(/<[^>]*>/g, '').trim() && (
                      <div
                        className="text-xs text-gray-500 mt-1.5 line-clamp-2 cursor-pointer"
                        onClick={() => setEditId(s.id)}
                        dangerouslySetInnerHTML={{ __html: s.description }}
                      />
                    )}
                  </div>
                  <button onClick={() => setEditId(s.id)} className="shrink-0 text-gray-300 hover:text-gray-600 p-1" title="전략 편집">
                    <Pencil size={15} />
                  </button>
                </div>

                {/* 마일스톤 플로우 */}
                <div className="mt-3 overflow-x-auto">
                  <div className="flex items-stretch gap-2 min-w-min pb-1">
                    {milestones.map((m, i) => {
                      const mConf = STRATEGY_STATUS_CONFIG[m.status]
                      const pLabel = periodLabel(m.target_period_key)
                      return (
                        <div key={m.id} className="flex items-center gap-2">
                          <div className="w-44 shrink-0 border border-gray-200 rounded-xl p-2.5 bg-gray-50/60 hover:border-blue-200 transition-colors">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${mConf.color}`}>{mConf.label}</span>
                              <div className="flex items-center gap-0.5">
                                <button onClick={() => moveMilestone(milestones, i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-30" title="앞으로"><ChevronLeft size={14} /></button>
                                <button onClick={() => moveMilestone(milestones, i, 1)} disabled={i === milestones.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-30" title="뒤로"><ChevronRight size={14} /></button>
                              </div>
                            </div>
                            <button onClick={() => setEditId(m.id)} className="text-left w-full mt-1.5 text-sm font-semibold text-gray-800 hover:text-blue-600 line-clamp-2 leading-snug">
                              {m.title || '(단계)'}
                            </button>
                            {pLabel && <p className="text-[10px] text-gray-400 mt-1">🎯 {pLabel}</p>}
                            {m.target_period_key && (
                              scheduledIds.has(m.id) ? (
                                <p className="text-[10px] text-green-600 mt-1 font-semibold">✓ 일정 연결됨</p>
                              ) : (
                                <button
                                  onClick={() => pushToSchedule(m)}
                                  className="mt-1.5 w-full text-[10px] font-semibold text-blue-600 border border-blue-200 rounded-md py-1 hover:bg-blue-50"
                                >
                                  📅 일정에 투입
                                </button>
                              )
                            )}
                          </div>
                          {i < milestones.length - 1 && <span className="text-gray-300 shrink-0">→</span>}
                        </div>
                      )
                    })}
                    <button onClick={() => addMilestone(s.id)} className="w-28 shrink-0 border border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-blue-600 hover:border-blue-300 py-3 self-stretch">
                      <Plus size={16} />
                      <span className="text-[11px] font-medium">단계 추가</span>
                    </button>
                  </div>
                </div>
              </section>
            )
          })}

          <button onClick={addStrategy} className="inline-flex items-center gap-1.5 self-start px-4 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50">
            <Plus size={16} /> 전략 추가
          </button>
        </>
      )}

      {editing && (
        <StrategyEditModal
          node={editing}
          onClose={() => setEditId(null)}
          onPatch={onPatch}
          onDeleted={onDeleted}
        />
      )}
    </div>
  )
}
