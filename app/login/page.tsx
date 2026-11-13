'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Lock, Fingerprint } from 'lucide-react'
import { hasBiometric, biometricSupported, registerBiometric, unlockBiometric } from '@/lib/biometric'

function LoginForm() {
  const params = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [bioReady, setBioReady] = useState(false) // 이 기기에 지문 로그인 등록됨
  const [bioSupported, setBioSupported] = useState(false)
  const [bioBusy, setBioBusy] = useState(false)
  const [offerRegister, setOfferRegister] = useState(false)
  const pendingPw = useRef('')

  useEffect(() => {
    const ready = hasBiometric()
    setBioReady(ready)
    biometricSupported().then(setBioSupported).catch(() => {})
    if (!ready) inputRef.current?.focus()
  }, [])

  function goHome() {
    const from = params.get('from') ?? '/'
    window.location.replace(from) // 하드 네비게이션으로 미들웨어 재실행
  }

  // 비밀번호 검증. 성공 시 true.
  async function doLogin(pw: string): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      const data = await res.json()
      return !!data.ok
    } catch {
      setError('네트워크 오류가 발생했습니다.')
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || loading) return
    setLoading(true)
    setError('')
    const ok = await doLogin(password)
    setLoading(false)
    if (!ok) {
      setError('비밀번호가 올바르지 않습니다.')
      setPassword('')
      inputRef.current?.focus()
      return
    }
    // 로그인 성공 — 지문 등록 가능하고 아직 미등록이면 등록 제안
    if (bioSupported && !hasBiometric()) {
      pendingPw.current = password
      setOfferRegister(true)
    } else {
      goHome()
    }
  }

  const handleBioLogin = async () => {
    if (bioBusy) return
    setBioBusy(true)
    setError('')
    const pw = await unlockBiometric()
    if (!pw) {
      setBioBusy(false)
      setError('지문 인증에 실패했습니다. 비밀번호로 로그인하세요.')
      inputRef.current?.focus()
      return
    }
    const ok = await doLogin(pw)
    setBioBusy(false)
    if (ok) goHome()
    else setError('저장된 비밀번호가 더 이상 유효하지 않습니다. 비밀번호로 로그인하세요.')
  }

  const handleRegister = async () => {
    setBioBusy(true)
    setError('')
    const res = await registerBiometric(pendingPw.current)
    setBioBusy(false)
    if (res.ok) goHome()
    else setError(res.reason ?? '지문 등록에 실패했습니다.')
  }

  // ── 지문 등록 제안 화면 ──
  if (offerRegister) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
        <Fingerprint size={40} className="mx-auto text-blue-600 mb-3" />
        <h2 className="text-base font-bold text-gray-900">지문으로 빠르게 로그인</h2>
        <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
          이 기기에서 다음부터 지문(또는 Face·Windows Hello)으로 로그인할 수 있어요.<br />비밀번호는 지문으로 암호화되어 이 기기에만 저장됩니다.
        </p>
        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        <div className="flex flex-col gap-2 mt-5">
          <button
            onClick={handleRegister}
            disabled={bioBusy}
            className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {bioBusy ? <Loader2 size={16} className="animate-spin" /> : <><Fingerprint size={16} /> 지문 등록하고 입장</>}
          </button>
          <button onClick={goHome} disabled={bioBusy} className="w-full py-2.5 rounded-xl text-gray-500 text-sm font-medium hover:bg-gray-50">
            나중에 하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      {/* 지문 로그인 (등록된 기기) */}
      {bioReady && (
        <>
          <button
            onClick={handleBioLogin}
            disabled={bioBusy}
            className="w-full py-3.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2 mb-4"
          >
            {bioBusy ? <Loader2 size={16} className="animate-spin" /> : <><Fingerprint size={18} /> 지문으로 로그인</>}
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[11px] text-gray-400">또는 비밀번호</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
        </>
      )}

      <div className="flex items-center gap-2 mb-5">
        <Lock size={16} className="text-gray-400" />
        <span className="text-sm font-semibold text-gray-700">비밀번호 입력</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          ref={inputRef}
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="비밀번호"
          autoComplete="current-password"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition-all"
        />

        {error && <p className="text-xs text-red-500 px-1">{error}</p>}

        <button
          type="submit"
          disabled={!password || loading}
          className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : '입장'}
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="JDH PLANER" className="w-16 h-16 rounded-2xl mb-3 shadow-md object-cover" />
          <h1 className="text-xl font-bold text-gray-900">인생 플래너</h1>
          <p className="text-sm text-gray-500 mt-1">푯대를 향해 나아가는 자</p>
        </div>

        <Suspense fallback={<div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 h-32" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
