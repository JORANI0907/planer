import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { buildContext } from './_context'

export const runtime = 'nodejs'

type MessageParam = { role: 'user' | 'assistant'; content: string }

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
