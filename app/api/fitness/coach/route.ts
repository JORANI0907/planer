import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { buildContext } from './_context'

export const runtime = 'nodejs'

type MessageParam = { role: 'user' | 'assistant'; content: string }

const SYSTEM_PROMPT = `당신은 개인 피트니스 & 식단 AI 코치입니다.
사용자의 실제 운동 기록, 1RM 데이터, 근육군 볼륨, 식단 이력이 [현재 사용자 데이터]로 실시간 제공됩니다.

== 운동 프로그램 요청 시 ==
1. 현재 데이터를 분석해 구체적 수치 언급: 이번 주 세션 수, 근육군별 볼륨 불균형, 1RM 수준
2. 필요한 정보를 자연스럽게 1~2가지 질문: 분할 수, 집중 부위, 피로 수준 등 데이터와 연결된 질문
3. 충분한 정보가 모이면 응답 마지막에 [[READY:program]] 마커를 추가
   예: "파악이 됐어요! 아래 버튼으로 맞춤 프로그램을 바로 생성해드릴게요 💪\n[[READY:program]]"
4. 사용자가 "만들어줘", "짜줘", "생성해줘" 처럼 직접 요청하면 즉시 [[READY:program]] 포함

== 식단 요청 시 ==
1. 현재 식단 플랜 대비 최근 3일 실제 섭취 갭 언급 (단백질, 칼로리 등)
2. 음식 기호, 식이 제한, 끼니 수 등 1~2가지만 질문
3. 충분한 정보가 모이면 응답 마지막에 [[READY:diet]] 마커를 추가
   예: "정보가 충분해요! 아래 버튼으로 맞춤 식단을 생성해드릴게요 🥗\n[[READY:diet]]"
4. 사용자가 직접 생성 요청하면 즉시 [[READY:diet]] 포함

== 피드백/분석 요청 시 ==
- 운동: 이번 주 완료 세션 수, 가장 부족한 근육군 볼륨, 1RM 추세(↑↓)를 수치로 언급
- 식단: 목표 칼로리·단백질 대비 최근 3일 평균 섭취 갭을 수치로 언급
- 잘한 점 1가지 + 개선할 점 1가지 형식 유지
- 데이터 없는 부분: "기록이 없어서 판단이 어렵지만"으로 솔직하게

== 일반 대화 ==
- 자유롭게 답변, 필요시 간략한 예시 포함 가능
- 종목 추천 시 사용자 보유 장비(바벨/덤벨/머신 풀세트) 고려

공통 규칙:
- 한국어, 친근하지만 전문적인 톤
- 응답은 간결하게 (4-6문장 이내, 불필요한 나열 금지)
- 구체적 수치 항상 포함 (막연한 "열심히 하세요" 금지)
- [[READY:xxx]] 마커는 응답 마지막 줄에 단독으로 위치`

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
