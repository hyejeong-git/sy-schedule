import { useEffect, useState } from 'react'
import { useData } from './lib/useData'
import { useWeather } from './lib/useWeather'
import Home from './pages/Home'
import Academies from './pages/Academies'
import Meals from './pages/Meals'
import SettingsPage from './pages/SettingsPage'

type Tab = 'home' | 'academies' | 'meals' | 'settings'
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'home', icon: '📅', label: '달력' },
  { id: 'academies', icon: '🎒', label: '학원' },
  { id: 'meals', icon: '🍱', label: '식단' },
  { id: 'settings', icon: '⚙️', label: '설정' },
]

export default function App() {
  const data = useData()
  const [tab, setTab] = useState<Tab>('home')
  const { weather, weatherFailed } = useWeather(data.settings.latitude, data.settings.longitude)

  // 글자 크기: html 글자 크기를 바꾸면 rem을 쓰는 모든 요소가 같이 커진다.
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * data.settings.fontScale}px`
  }, [data.settings.fontScale])

  if (data.needFamilyCode) return <FamilyGate onSubmit={data.setFamilyCode} />
  if (data.error) return <p className="center error">{data.error}</p>
  if (!data.ready) return <p className="center">불러오는 중…</p>

  return (
    <div className="app">
      <header>
        <h1>👧 소율이 일정</h1>
        {!data.sharing && <span className="badge warn">이 기기에만 저장 중</span>}
      </header>
      <main>
        {tab === 'home' && <Home data={data} weather={weather} weatherFailed={weatherFailed} />}
        {tab === 'academies' && <Academies data={data} />}
        {tab === 'meals' && <Meals data={data} />}
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

function FamilyGate({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('')
  return (
    <div className="gate">
      <h1>👧 소율이 일정</h1>
      <p>가족이 함께 쓰는 <b>가족 코드</b>를 입력하세요.<br />처음이면 새로 정하고, 다른 가족에게도 같은 코드를 알려주세요.</p>
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="예: soyul-family-2026" />
      <button className="primary" disabled={code.trim().length < 6} onClick={() => onSubmit(code)}>
        시작하기
      </button>
      <small>6글자 이상, 남에게 알려주지 마세요.</small>
    </div>
  )
}
