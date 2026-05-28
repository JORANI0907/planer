import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

type MessageParam = { role: 'user' | 'assistant'; content: string }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function buildContext(): Promise<string> {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  const [
    { data: sessions },
    { data: todayDiet },
    { data: recentDiet },
    { data: activeProgram },
    { data: recentSets },
  ] = await Promise.all([
    supabase
      .from('fitness_sessions')
      .select('id, date, split_name, duration_min, is_completed')
      .gte('date', weekAgo)
      .order('date', { ascending: false })
      .limit(10),
    supabase
      .from('fitness_diet')
      .select('*')
      .eq('date', today)
      .maybeSingle(),
    supabase
      .from('fitness_diet')
      .select('*')
      .order('date', { ascending: false })
      .limit(7),
    supabase
      .from('fitness_programs')
      .select('name, description')
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('fitness_sets')
      .select('exercise_name, weight_kg, reps, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  // 컴파운드 리프트 최고 1RM 계산
  const compound1RMs: Record<string, number> = {}
  const COMPOUNDS = ['벤치프레스', '데드리프트', '스쿼트', '오버헤드프레스', '바벨로우']
  for (const set of recentSets ?? []) {
    if (COMPOUNDS.includes(set.exercise_name)) {
      const rm = Math.round(set.weight_kg * (1 + set.reps / 30))
      if (!compound1RMs[set.exercise_name] || rm > compound1RMs[set.exercise_name]) {
        compound1RMs[set.exercise_name] = rm
      }
    }
  }

  const lines: string[] = [
    '=== 사용자 프로필 ===',
    '몸무게: 75kg, 키: 178cm, 목표: 근비대 (hypertrophy)',
    '',
    `=== 현재 프로그램 ===`,
    activeProgram ? `${activeProgram.name}${activeProgram.description ? ` (${activeProgram.description})` : ''}` : '프로그램 없음',
    '',
    '=== 최근 1주일 운동 세션 ===',
  ]

  for (const s of sessions ?? []) {
    lines.push(`- ${s.date} ${s.split_name ?? '(분할 없음)'} ${s.is_completed ? '완료' : '미완료'}${s.duration_min ? ` ${s.duration_min}분` : ''}`)
  }
  if (!sessions?.length) lines.push('- 기록 없음')

  lines.push('')
  lines.push('=== 최근 컴파운드 추정 1RM ===')
  const rmEntries = Object.entries(compound1RMs)
  if (rmEntries.length > 0) {
    for (const [name, rm] of rmEntries) lines.push(`- ${name}: ~${rm}kg`)
  } else {
    lines.push('- 데이터 없음')
  }

  lines.push('')
  lines.push('=== 오늘 식단 ===')
  if (todayDiet) {
    lines.push(`칼로리: ${todayDiet.calories}kcal, 단백질: ${todayDiet.protein_g}g, 탄수화물: ${todayDiet.carbs_g}g, 지방: ${todayDiet.fat_g}g, 수분: ${todayDiet.water_l}L`)
    if (todayDiet.memo) lines.push(`메모: ${todayDiet.memo}`)
  } else {
    lines.push('- 오늘 식단 기록 없음')
  }

  lines.push('')
  lines.push('=== 최근 7일 식단 요약 ===')
  for (const d of recentDiet ?? []) {
    lines.push(`- ${d.date}: ${d.calories}kcal, 단백질 ${d.protein_g}g`)
  }
  if (!recentDiet?.length) lines.push('- 데이터 없음')

  return lines.join('\n')
}

const SYSTEM_PROMPT = `당신은 개인 피트니스 & 식단 AI 코치입니다.
사용자의 실제 운동 기록과 식단 데이터가 매 대화마다 최신 컨텍스트로 제공됩니다.

역할:
- 운동 프로그램 설계 (분할, 세트/렙, 중량 제안)
- 식단 플랜 작성 (근비대 목표, 매크로 계산)
- 일일/주간 퍼포먼스 분석 및 피드백
- 점진적 과부하 전략 제안 (1RM 기반)
- 부상 예방 및 회복 조언

규칙:
- 한국어로 답변
- 데이터 기반으로 구체적이고 실용적인 조언
- 근비대 최적화 원칙 적용 (단백질 체중×2g, 칼로리 잉여, 복합 운동 우선)
- 프로그램 제안 시 현재 1RM 데이터를 반영한 중량 범위 포함
- 응답은 간결하고 실천 가능하게`

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as { messages: MessageParam[] }

    const context = await buildContext()
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `${SYSTEM_PROMPT}\n\n[현재 사용자 데이터]\n${context}`,
      messages,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        controller.close()
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (e) {
    console.error(e)
    return new Response('코치 서비스 오류가 발생했습니다.', { status: 500 })
  }
}
