import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export type SuggestedExercise = {
  name: string
  muscle_group: '가슴' | '등' | '어깨' | '하체' | '삼두' | '이두' | '복근' | '기타'
  is_compound: boolean
  reason: string
}

export type SuggestResult = {
  exercises: SuggestedExercise[]
  summary: string
}

const SYSTEM = `당신은 운동 전문가입니다. 사용자가 운동에 대해 설명하면 적합한 운동 종목들을 추천합니다.

원칙:
- 사용자 설명을 바탕으로 1~5개의 적합한 운동 종목 추천
- 종목명은 한국어로, 명확하고 표준적인 이름 사용 (예: 벤치프레스, 인클라인 덤벨컬)
- 근육군은 반드시 [가슴, 등, 어깨, 하체, 삼두, 이두, 복근, 기타] 중 하나
- is_compound: 2개 이상의 관절을 사용하는 복합운동이면 true
- reason: 이 종목을 추천하는 이유 한 줄 (구체적이고 실용적으로)`

export async function POST(req: NextRequest) {
  try {
    const { description } = (await req.json()) as { description: string }

    if (!description?.trim()) {
      return NextResponse.json({ error: '운동 설명을 입력해주세요.' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `다음 설명에 맞는 운동 종목을 추천해줘:\n\n"${description}"`,
        },
      ],
      tools: [
        {
          name: 'suggest_exercises',
          description: '운동 종목 추천 결과를 구조화하여 반환',
          input_schema: {
            type: 'object' as const,
            properties: {
              exercises: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: '종목명 (한국어)' },
                    muscle_group: {
                      type: 'string',
                      enum: ['가슴', '등', '어깨', '하체', '삼두', '이두', '복근', '기타'],
                    },
                    is_compound: { type: 'boolean' },
                    reason: { type: 'string', description: '추천 이유 한 줄' },
                  },
                  required: ['name', 'muscle_group', 'is_compound', 'reason'],
                },
                minItems: 1,
                maxItems: 5,
              },
              summary: { type: 'string', description: '추천 요약 한 줄' },
            },
            required: ['exercises', 'summary'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'suggest_exercises' },
    })

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('AI 응답 파싱 실패')
    }

    return NextResponse.json(toolUse.input as SuggestResult)
  } catch {
    return NextResponse.json({ error: '종목 추천에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 })
  }
}
