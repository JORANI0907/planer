import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { buildContext } from '../_context'

export const runtime = 'nodejs'

export type GeneratedFeedback = {
  summary: string
  good_points: string[]
  improve_points: string[]
  next_action: string
}

type FeedbackParams = {
  type: 'today' | 'week' | 'trend'
  focus: 'overall' | 'volume' | 'strength' | 'fatigue'
  extra_note?: string
}

const TYPE_DESC: Record<string, string> = {
  today: '오늘 운동한 내용',
  week: '이번 주 운동 전체',
  trend: '최근 2주 운동 트렌드',
}

const FOCUS_DESC: Record<string, string> = {
  overall: '전반적인 운동 상태',
  volume: '근육군별 볼륨 분포와 균형',
  strength: '컴파운드 1RM 추세와 근력 발전',
  fatigue: '피로도·회복 상태와 과훈련 징후',
}

const SYSTEM = `당신은 데이터 기반 피트니스 코치입니다. 사용자의 실제 운동 기록을 분석해 구체적이고 실행 가능한 피드백을 제공합니다.

피드백 원칙:
- 모든 분석은 실제 수치(세트 수, kg, 1RM 등)를 근거로 함
- 막연한 격려 대신 구체적 수치와 비교 제시
- 잘한 점 1-2가지, 개선할 점 1-2가지로 구조화
- next_action은 다음 운동에서 바로 실천할 수 있는 1가지 액션
- 데이터 없는 부분은 "기록 없음"으로 솔직하게 표시
- 한국어, 친근하지만 전문적인 톤`

export async function POST(req: NextRequest) {
  try {
    const params = await req.json() as FeedbackParams
    const context = await buildContext()
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const requestDesc = [
      `분석 범위: ${TYPE_DESC[params.type]}`,
      `포커스: ${FOCUS_DESC[params.focus]}`,
      params.extra_note ? `추가 메모: ${params.extra_note}` : null,
    ].filter(Boolean).join('\n')

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `${SYSTEM}\n\n[사용자 데이터]\n${context}`,
      messages: [{
        role: 'user',
        content: `아래 조건으로 운동 피드백을 분석해줘.\n\n[분석 조건]\n${requestDesc}`,
      }],
      tools: [{
        name: 'save_feedback',
        description: '분석된 운동 피드백을 구조화하여 저장',
        input_schema: {
          type: 'object' as const,
          properties: {
            summary: { type: 'string', description: '전체 요약 (1-2문장, 수치 포함)' },
            good_points: {
              type: 'array',
              items: { type: 'string' },
              description: '잘한 점 1-2가지 (각각 수치 근거 포함)',
            },
            improve_points: {
              type: 'array',
              items: { type: 'string' },
              description: '개선할 점 1-2가지 (각각 구체적 방법 포함)',
            },
            next_action: { type: 'string', description: '다음 운동에서 바로 실천할 1가지 액션' },
          },
          required: ['summary', 'good_points', 'improve_points', 'next_action'],
        },
      }],
      tool_choice: { type: 'tool', name: 'save_feedback' },
    })

    const toolBlock = response.content.find(b => b.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') throw new Error('No tool_use block')

    return NextResponse.json(toolBlock.input as GeneratedFeedback)
  } catch (e) {
    console.error('[generate-feedback]', e)
    return NextResponse.json({ error: '피드백 생성 실패' }, { status: 500 })
  }
}
