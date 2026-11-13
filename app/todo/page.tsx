import { redirect } from 'next/navigation'

// TO-DO 탭은 메모장(/memo) + 세부전략 실행항목으로 역할이 나뉘어 제거됨.
export default function TodoPage() {
  redirect('/memo')
}
