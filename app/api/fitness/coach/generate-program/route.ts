import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { buildContext } from '../_context'

export const runtime = 'nodejs'

export type GeneratedProgram = {
  name: string
  description: string
  splits: Array<{ name: string; exercises: string[] }>
  coaching_note: string
}

const SYSTEM = `당신은 근비대 전문 피트니스 코치입니다. 사용자의 실제 운동 기록과 1RM 데이터를 분석해 최적화된 운동 프로그램을 설계합니다.

프로그램 설계 원칙:
- 근비대 최적화: 각 종목 3-4세트, 8-12렙 범위
- 분할 수: 4-6개 (PPL, 상하체, 전신 등 사용자 데이터에 적합한 방식)
- 각 분할당 주요 종목 4-6개
- 현재 1RM 및 최근 운동 종목 데이터를 최대한 반영
- 모든 종목명은 한국어 사용 (예: 벤치프레스, 스쿼트)
- coaching_note는 한국어로 2-3문장, 프로그램 설계 이유 설명`

export async function POST() {
  try {
    const context = await buildContext()
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `${SYSTEM}\n\n[사용자 데이터]\n${context}`,
      messages: [{ role: 'user', content: '내 데이터를 분석해서 최적화된 운동 프로그램을 생성해줘.' }],
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
                    items: { type: 'string' },
                    description: '종목 이름 목록 (한국어, 4-6개)',
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
