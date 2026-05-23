import { NextResponse } from 'next/server'

// 이 엔드포인트는 더 이상 자동으로 호출되지 않습니다.
// 필수과업 일정 생성은 사용자가 스위치를 켤 때 toggleRoutineTask() 에서 직접 처리합니다.
export async function POST() {
  return NextResponse.json({ success: true, message: 'Manual trigger disabled. Use toggle to generate schedules.' })
}
