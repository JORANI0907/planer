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
  breakfast: string
  lunch: string
  dinner: string
  snack: string
  memo: string
  coaching_note: string
}

const SYSTEM = `당신은 스포츠 영양 전문가입니다. 사용자의 프로필(몸무게·키·나이·목표·운동량)과 운동 기록을 분석해 영구적으로 사용할 수 있는 기본 일일 식단 플랜을 설계합니다.

계산 원칙:
- 단백질: 체중 × 1.8~2.2g (근비대/린벌크), 컷팅 시 × 2.2~2.5g
- 탄수화물: 총 칼로리의 40~50%
- 지방: 총 칼로리의 20~30%
- 칼로리: 린벌크 +200~300kcal, 근비대 +300~400kcal, 컷팅 -400~500kcal, 유지 TDEE
- 수분: 기본 2.5L (운동 주 4회 이상 3L)

각 식사(breakfast/lunch/dinner/snack)는 구체적인 음식명과 g 단위 분량을 포함해 실용적으로 작성하세요.
memo는 이 식단을 선택한 근거 (사용자 데이터 기반 1~2문장).
coaching_note는 사용자에게 전달할 동기부여 메시지 (한국어 1~2문장).`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { conversation?: ConversationMessage[] }
    const context = await buildContext()
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const conversationContext = body.conversation?.length
      ? '\n\n[추가 요청사항]\n' + body.conversation
          .filter(m => m.content.trim())
          .map(m => `${m.role === 'user' ? '사용자' : '코치'}: ${m.content}`)
          .join('\n')
      : ''

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: `${SYSTEM}\n\n[사용자 데이터]\n${context}${conversationContext}`,
      messages: [{ role: 'user', content: '위 데이터를 바탕으로 나에게 맞는 영구 기본 식단 플랜을 설계해줘. 아침/점심/저녁/간식 각각 구체적인 식품명과 양으로 작성해줘.' }],
      tools: [{
        name: 'save_diet_plan',
        description: '영구 기본 식단 플랜 저장',
        input_schema: {
          type: 'object' as const,
          properties: {
            calories:       { type: 'number', description: '총 칼로리 (kcal)' },
            protein_g:      { type: 'number', description: '단백질 (g)' },
            carbs_g:        { type: 'number', description: '탄수화물 (g)' },
            fat_g:          { type: 'number', description: '지방 (g)' },
            water_l:        { type: 'number', description: '수분 (L)' },
            breakfast:      { type: 'string', description: '아침 식단 — 구체적 식품명 + 분량' },
            lunch:          { type: 'string', description: '점심 식단 — 구체적 식품명 + 분량' },
            dinner:         { type: 'string', description: '저녁 식단 — 구체적 식품명 + 분량' },
            snack:          { type: 'string', description: '간식 — 구체적 식품명 + 분량' },
            memo:           { type: 'string', description: '이 식단을 선택한 데이터 기반 근거 (1~2문장)' },
            coaching_note:  { type: 'string', description: '동기부여 메시지 (한국어 1~2문장)' },
          },
          required: ['calories', 'protein_g', 'carbs_g', 'fat_g', 'water_l', 'breakfast', 'lunch', 'dinner', 'snack', 'memo', 'coaching_note'],
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
