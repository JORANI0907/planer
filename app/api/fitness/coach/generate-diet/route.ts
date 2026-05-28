import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { buildContext } from '../_context'

export const runtime = 'nodejs'

type ConversationMessage = { role: 'user' | 'assistant'; content: string }

export type GeneratedDiet = {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  water_l: number
  memo: string
  coaching_note: string
}

const SYSTEM = `당신은 스포츠 영양 전문가입니다. 사용자의 운동 강도와 목표, 그리고 대화에서 수집한 요구사항을 모두 반영해 하루 식단 매크로를 계산합니다.

계산 원칙:
- 사용자가 대화에서 언급한 목표(벌크/린벌크/컷팅/유지), 식이 제한 등 최우선 반영
- 단백질: 체중 × 1.8~2.2g (근비대 필수)
- 탄수화물: 총 칼로리의 40~50%
- 지방: 총 칼로리의 20~30%
- 칼로리: 목표에 따라 유지 ±200~500kcal
- 수분: 최소 2L (운동일 2.5L 이상)
- memo: 아침/점심/저녁/간식 식단 제안 (간결하게)
- coaching_note: 한국어 2-3문장, 사용자 요구사항 반영 내용 포함`

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
      max_tokens: 1024,
      system: `${SYSTEM}\n\n[사용자 데이터]\n${context}${conversationContext}`,
      messages: [{ role: 'user', content: '위의 사용자 데이터와 대화 내용을 바탕으로 오늘의 식단 목표를 계산해줘.' }],
      tools: [{
        name: 'save_diet_plan',
        description: '하루 식단 목표 매크로 저장',
        input_schema: {
          type: 'object' as const,
          properties: {
            calories: { type: 'number', description: '총 칼로리 (kcal)' },
            protein_g: { type: 'number', description: '단백질 (g)' },
            carbs_g: { type: 'number', description: '탄수화물 (g)' },
            fat_g: { type: 'number', description: '지방 (g)' },
            water_l: { type: 'number', description: '수분 (L)' },
            memo: { type: 'string', description: '아침/점심/저녁 식단 제안 (간결하게)' },
            coaching_note: { type: 'string', description: '코칭 설명 (한국어 2-3문장)' },
          },
          required: ['calories', 'protein_g', 'carbs_g', 'fat_g', 'water_l', 'memo', 'coaching_note'],
        },
      }],
      tool_choice: { type: 'tool', name: 'save_diet_plan' },
    })

    const toolBlock = response.content.find(b => b.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      throw new Error('No tool_use block in response')
    }

    return NextResponse.json(toolBlock.input as GeneratedDiet)
  } catch (e) {
    console.error('[generate-diet]', e)
    return NextResponse.json({ error: '식단 플랜 생성 실패' }, { status: 500 })
  }
}
