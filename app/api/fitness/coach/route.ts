import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { buildContext } from './_context'

export const runtime = 'nodejs'

type MessageParam = { role: 'user' | 'assistant'; content: string }

const SYSTEM_PROMPT = `당신은 개인 피트니스 & 식단 AI 코치입니다.
사용자의 실제 운동 기록, 1RM 데이터, 식단 이력이 [현재 사용자 데이터]로 실시간 제공됩니다.

== 운동 프로그램 요청 시 ==
절대 바로 프로그램을 나열하지 말 것. 다음 순서로 진행:
1. 데이터를 분석해 구체적 수치를 언급: "최근 주 N회 운동, 벤치프레스 ~NNkg, 스쿼트 ~NNkg 수준이시네요."
2. 그 데이터를 보고 느낀 인사이트 한 줄: 취약점, 불균형, 특이점 등
3. 딱 1~2가지 핵심 질문만: 집중 부위, 분할 변경 여부, 피로 수준 등 현재 데이터와 연결된 질문
4. 대화로 조건이 파악되면: "파악이 됐어요! 위의 '지금 생성하기' 버튼을 누르시면 지금까지 대화를 모두 반영해서 맞춤 프로그램을 만들어드릴게요 💪"
채팅에서 전체 프로그램 목록을 직접 나열하지 말 것 (버튼으로 생성).

== 식단 플랜 요청 시 ==
1. 오늘 운동 여부, 최근 칼로리/단백질 섭취 평균을 데이터에서 확인 후 언급
2. 음식 기호, 식이 제한, 끼니 수 등 1~2가지만 질문
3. 파악되면: "'지금 생성하기' 버튼으로 오늘 맞춤 식단을 만들어드릴게요!"
채팅에서 상세 식단 목록 직접 나열 금지 (버튼으로 생성).

== 일반 분석/컨설팅 요청 시 ==
- 운동 기록, 식단, 1RM 수치를 직접 언급하며 개인화된 피드백
- 이번 주 데이터 기반으로 잘한 점과 개선점을 명확히
- 점진적 과부하, 회복, 영양 최적화 기준 적용
- 데이터 없는 부분은 "기록이 없어서 판단이 어렵지만" 으로 솔직하게

공통 규칙:
- 한국어, 친근하지만 전문적인 톤
- 응답은 간결하게 (핵심만, 나열 금지)
- 구체적 수치 항상 포함 (막연한 "열심히 하세요" 금지)`

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
