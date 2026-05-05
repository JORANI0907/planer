'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Calendar, Rocket, Pencil, Trash2, Target } from 'lucide-react'
import { getLifeGoals, createLifeGoal, updateLifeGoal, deleteLifeGoal, getMappedAnnualPeriodKeys, createLifeGoalAnnualMapping } from '@/lib/api'
import { useUndo } from '@/lib/undo-stack'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  type LifeGoal, type AgeGroup, type GoalProgress, type GoalType,
  GOAL_TYPE_CONFIG, GOAL_PROGRESS_CONFIG,
  calcCompletionAge, calcDaysLeft, calcProgressPct
} from '@/lib/types'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'

// ─── TipTap Editor styles ───────────────────────────────────────────────────
const EDITOR_STYLES = `
  .tiptap-editor .ProseMirror {
    outline: none;
    min-height: 400px;
    padding: 0;
  }
  .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: #adb5bd;
    pointer-events: none;
    height: 0;
  }
  .tiptap-editor .ProseMirror h1 { font-size: 1.875rem; font-weight: 700; margin: 1rem 0 0.5rem; }
  .tiptap-editor .ProseMirror h2 { font-size: 1.5rem; font-weight: 600; margin: 0.875rem 0 0.4rem; }
  .tiptap-editor .ProseMirror h3 { font-size: 1.25rem; font-weight: 600; margin: 0.75rem 0 0.3rem; }
  .tiptap-editor .ProseMirror ul { list-style-type: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
  .tiptap-editor .ProseMirror ol { list-style-type: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
  .tiptap-editor .ProseMirror li { margin: 0.2rem 0; }
  .tiptap-editor .ProseMirror blockquote { border-left: 3px solid #e2e8f0; padding-left: 1rem; color: #64748b; margin: 0.75rem 0; }
  .tiptap-editor .ProseMirror code { background: #f1f5f9; border-radius: 4px; padding: 0.1em 0.3em; font-size: 0.875em; }
  .tiptap-editor .ProseMirror pre { background: #1e293b; color: #e2e8f0; border-radius: 8px; padding: 1rem; overflow-x: auto; }
  .tiptap-editor .ProseMirror mark { background: #fef08a; border-radius: 2px; padding: 0.05em 0.1em; }
  .tiptap-editor .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0.25rem; }
  .tiptap-editor .ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
  .tiptap-editor .ProseMirror ul[data-type="taskList"] li > label { margin-top: 0.1rem; flex-shrink: 0; }
  .tiptap-editor .ProseMirror ul[data-type="taskList"] li > div { flex: 1; }
  .tiptap-editor .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div { text-decoration: line-through; color: #94a3b8; }
`

