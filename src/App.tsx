import { useEffect, useState } from 'react'
import { PROFILES, useData } from './lib/useData'
import Today from './pages/Today'
import { useWeather } from './lib/useWeather'
import Home from './pages/Home'
import Academies from './pages/Academies'
import Meals from './pages/Meals'
import Growth from './pages/Growth'
import { familyCodeProblem } from './lib/familyCode'
import SettingsPage from './pages/SettingsPage'

type Tab = 'today' | 'home' | 'academies' | 'meals' | 'growth' | 'settings'
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'today', icon: '🏠', label: '오늘' },
  { id: 'home', icon: '📅', label: '달력' },
  { id: 'academies', icon: '🎒', label: '학원' },
  { id: 'meals', icon: '🍱', label: '식단' },
  { id: 'growth', icon: '📏', label: '성장' },
  { id: 'settings', icon: '⚙️', label: '설정' },
]

export default function App() {
  const data = useData()
  const [tab, setTab] = useState<Tab>('today')
  const { weather, hourly, weatherFailed } = useWeather(data.settings.latitude, data.settings.longitude)

  // 글자 크기: html 글자 크기를 바꾸면 rem을 쓰는 모든 요소가 같이 커진다.
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * data.settings.fontScale}px`
  }, [data.settings.fontScale])

  if (data.needFamilyCode) return <FamilyGate onSubmit={data.setFamilyCode} />
  if (data.error) {
    return (
      <div className="gate">
        <p className="error">{data.error}</p>
        <button className="primary" onClick={() => window.location.reload()}>다시 시도</button>
        {data.sharing && <button onClick={data.resetFamilyCode}>가족 코드 다시 입력</button>}
      </div>
    )
  }
  if (!data.ready) return <p className="center">불러오는 중…</p>
  if (!data.profile) return <ProfileGate onPick={data.setProfile} />

  const me = PROFILES.find((p) => p.id === data.profile)

  return (
    <div className="app">
      <header>
        <h1>👧 소율이 일정</h1>
        <span className="who">
          {!data.sharing && <span className="badge warn">이 기기에만 저장 중</span>}
          {me && <span>{me.icon} {me.label}</span>}
        </span>
      </header>
      <main>
        {tab === 'today' && <Today data={data} weather={weather} hourly={hourly} />}
        {tab === 'home' && <Home data={data} weather={weather} hourly={hourly} weatherFailed={weatherFailed} />}
        {tab === 'academies' && <Academies data={data} />}
        {tab === 'meals' && <Meals data={data} />}
        {tab === 'growth' && <Growth data={data} />}
        {tab === 'settings' && <SettingsPage data={data} />}
      </main>
      <nav>
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function ProfileGate({ onPick }: { onPick: (p: (typeof PROFILES)[number]['id']) => void }) {
  return (
    <div className="gate">
      <h1>👧 소율이 일정</h1>
      <p>누구세요?</p>
      <div className="profiles">
        {PROFILES.map((p) => (
          <button key={p.id} onClick={() => onPick(p.id)}>
            <span>{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function FamilyGate({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('')
  const problem = code.trim() ? familyCodeProblem(code) : null
  return (
    <div className="gate">
      <h1>👧 소율이 일정</h1>
      <p>가족이 함께 쓰는 <b>가족 코드</b>를 입력하세요.<br />처음이면 새로 정하고, 다른 가족에게도 같은 코드를 알려주세요.</p>
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="예: soyul-family-2026" />
      {problem && <small className="error">{problem}</small>}
      <button className="primary" disabled={familyCodeProblem(code) !== null} onClick={() => onSubmit(code)}>
        시작하기
      </button>
      <small>6글자 이상, 남에게 알려주지 마세요.</small>
    </div>
  )
}
