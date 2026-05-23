import { NextRequest, NextResponse } from 'next/server'

const COOKIE = 'planner_auth'

function strip(s: string) {
  return s.replace(/^["']|["']$/g, '').trim()
}

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  const validUser = strip(process.env.AUTH_USER ?? 'admin')
  const validPass = strip(process.env.AUTH_PASS ?? '')

  if (!validPass) {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE, '1', { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/' })
    return res
  }

  if (password !== validPass) {
    return NextResponse.json({ ok: false, error: '비밀번호가 올바르지 않습니다.' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return res
}