function GoalDetailModal({ goal, onClose, onUpdate }: {
  goal: LifeGoal
  onClose: () => void
  onUpdate: (g: LifeGoal) => void
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      TextStyle,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: '이 목표에 대한 세부 내용을 작성하세요...' }),
    ],
    content: goal.description || '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setSaveStatus('saving')
      saveTimer.current = setTimeout(async () => {
        const html = editor.getHTML()
        const updated = await updateLifeGoal(goal.id, { description: html })
        onUpdate(updated)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      }, 800)
    },
  })

  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const typeConfig = goal.goal_type ? GOAL_TYPE_CONFIG[goal.goal_type] : null
  const progressConfig = GOAL_PROGRESS_CONFIG[goal.progress]

  const ToolBtn = ({ onClick, active, title, children }: {
    onClick: () => void; active?: boolean; title: string; children: React.ReactNode
  }) => (
    <button
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
        active ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )

  return (
    <>
      <style>{EDITOR_STYLES}</style>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-8 pt-7 pb-4 border-b border-gray-100">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-900 leading-snug">{goal.title}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {typeConfig && (
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${typeConfig.color}`}>
                    {typeConfig.icon} {typeConfig.label}
                  </span>
                )}
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${progressConfig.color}`}>
                  {progressConfig.label}
                </span>
                {goal.target_date && (
                  <span className="text-xs text-gray-400 inline-flex items-center gap-1"><Calendar size={14} /> {goal.target_date}</span>
                )}
                <span className="text-xs text-gray-300">|</span>
                <span className="text-xs text-gray-400">{goal.age_group}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {saveStatus === 'saving' && <span className="text-xs text-gray-400">저장 중...</span>}
              {saveStatus === 'saved' && <span className="text-xs text-green-500">저장됨 ✓</span>}
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none p-1">✕</button>
            </div>
          </div>

          {/* Toolbar */}
          {editor && (
            <div className="flex flex-wrap items-center gap-0.5 px-8 py-2 border-b border-gray-100 bg-gray-50">
              <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="제목 1">H1</ToolBtn>
              <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="제목 2">H2</ToolBtn>
              <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="제목 3">H3</ToolBtn>
              <span className="w-px h-5 bg-gray-200 mx-1" />
              <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="굵게"><b>B</b></ToolBtn>
              <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="기울임"><i>I</i></ToolBtn>
              <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="밑줄"><u>U</u></ToolBtn>
              <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="취소선"><s>S</s></ToolBtn>
              <ToolBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="형광펜">🖊</ToolBtn>
              <span className="w-px h-5 bg-gray-200 mx-1" />
              <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="글머리 기호">• 목록</ToolBtn>
              <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="번호 목록">1. 목록</ToolBtn>
              <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="체크 목록">☑ 할일</ToolBtn>
              <span className="w-px h-5 bg-gray-200 mx-1" />
              <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="인용문">&ldquo;</ToolBtn>
              <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="코드">{'<>'}</ToolBtn>
              <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="코드 블록">{'```'}</ToolBtn>
              <span className="w-px h-5 bg-gray-200 mx-1" />
              <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="실행 취소">↩</ToolBtn>
              <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="다시 실행">↪</ToolBtn>
            </div>
          )}

          {/* Editor canvas */}
          <div className="flex-1 overflow-y-auto px-8 py-6 tiptap-editor">
            <EditorContent editor={editor} className="text-gray-800 text-base leading-relaxed" />
          </div>
        </div>
      </div>
    </>
  )
}

const AGE_GROUPS: { key: AgeGroup; range: string; color: string }[] = [
  { key: '30대', range: '2026~2035', color: 'from-blue-500 to-blue-700' },
  { key: '40대', range: '2036~2045', color: 'from-purple-500 to-purple-700' },
  { key: '50대', range: '2046~2055', color: 'from-orange-500 to-orange-700' },
  { key: '60대', range: '2056~2065', color: 'from-green-500 to-green-700' },
]

interface GoalFormData {
  title: string
  age_group: AgeGroup
  progress: GoalProgress
  goal_type: GoalType | ''
  target_date: string
  start_value: string
  end_value: string
  description: string
}

const defaultForm: GoalFormData = {
  title: '', age_group: '30대', progress: '2.아이디어',
  goal_type: '', target_date: '', start_value: '', end_value: '', description: '',
}

