'use client'

import React, { useState, useEffect } from 'react'
import { Pencil, User, Calendar, PenLine, Activity, Monitor, ScrollText, Landmark, Award } from 'lucide-react'
import { getProfile, updateProfile } from '@/lib/api'
import { Button } from '@/components/ui/button'
import type { Profile } from '@/lib/types'

type ArrayField = 'physical_abilities' | 'computer_skills' | 'other_certificates' | 'social_career' | 'other_career' | 'religion'

const FIELD_CONFIG: { key: ArrayField; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'physical_abilities', label: '신체 능력', icon: <Activity size={16} />, color: 'bg-green-50 border-green-200' },
  { key: 'computer_skills', label: '컴퓨터 활용 능력', icon: <Monitor size={16} />, color: 'bg-blue-50 border-blue-200' },
  { key: 'other_certificates', label: '기타 자격증', icon: <ScrollText size={16} />, color: 'bg-yellow-50 border-yellow-200' },
  { key: 'social_career', label: '사회 경력', icon: <Landmark size={16} />, color: 'bg-purple-50 border-purple-200' },
  { key: 'other_career', label: '기타 경력', icon: <Award size={16} />, color: 'bg-orange-50 border-orange-200' },
  { key: 'religion', label: '종교', icon: '✝️', color: 'bg-pink-50 border-pink-200' },
]

function calcAge(birthday: string): number {
  const birth = new Date(birthday)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function ArrayEditor({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
  const [newItem, setNewItem] = useState('')

  const add = () => {
    const v = newItem.trim()
    if (!v) return
    onChange([...items, v])
    setNewItem('')
  }

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1">
            {item}
            <button onClick={() => remove(i)} className="text-gray-300 hover:text-red-400 leading-none">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          type="text"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="항목 추가 후 Enter"
          className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button onClick={add} className="text-xs bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg">추가</button>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getProfile().then(p => {
      setProfile(p)
      setLoading(false)
    })
  }, [])

  const startEdit = () => {
    setDraft(profile ? { ...profile } : null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraft(null)
    setEditing(false)
  }

  const save = async () => {
    if (!draft || !profile) return
    setSaving(true)
    try {
      const updated = await updateProfile(profile.id, {
        name: draft.name,
        birthday: draft.birthday,
        physical_abilities: draft.physical_abilities,
        computer_skills: draft.computer_skills,
        other_certificates: draft.other_certificates,
        social_career: draft.social_career,
        other_career: draft.other_career,
        religion: draft.religion,
        memo: draft.memo,
      })
      setProfile(updated)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const updateDraftField = (key: keyof Profile, value: Profile[typeof key]) => {
    setDraft(prev => prev ? { ...prev, [key]: value } : prev)
  }

  if (loading) return <div className="text-center py-16 text-gray-400">불러오는 중...</div>
  if (!profile) return <div className="text-center py-16 text-gray-400">프로필 데이터가 없습니다</div>

  const data = editing ? draft! : profile
  const age = data.birthday ? calcAge(data.birthday) : null

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">인적사항</h1>
          <p className="hidden md:block text-gray-500 mt-1">개인 프로필 및 역량 현황</p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button onClick={save} disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
              <Button variant="outline" onClick={cancelEdit}>취소</Button>
            </>
          ) : (
            <Button variant="outline" onClick={startEdit}><Pencil size={14} className="mr-1" /> 편집</Button>
          )}
        </div>
      </div>

      {/* 기본 정보 */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-blue-100">
            <User size={20} />
          </div>
          <div className="flex-1">
            {editing ? (
              <input
                type="text"
                value={data.name}
                onChange={e => updateDraftField('name', e.target.value)}
                className="text-xl font-bold text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full mb-1"
              />
            ) : (
              <h2 className="text-xl font-bold text-gray-900">{data.name}</h2>
            )}
            <div className="flex items-center gap-3 mt-1">
              {editing ? (
                <input
                  type="date"
                  value={data.birthday ?? ''}
                  onChange={e => updateDraftField('birthday', e.target.value || null)}
                  className="text-sm text-gray-600 bg-white border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              ) : (
                data.birthday && (
                  <span className="text-sm text-gray-600 inline-flex items-center gap-1"><Calendar size={14} /> {data.birthday}</span>
                )
              )}
              {age !== null && (
                <span className="text-sm font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                  만 {age}세
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 역량 섹션 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {FIELD_CONFIG.map(({ key, label, icon, color }) => (
          <div key={key} className={`rounded-xl border p-4 ${color}`}>
            <p className="text-xs font-semibold text-gray-700 mb-2">{icon} {label}</p>
            {editing ? (
              <ArrayEditor
                items={data[key] as string[]}
                onChange={v => updateDraftField(key, v)}
              />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(data[key] as string[]).map((item, i) => (
                  <span key={i} className="text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1">
                    {item}
                  </span>
                ))}
                {(data[key] as string[]).length === 0 && (
                  <span className="text-xs text-gray-400">-</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 메모 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1"><PenLine size={14} /> 메모</p>
        {editing ? (
          <textarea
            value={data.memo ?? ''}
            onChange={e => updateDraftField('memo', e.target.value || null)}
            placeholder="자유 메모..."
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        ) : (
          <p className="text-sm text-gray-600 whitespace-pre-wrap">
            {data.memo || <span className="text-gray-300">-</span>}
          </p>
        )}
      </div>
    </div>
  )
}
