import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Academy, CalEvent, MealDay, SessionRecord, Settings } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import { createFirebaseBackend, createLocalBackend, firebaseConfigured, type Backend, type Col } from './backend'

export type Profile = 'grandma' | 'dad' | 'mom'
export const PROFILES: { id: Profile; icon: string; label: string }[] = [
  { id: 'grandma', icon: '👵', label: '할머니' },
  { id: 'dad', icon: '👨', label: '아빠' },
  { id: 'mom', icon: '👩', label: '엄마' },
]
const FAMILY_KEY = 'sy:familyCode'
export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export function useData() {
  const [familyCode, setFamilyCodeState] = useState<string>(() => localStorage.getItem(FAMILY_KEY) ?? '')
  const [backend, setBackend] = useState<Backend | null>(null)
  const [error, setError] = useState<string>('')
  const [events, setEvents] = useState<CalEvent[]>([])
  const [academies, setAcademies] = useState<Academy[]>([])
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [meals, setMeals] = useState<MealDay[]>([])
  const [settingsDoc, setSettingsDoc] = useState<Settings>(DEFAULT_SETTINGS)

  const needFamilyCode = firebaseConfigured && !familyCode

  useEffect(() => {
    if (needFamilyCode) return
    let cancelled = false
    ;(async () => {
      try {
        const b = firebaseConfigured ? await createFirebaseBackend(familyCode) : createLocalBackend()
        if (!cancelled) setBackend(b)
      } catch (e) {
        setError(e instanceof Error ? e.message : '연결에 실패했어요')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [familyCode, needFamilyCode])

  useEffect(() => {
    if (!backend) return
    const subs = [
      backend.subscribe('events', (x) => setEvents(x as unknown as CalEvent[])),
      backend.subscribe('academies', (x) => setAcademies(x as unknown as Academy[])),
      backend.subscribe('sessions', (x) => setSessions(x as unknown as SessionRecord[])),
      backend.subscribe('meals', (x) => setMeals(x as unknown as MealDay[])),
      backend.subscribe('settings', (x) => {
        const s = x.find((d) => d.id === 'main')
        if (s) setSettingsDoc({ ...DEFAULT_SETTINGS, ...(s as unknown as Settings) })
      }),
    ]
    return () => subs.forEach((u) => u())
  }, [backend])

  const put = useCallback(
    (col: Col, item: object) => backend?.put(col, item as never) ?? Promise.resolve(),
    [backend],
  )
  const remove = useCallback((col: Col, id: string) => backend?.remove(col, id) ?? Promise.resolve(), [backend])

  const setFamilyCode = (code: string) => {
    localStorage.setItem(FAMILY_KEY, code.trim())
    setFamilyCodeState(code.trim())
  }

  // 글자 크기와 "누구세요?" 선택은 기기마다 따로 저장한다.
  const [fontScale, setFontScaleState] = useState<number>(() => Number(localStorage.getItem('sy:fontScale')) || 1)
  const setFontScale = (n: number) => {
    localStorage.setItem('sy:fontScale', String(n))
    setFontScaleState(n)
  }

  const [profile, setProfileState] = useState<Profile | ''>(() => (localStorage.getItem('sy:profile') as Profile | null) ?? '')
  const setProfile = (p: Profile) => {
    localStorage.setItem('sy:profile', p)
    setProfileState(p)
    // 처음 고르는 경우, 할머니는 글자를 기본으로 크게 보여준다.
    if (p === 'grandma' && !localStorage.getItem('sy:fontScale')) setFontScale(1.25)
  }

  const settings = useMemo(() => ({ ...settingsDoc, fontScale }), [settingsDoc, fontScale])

  return {
    ready: Boolean(backend),
    error,
    needFamilyCode,
    familyCode,
    setFamilyCode,
    events,
    academies,
    sessions,
    meals,
    settings,
    setFontScale,
    profile,
    setProfile,
    saveSettings: (s: Partial<Settings>) => put('settings', { ...settingsDoc, ...s, id: 'main' }),
    put,
    remove,
    sharing: firebaseConfigured,
  }
}

export type Data = ReturnType<typeof useData>
