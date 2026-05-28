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

type ConversationMessage = { role: 'user' | 'assistant'; content: string }

const SYSTEM = `당신은 근비대 전문 피트니스 코치입니다. 사용자의 실제 운동 기록과 1RM 데이터, 그리고 대화에서 수집한 요구사항을 모두 반영해 맞춤 운동 프로그램을 설계합니다.

프로그램 설계 원칙:
- 사용자가 대화에서 언급한 분할 수, 집중 부위, 경력 등을 최우선으로 반영
- 각 종목마다 목표 세트 수(target_sets)와 반복 범위(target_reps) 반드시 지정
- 근비대: 3-4세트, 8-12회 / 파워: 4-5세트, 3-6회 / 지구력: 2-3세트, 15-20회
- 각 분할당 주요 종목 4-6개, 경력에 맞는 난이도 조정
- 현재 1RM 및 최근 운동 종목 데이터 반영
- 모든 종목명은 한국어 사용 (예: 벤치프레스, 스쿼트)
- coaching_note는 한국어로 2-3문장, 사용자 요구사항 반영 여부 포함`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { conversation?: ConversationMessage[] }
    const context = await buildContext()
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const conversationContext = body.conversation?.length
      ? '\n\n[사용자 요구사항 대화]\n' + body.conversation
          .filter(m => m.content.trim())
          .map(m => `${m.role === 'user' ? '사용자' : '코치'}: ${m.content}`)
          .join('\n')
      : ''

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `${SYSTEM}\n\n[사용자 데이터]\n${context}${conversationContext}`,
      messages: [{ role: 'user', content: '위의 사용자 데이터와 대화 내용을 바탕으로 최적화된 운동 프로그램을 생성해줘.' }],
      tools: [{
        name: 'save_workout_program',
        description: '생성된 운동 프로그램을 구조화하여 저장',
        input_schema: {
          type: 'object' as const,
          properties: {
            name: { type: 'string', description: '프로그램 이름 (예: PPL 6일 분할)' },
            description: { type: 'string', description: '간결한 프로그램 설명' },
            splits: {
              type: 'array',
              description: '운동 분할 목록',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: '분할 이름 (예: Push - 가슴/어깨/삼두)' },
                  exercises: {
                    type: 'array',
                    description: '종목 목록 (한국어, 4-6개)',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: '종목 이름 (한국어)' },
                        target_sets: { type: 'number', description: '목표 세트 수 (예: 3, 4)' },
                        target_reps: { type: 'string', description: '목표 반복 범위 (예: 8-12, 3-6, 15-20)' },
                      },
                      required: ['name', 'target_sets', 'target_reps'],
                    },
                  },
                },
                required: ['name', 'exercises'],
              },
            },
            coaching_note: {
              type: 'string',
              description: '사용자에게 보여줄 코칭 설명 (한국어, 2-3문장)',
            },
          },
          required: ['name', 'description', 'splits', 'coaching_note'],
        },
      }],
      tool_choice: { type: 'tool', name: 'save_workout_program' },
    })

    const toolBlock = response.content.find(b => b.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      throw new Error('No tool_use block in response')
    }

    return NextResponse.json(toolBlock.input as GeneratedProgram)
  } catch (e) {
    console.error('[generate-program]', e)
    return NextResponse.json({ error: '프로그램 생성 실패' }, { status: 500 })
  }
}
