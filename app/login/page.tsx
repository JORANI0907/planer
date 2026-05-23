'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Lock } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (data.ok) {
        const from = params.get('from') ?? '/'
        router.replace(from)
      } else {
        setError(data.error ?? '비밀번호가 올바르지 않습니다.')
        setPassword('')
        inputRef.current?.focus()
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="JDH" className="w-16 h-16 rounded-2xl mb-3 shadow-md" />
          <h1 className="text-xl font-bold text-gray-900">인생 플래너</h1>
          <p className="text-sm text-gray-500 mt-1">푯대를 향해 나아가는 자</p>
        </div>

        {/* 카드 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
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

            {error && (
              <p className="text-xs text-red-500 px-1">{error}</p>
            )}

            <button
              type="submit"
              disabled={!password || loading}
              className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : '입장'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
