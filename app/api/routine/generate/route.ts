import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface RoutineTaskRow {
  id: string
  title: string
  is_active: boolean
  schedule_type: 'weekly' | 'monthly'
  weekly_days: number[]
  monthly_dates: number[]
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function POST() {
  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data: tasks, error: fetchError } = await supabase
    .from('routine_tasks')
    .select('id, title, is_active, schedule_type, weekly_days, monthly_dates')
    .eq('is_active', true)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const results = []
  const today = new Date()

  for (const task of (tasks ?? []) as RoutineTaskRow[]) {
    const targetDates: string[] = []

    for (let i = 0; i <= 14; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const matches =
        task.schedule_type === 'weekly'
          ? (task.weekly_days ?? []).includes(d.getDay())
          : (task.monthly_dates ?? []).includes(d.getDate())
      if (matches) targetDates.push(dateKey(d))
    }

    if (targetDates.length === 0) {
      results.push({ taskId: task.id, title: task.title, inserted: 0, skipped: 0 })
      continue
    }

    const { data: existing } = await supabase
      .from('plan_items')
      .select('period_key')
      .eq('routine_task_id', task.id)
      .in('period_key', targetDates)

    const existingSet = new Set((existing ?? []).map((r: { period_key: string }) => r.period_key))
    const newDates = targetDates.filter(d => !existingSet.has(d))

    if (newDates.length > 0) {
      const toInsert = newDates.map((date, idx) => ({
        level: 'daily',
        period_key: date,
        title: task.title,
        description: null,
        categories: [],
        status: 'pending',
        priority: 'medium',
        sort_order: 9999 + idx,
        routine_task_id: task.id,
      }))
      await supabase.from('plan_items').insert(toInsert)
    }

    results.push({ taskId: task.id, title: task.title, inserted: newDates.length, skipped: existingSet.size })
  }

  return NextResponse.json({ success: true, results })
}