function GoalForm({ initialData, onSubmit, onCancel }: {
  initialData?: Partial<GoalFormData>
  onSubmit: (data: GoalFormData) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<GoalFormData>({ ...defaultForm, ...initialData })
  const [loading, setLoading] = useState(false)
  const set = <K extends keyof GoalFormData>(k: K, v: GoalFormData[K]) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setLoading(true)
    try { await onSubmit(form) } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">목표명 *</label>
        <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
          placeholder="목표를 입력하세요" required autoFocus
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">나이 단위</label>
          <select value={form.age_group} onChange={e => set('age_group', e.target.value as AgeGroup)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            {AGE_GROUPS.map(g => <option key={g.key} value={g.key}>{g.key}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">유형</label>
          <select value={form.goal_type} onChange={e => set('goal_type', e.target.value as GoalType | '')}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">선택 안함</option>
            <option value="사업목표">💼 사업목표</option>
            <option value="개인목표">🙋 개인목표</option>
            <option value="가족목표">❤️ 가족목표</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">진행 상태</label>
          <select value={form.progress} onChange={e => set('progress', e.target.value as GoalProgress)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="2.아이디어">💡 아이디어</option>
            <option value="1.진행 중">🔥 진행 중</option>
            <option value="3.완료">✅ 완료</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">완료 예정일</label>
          <input type="date" value={form.target_date} onChange={e => set('target_date', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">시작 값</label>
          <input type="number" value={form.start_value} onChange={e => set('start_value', e.target.value)}
            placeholder="예: 0"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">종료 값 (목표)</label>
          <input type="number" value={form.end_value} onChange={e => set('end_value', e.target.value)}
            placeholder="예: 100"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={loading || !form.title.trim()} className="flex-1">
          {loading ? '저장 중...' : '저장'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">취소</Button>
      </div>
    </form>
  )
}

function GoalCard({ goal, onUpdate, onDelete, onOpenDetail }: {
  goal: LifeGoal
  onUpdate: (g: LifeGoal) => void
  onDelete: (id: string, deletedGoal: LifeGoal, annualKeys: string[]) => void
  onOpenDetail: (goal: LifeGoal) => void
}) {
  const [editOpen, setEditOpen] = useState(false)

  const completionAge = goal.birthday && goal.target_date ? calcCompletionAge(goal.birthday, goal.target_date) : null
  const daysLeft = goal.target_date ? calcDaysLeft(goal.target_date) : null
  const progressPct = calcProgressPct(goal.start_value, goal.end_value)

  const typeConfig = goal.goal_type ? GOAL_TYPE_CONFIG[goal.goal_type] : null
  const progressConfig = GOAL_PROGRESS_CONFIG[goal.progress]
  const isCompleted = goal.progress === '3.완료'

  const handleEdit = async (formData: GoalFormData) => {
    const updated = await updateLifeGoal(goal.id, {
      title: formData.title,
      age_group: formData.age_group,
      progress: formData.progress,
      goal_type: formData.goal_type || null,
      target_date: formData.target_date || null,
      start_value: formData.start_value ? parseFloat(formData.start_value) : null,
      end_value: formData.end_value ? parseFloat(formData.end_value) : null,
      // description은 GoalDetailModal 에디터에서만 수정
    })
    onUpdate(updated)
    setEditOpen(false)
  }

  const handleDelete = async () => {
    if (!confirm(`"${goal.title}" 목표를 삭제할까요?`)) return
    let annualKeys: string[] = []
    try { annualKeys = await getMappedAnnualPeriodKeys(goal.id) } catch { /* ignore */ }
    await deleteLifeGoal(goal.id)
    onDelete(goal.id, goal, annualKeys)
  }

  return (
    <>
      <div className={`bg-white rounded-xl border transition-all hover:shadow-md cursor-pointer ${isCompleted ? 'border-gray-100 opacity-70' : 'border-gray-200'}`}
        onClick={() => onOpenDetail(goal)}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className={`text-sm font-semibold leading-snug ${isCompleted ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {goal.title}
            </p>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={e => { e.stopPropagation(); setEditOpen(true) }} className="text-gray-400 hover:text-gray-600 text-sm"><Pencil size={14} /></button>
              <button onClick={e => { e.stopPropagation(); handleDelete() }} className="text-gray-400 hover:text-red-500 text-sm"><Trash2 size={14} /></button>
            </div>
          </div>

          {/* 배지들 */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {typeConfig && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeConfig.color}`}>
                {typeConfig.icon} {typeConfig.label}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${progressConfig.color}`}>
              {progressConfig.label}
            </span>
          </div>

          {/* 속성 그리드 */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            {goal.target_date && (
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-400 mb-0.5">완료 예정</p>
                <p className="text-gray-700 font-medium">{goal.target_date}</p>
              </div>
            )}
            {completionAge !== null && (
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-400 mb-0.5">완료 나이</p>
                <p className="text-gray-700 font-medium">{completionAge}세</p>
              </div>
            )}
            {daysLeft !== null && (
              <div className={`rounded-lg p-2 ${daysLeft < 365 ? 'bg-red-50' : daysLeft < 1825 ? 'bg-yellow-50' : 'bg-gray-50'}`}>
                <p className="text-gray-400 mb-0.5">남은 일수</p>
                <p className={`font-medium ${daysLeft < 365 ? 'text-red-600' : daysLeft < 1825 ? 'text-yellow-600' : 'text-gray-700'}`}>
                  {daysLeft > 0 ? `D-${daysLeft}` : `D+${Math.abs(daysLeft)}`}
                </p>
              </div>
            )}
          </div>

          {/* 진행 상황 바 */}
          {progressPct !== null && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>진행 상황 ({goal.start_value ?? 0} → {goal.end_value})</span>
                <span className="font-medium text-gray-600">{progressPct}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}

          {/* 상세 내용 미리보기 */}
          {goal.description && (
            <p className="mt-3 text-xs text-gray-400 bg-gray-50 rounded-lg p-2 leading-relaxed line-clamp-2">
              클릭하여 세부 내용 보기 →
            </p>
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>목표 수정</DialogTitle></DialogHeader>
          <GoalForm
            initialData={{
              title: goal.title, age_group: goal.age_group, progress: goal.progress,
              goal_type: goal.goal_type ?? '', target_date: goal.target_date ?? '',
              start_value: goal.start_value?.toString() ?? '', end_value: goal.end_value?.toString() ?? '',
              description: goal.description ?? '',
            }}
            onSubmit={handleEdit}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function DecadePage() {
  const [activeGroup, setActiveGroup] = useState<AgeGroup>('30대')
  const [goals, setGoals] = useState<LifeGoal[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detailGoal, setDetailGoal] = useState<LifeGoal | null>(null)
  const { push: pushUndo } = useUndo()

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getLifeGoals(activeGroup)
    setGoals(data)
    setLoading(false)
  }, [activeGroup])

  useEffect(() => { load() }, [load])

  const handleGoalDeleted = useCallback((id: string, deletedGoal: LifeGoal, annualKeys: string[]) => {
    setGoals(prev => prev.filter(g => g.id !== id))
    pushUndo({
      label: `"${deletedGoal.title}" 목표 삭제됨`,
      restore: async () => {
        const restored = await createLifeGoal({
          notion_id: deletedGoal.notion_id,
          title: deletedGoal.title,
          age_group: deletedGoal.age_group,
          progress: deletedGoal.progress,
          goal_type: deletedGoal.goal_type,
          target_date: deletedGoal.target_date,
          birthday: deletedGoal.birthday,
          start_value: deletedGoal.start_value,
          end_value: deletedGoal.end_value,
          description: deletedGoal.description,
          sort_order: deletedGoal.sort_order,
        })
        await Promise.allSettled(annualKeys.map(k => createLifeGoalAnnualMapping(restored.id, k)))
        if (restored.age_group === activeGroup) {
          setGoals(prev => [...prev, restored])
        }
      },
    })
  }, [activeGroup, pushUndo])

  const handleAdd = async (formData: GoalFormData) => {
    await createLifeGoal({
      notion_id: null,
      title: formData.title,
      age_group: formData.age_group,
      progress: formData.progress,
      goal_type: formData.goal_type || null,
      target_date: formData.target_date || null,
      birthday: '1995-09-07',
      start_value: formData.start_value ? parseFloat(formData.start_value) : null,
      end_value: formData.end_value ? parseFloat(formData.end_value) : null,
      description: formData.description || null,
      sort_order: goals.length,
    })
    setAddOpen(false)
    load()
  }

  const activeInfo = AGE_GROUPS.find(g => g.key === activeGroup)!
  const typeGroups = {
    '사업목표': goals.filter(g => g.goal_type === '사업목표'),
    '개인목표': goals.filter(g => g.goal_type === '개인목표'),
    '가족목표': goals.filter(g => g.goal_type === '가족목표'),
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">10년 단위 계획</h1>
          <p className="hidden md:block text-gray-500 mt-1">노션 인생 목표 추적기 · {goals.length}개 목표</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="text-xs md:text-sm px-3 md:px-4">+ 목표 추가</Button>
      </div>

      {/* 연대 탭 */}
      <div className="flex gap-1.5 md:gap-3 mb-4 md:mb-6">
        {AGE_GROUPS.map(g => (
          <button key={g.key} onClick={() => setActiveGroup(g.key)}
            className={`flex-1 py-2 md:py-3 px-2 md:px-4 rounded-xl border-2 text-sm font-medium transition-all ${
              activeGroup === g.key
                ? 'border-blue-400 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
            }`}>
            <div className="font-bold text-xs md:text-sm">{g.key}</div>
            <div className="hidden md:block text-xs font-normal opacity-70 mt-0.5">{g.range}</div>
          </button>
        ))}
      </div>

      {/* 헤더 배너 */}
      <div className={`bg-gradient-to-r ${activeInfo.color} rounded-xl p-5 mb-6 text-white`}>
        <p className="text-sm opacity-80 flex items-center gap-1"><Rocket size={20} /> {activeGroup} 인생 목표</p>
        <p className="text-xs opacity-60 mt-1">{activeInfo.range} · {goals.length}개 목표 설정됨</p>
        <div className="flex gap-4 mt-3 text-xs">
          {(['사업목표', '개인목표', '가족목표'] as GoalType[]).map(t => (
            <span key={t} className="bg-white/20 px-2 py-0.5 rounded-full">
              {GOAL_TYPE_CONFIG[t].icon} {t} {goals.filter(g => g.goal_type === t).length}개
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : goals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
          <div className="flex justify-center mb-3"><Target size={20} /></div>
          <p className="text-gray-500 font-medium">{activeGroup} 목표를 설정해보세요</p>
          <Button variant="outline" className="mt-4" onClick={() => setAddOpen(true)}>첫 목표 추가하기</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {(['사업목표', '개인목표', '가족목표'] as GoalType[]).map(type => {
            const items = typeGroups[type]
            if (items.length === 0) return null
            const config = GOAL_TYPE_CONFIG[type]
            return (
              <div key={type}>
                <h2 className={`text-xs font-semibold px-2 py-1 rounded-lg inline-block mb-3 ${config.color}`}>
                  {config.icon} {config.label} ({items.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map(goal => (
                    <GoalCard key={goal.id} goal={goal}
                      onUpdate={updated => setGoals(prev => prev.map(g => g.id === updated.id ? updated : g))}
                      onDelete={handleGoalDeleted}
                      onOpenDetail={setDetailGoal}
                    />
                  ))}
                </div>
              </div>
            )
          })}
          {/* 유형 미분류 */}
          {goals.filter(g => !g.goal_type).map(goal => (
            <GoalCard key={goal.id} goal={goal}
              onUpdate={updated => setGoals(prev => prev.map(g => g.id === updated.id ? updated : g))}
              onDelete={handleGoalDeleted}
              onOpenDetail={setDetailGoal}
            />
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{activeGroup} 목표 추가</DialogTitle></DialogHeader>
          <GoalForm
            initialData={{ age_group: activeGroup }}
            onSubmit={handleAdd}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {detailGoal && (
        <GoalDetailModal
          goal={detailGoal}
          onClose={() => setDetailGoal(null)}
          onUpdate={updated => {
            setGoals(prev => prev.map(g => g.id === updated.id ? updated : g))
            setDetailGoal(updated)
          }}
        />
      )}
    </div>
  )
}
