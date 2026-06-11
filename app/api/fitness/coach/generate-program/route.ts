import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { buildContext } from '../_context'

export const runtime = 'nodejs'

export type GeneratedProgram = {
  name: string
  description: string
  splits: Array<{ name: string; exercises: Array<{ name: string; target_sets: number; target_reps: string }> }>
  coaching_note: string
}

type ProgramParams = {
  goal: string
  weekly_days: number
  split_type: string
  focus_muscle: string
  duration_weeks: number
  extra_note?: string
}

const SYSTEM = `당신은 근비대 전문 피트니스 코치입니다. 사용자의 실제 운동 기록, 1RM 데이터, 프로필 정보를 분석해 맞춤 운동 프로그램을 설계합니다.

프로그램 설계 원칙:
- 사용자 프로필(목표·경력·주간일수)과 요청 파라미터를 최우선으로 반영
- 각 종목마다 target_sets와 target_reps 반드시 지정
- 근비대: 3-4세트, 8-12회 / 파워: 4-5세트, 3-6회 / 지구력: 2-3세트, 15-20회
- 각 분할당 주요 종목 4-6개, 경력에 맞는 난이도
- 현재 1RM 데이터를 반영해 프로그램 강도 설정
- 모든 종목명은 한국어 사용
- coaching_note는 한국어 2-3문장, 내 정보 기반으로 개인화`

export async function POST(req: NextRequest) {
  try {
    const params = await req.json() as ProgramParams
    const context = await buildContext()
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const requestDesc = [
      `목표: ${params.goal}`,
      `주 운동 일수: ${params.weekly_days}일`,
      `분할 방식: ${params.split_type}`,
      `집중 부위: ${params.focus_muscle}`,
      `기간: ${params.duration_weeks}주`,
      params.extra_note ? `추가 요청: ${params.extra_note}` : null,
    ].filter(Boolean).join('\n')

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `${SYSTEM}\n\n[사용자 데이터]\n${context}`,
      messages: [{
        role: 'user',
        content: `위 사용자 데이터와 아래 요청사항을 바탕으로 맞춤 운동 프로그램을 생성해줘.\n\n[요청사항]\n${requestDesc}`,
      }],
      tools: [{
        name: 'save_workout_program',
        description: '생성된 운동 프로그램을 구조화하여 저장',
        input_schema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', description: '프로그램 이름 (예: PPL 5일 근비대)' },
            description: { type: 'string', description: '간결한 프로그램 설명 (1줄)' },
            splits: {
              type: 'array',
              description: '운동 분할 목록',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: '분할 이름 (예: Push - 가슴/어깨/삼두)' },
                  exercises: {
                    type: 'array',
                    description: '종목 목록 (4-6개)',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        target_sets: { type: 'number' },
                        target_reps: { type: 'string' },
                      },
                      required: ['name', 'target_sets', 'target_reps'],
                    },
                  },
                },
                required: ['name', 'exercises'],
              },
            },
            coaching_note: { type: 'string', description: '코칭 설명 (한국어, 2-3문장)' },
          },
          required: ['name', 'description', 'splits', 'coaching_note'],
        },
      }],
      tool_choice: { type: 'tool', name: 'save_workout_program' },
    })

    const toolBlock = response.content.find(b => b.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') throw new Error('No tool_use block')

    return NextResponse.json(toolBlock.input as GeneratedProgram)
  } catch (e) {
    console.error('[generate-program]', e)
    return NextResponse.json({ error: '프로그램 생성 실패' }, { status: 500 })
  }
}
