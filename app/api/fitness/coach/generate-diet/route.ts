import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { buildContext } from '../_context'

export const runtime = 'nodejs'

export type GeneratedDiet = {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  water_l: number
  memo: string
  coaching_note: string
}

const SYSTEM = `당신은 스포츠 영양 전문가입니다. 사용자의 운동 강도와 근비대 목표에 맞는 하루 식단 매크로 목표를 계산합니다.

계산 원칙:
- 단백질: 체중 × 1.8~2.2g (근비대 필수)
- 탄수화물: 총 칼로리의 40~50% (운동 에너지원)
- 지방: 총 칼로리의 20~30%
- 칼로리: 유지 칼로리 + 200~400 (린 벌크) 또는 -300~500 (커팅)
- 수분: 최소 2L (운동일 2.5L 이상)
- memo: 아침/점심/저녁/간식 식단 제안 (간결하게 1-2줄)
- coaching_note: 한국어 2-3문장, 계산 근거 설명`

export async function POST() {
  try {
    const context = await buildContext()
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `${SYSTEM}\n\n[사용자 데이터]\n${context}`,
      messages: [{ role: 'user', content: '내 운동 강도와 목표에 맞는 오늘의 식단 목표를 계산해줘.' }],
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
