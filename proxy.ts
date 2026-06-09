import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const COOKIE = 'planner_auth'

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

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

  const validPass = (process.env.AUTH_PASS ?? '').replace(/^["']|["']$/g, '').trim()
  if (!validPass) return NextResponse.next()

  if (req.cookies.get(COOKIE)?.value === '1') {
    return NextResponse.next()
  }

  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
