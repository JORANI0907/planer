import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const COOKIE = 'planner_auth'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 인증 불필요 경로
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/icon.svg' ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png')
  ) {
    return NextResponse.next()
  }

  // AUTH_PASS 미설정 시 보호 없이 통과
  const validPass = (process.env.AUTH_PASS ?? '').replace(/^["']|["']$/g, '').trim()
  if (!validPass) return NextResponse.next()

  // 인증 쿠키 확인
  if (req.cookies.get(COOKIE)?.value === '1') {
    return NextResponse.next()
  }

  // 미인증 → 로그인 페이지로 리다이렉트
  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
