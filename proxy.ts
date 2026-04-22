import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const COOKIE = 'planner_auth'

function stripQuotes(s: string) {
  return s.replace(/^["']|["']$/g, '').trim()
}

export function proxy(req: NextRequest) {
  const validPass = stripQuotes(process.env.AUTH_PASS ?? '')
  if (!validPass) return NextResponse.next()

  // 이미 인증된 세션이면 통과
  if (req.cookies.get(COOKIE)?.value === '1') {
    return NextResponse.next()
  }

  const basicAuth = req.headers.get('authorization')
  if (basicAuth) {
    const [scheme, encoded] = basicAuth.split(' ')
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded)
      const colonIndex = decoded.indexOf(':')
      const user = decoded.slice(0, colonIndex)
      const pass = decoded.slice(colonIndex + 1)
      const validUser = stripQuotes(process.env.AUTH_USER ?? 'admin')
      if (user.trim() === validUser && pass.trim() === validPass) {
        // 인증 성공 → 대시보드로 리다이렉트 + 세션 쿠키 설정
        const res = NextResponse.redirect(new URL('/', req.url))
        res.cookies.set(COOKIE, '1', {
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7, // 7일
          path: '/',
        })
        return res
      }
    }
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Planner"' },
  })
}

export const proxyConfig = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
