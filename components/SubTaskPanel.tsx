'use client'

import { useState, useEffect, useRef } from 'react'
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getTasksForItem, createTask, updateTask, deleteTask } from '@/lib/api'
import type { PlanItemTask } from '@/lib/types'

export function SortableRow({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: isDragging ? 'relative' as const : undefined,
    zIndex: isDragging ? 50 : undefined,
  }
  const handle = (
    <button
      {...attributes}
      {...listeners}
      className="touch-none cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0 select-none px-0.5"
      title="드래그하여 순서 변경"
    >⠿</button>
  )
  return <div ref={setNodeRef} style={style}>{children(handle)}</div>
}

export function SubTaskPanel({ itemId, autoFocus = true }: { itemId: string; autoFocus?: boolean }) {
  const [tasks, setTasks] = useState<PlanItemTask[]>([])
  const [loaded, setLoaded] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loaded) {
      getTasksForItem(itemId).then(t => { setTasks(t); setLoaded(true) })
    }
  }, [loaded, itemId])

  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 100)
  }, [autoFocus])

  const taskSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  const handleAdd = async () => {
    const t = newTitle.trim()
    if (!t) return
    const task = await createTask(itemId, t, tasks.length)
    setTasks(prev => [...prev, task])
    setNewTitle('')
  }

  const handleToggle = async (task: PlanItemTask) => {
    const updated = await updateTask(task.id, { is_completed: !task.is_completed })
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
  }

  const handleDelete = async (id: string) => {
    await deleteTask(id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const handleTaskRename = async (id: string, title: string) => {
    const updated = await updateTask(id, { title })
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
    setEditingId(null)
  }

  const handleTaskDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = tasks.findIndex(t => t.id === active.id)
    const newIdx = tasks.findIndex(t => t.id === over.id)
    const reordered = arrayMove(tasks, oldIdx, newIdx)
    setTasks(reordered)
    await Promise.all(reordered.map((task, idx) => updateTask(task.id, { sort_order: idx })))
  }

  if (!loaded) return <div className="px-4 py-3 text-xs text-gray-400">불러오는 중...</div>

  return (
    <div className="mx-3 mb-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
      <p className="text-xs font-semibold text-gray-500 mb-2">세부 내용</p>

      {tasks.length === 0 && (
        <p className="text-xs text-gray-400 mb-2">세부 내용을 추가하세요</p>
      )}

      <div className="space-y-1.5 mb-2">
        <DndContext sensors={taskSensors} collisionDetection={closestCenter} onDragEnd={handleTaskDragEnd}>
          <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map(task => (
              <SortableRow key={task.id} id={task.id}>
                {(handle) => (
                  <div className="group flex items-center gap-2">
                    {handle}
                    <button
                      onClick={() => handleToggle(task)}
                      className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                        task.is_completed ? 'bg-gray-500 border-gray-500' : 'border-gray-300 hover:border-gray-600'
                      }`}
                    >
                      {task.is_completed && (
                        <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      )}
                    </button>
                    {editingId === task.id ? (
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onBlur={() => {
                          const t = editTitle.trim()
                          if (t && t !== task.title) handleTaskRename(task.id, t)
                          else setEditingId(null)
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const t = editTitle.trim()
                            if (t && t !== task.title) handleTaskRename(task.id, t)
                            else setEditingId(null)
                          }
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="flex-1 text-xs border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none bg-white"
                      />
                    ) : (
                      <span className={`flex-1 text-xs ${task.is_completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {task.title}
                      </span>
                    )}
                    {!task.is_completed && editingId !== task.id && (
                      <button
                        onClick={() => { setEditingId(task.id); setEditTitle(task.title) }}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-400 text-xs"
                      >✎</button>
                    )}
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs"
                    >✕</button>
                  </div>
                )}
              </SortableRow>
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder="세부 내용 입력 후 Enter..."
          className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
        />
        <button
          onClick={handleAdd}
          disabled={!newTitle.trim()}
          className="text-xs bg-gray-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
        >
          추가
        </button>
      </div>
    </div>
  )
}
