@AGENTS.md

# planner-app — 인생 플래너
# 최종 업데이트: 2026-04-21

---

## 프로젝트 개요

개인 라이프 플래닝 웹앱. 일별/주별/월별/분기별/10년 단위 계획, 마인드맵(Brain), 플로우맵(Kanban), 쇼핑 리스트, Telegram 아침/저녁 알림 통합.

- **작업 디렉토리**: `C:\Users\user\BBK-Workspace\apps\플래너 앱 개발\planner-app`
- **로컬 개발**: `npm run dev`

---

## 기술 스택

| 항목 | 버전 |
|------|------|
| Next.js | 16 (App Router) |
| React | 19 |
| TypeScript | 5 |
| Tailwind CSS | 4 |
| Supabase | 2.x (supabase-js + ssr) |
| @xyflow/react | 12 (노드 기반 에디터) |
| @dnd-kit/* | 드래그&드롭 |
| @tiptap/* | 리치 텍스트 에디터 |
| shadcn/ui | components.json 기반 |

---

## 소스 구조

```
planner-app/
├── app/
│   ├── api/telegram/        # Telegram 웹훅 (morning/evening/webhook)
│   ├── daily/ weekly/ monthly/ quarterly/ decade/
│   ├── brain/               # 마인드맵 페이지
│   ├── flowmap/             # 플로우맵 (Kanban) 페이지
│   ├── shopping/            # 쇼핑 리스트 페이지
│   ├── dashboard/ home/ profile/ split/
│   └── layout.tsx / page.tsx
├── components/
│   ├── brain/               # BrainCanvas, ModuleNode, ThoughtEdge 등
│   ├── flowmap/             # FlowMapCanvas, KanbanBoard, NodeDetailPanel 등
│   ├── shopping/            # ShoppingList, ItemCard, AddItemForm 등
│   ├── ui/                  # shadcn 컴포넌트 (Badge, Button, Card 등)
│   ├── sidebar.tsx
│   └── LayoutShell.tsx
└── lib/
    ├── supabase.ts          # Supabase 클라이언트
    ├── api.ts / brain-api.ts / shopping-api.ts
    ├── types.ts / brain-types.ts / shopping-types.ts
    ├── telegram.ts
    └── flowmap-layout.ts
```

---

## Supabase 연결

```ts
// lib/supabase.ts 사용
import { createClient } from '@/lib/supabase'
```

> bbk-app과 다른 Supabase 프로젝트일 수 있음 — `.env.local` 확인 필수

---

## 개발 규칙

- shadcn UI 컴포넌트는 `components/ui/` 재사용 우선
- 새 페이지: `app/[페이지명]/page.tsx` + `LayoutShell` 적용
- API 라우트: `app/api/[도메인]/route.ts`
- 타입: `lib/types.ts` 또는 도메인별 `*-types.ts` 확장
- 파일당 최대 800줄

---

## 에이전트 호출 패턴

| 작업 유형 | 담당 |
|---------|------|
| UI/레이아웃 | `bbk-designer` (데스크탑 + 모바일) |
| API/Supabase 로직 | `bbk-developer` |
| 테스트 | `bbk-tester` |
| 배포 | `bbk-deployer` (별도 Vercel 프로젝트) |
