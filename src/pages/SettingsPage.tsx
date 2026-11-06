import { useState } from 'react'
import { PROFILES, type Data } from '../lib/useData'
import { getApiKey, setApiKey } from '../lib/claudeMeals'
import { searchCity, type GeoResult } from '../lib/weather'

const SIZES = [
  { v: 1, label: '보통' },
  { v: 1.25, label: '크게' },
  { v: 1.5, label: '더 크게' },
  { v: 1.8, label: '아주 크게' },
]

export default function SettingsPage({ data }: { data: Data }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [msg, setMsg] = useState('')
  const [key, setKey] = useState(getApiKey)
  const [keyMsg, setKeyMsg] = useState('')

  const search = async () => {
    setMsg('')
    try {
      const r = await searchCity(q)
      setResults(r)
      if (r.length === 0) setMsg('찾지 못했어요')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '검색 실패')
    }
  }

  return (
    <>
      <div className="monthbar"><strong>⚙️ 설정</strong></div>

      <section className="card">
        <h3>누구세요?</h3>
        <div className="profiles small">
          {PROFILES.map((p) => (
            <button key={p.id} className={data.profile === p.id ? 'on' : ''} onClick={() => data.setProfile(p.id)}>
              <span>{p.icon}</span>
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>글자 크기</h3>
        <div className="sizes">
          {SIZES.map((s) => (
            <button key={s.v} className={data.settings.fontScale === s.v ? 'on' : ''} onClick={() => data.setFontScale(s.v)}>
              {s.label}
            </button>
          ))}
        </div>
        <input
          type="range"
          min={1}
          max={2}
          step={0.05}
          value={data.settings.fontScale}
          onChange={(e) => data.setFontScale(Number(e.target.value))}
          aria-label="글자 크기"
        />
        <p>이 글자 크기로 보여요: <b>소율이 일정 💗</b></p>
      </section>

      <section className="card">
        <h3>날씨 지역</h3>
        <p className="hint">현재: <b>{data.settings.city}</b> (가족 모두에게 적용)</p>
        <div className="row">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="도시 이름 (예: 수원)" onKeyDown={(e) => e.key === 'Enter' && q.trim() && search()} />
          <button className="small" onClick={search} disabled={!q.trim()}>검색</button>
        </div>
        {msg && <p className="hint">{msg}</p>}
        {results.map((r) => (
          <button
            key={`${r.latitude},${r.longitude}`}
            className="resultbtn"
            onClick={() => {
              data.saveSettings({ city: r.name, latitude: r.latitude, longitude: r.longitude })
              setResults([])
              setQ('')
            }}
          >
            {r.name} {r.admin1 ? `(${r.admin1})` : ''}
          </button>
        ))}
      </section>

      <section className="card">
        <h3>식단표 Claude 인식 (선택)</h3>
        <p className="hint">
          Anthropic API 키를 넣으면 식단표 사진을 더 정확하게 읽어요. 키는 이 기기에만 저장되고 가족 공유에는 올라가지 않아요.
          사진 한 장을 읽을 때마다 소액이 청구됩니다. 식단표를 올리는 분 폰에만 넣으면 돼요.
        </p>
        <div className="row">
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" />
          <button
            className="small"
            onClick={() => {
              setApiKey(key)
              setKeyMsg(key ? '저장했어요' : '삭제했어요')
            }}
          >
            {key ? '저장' : '삭제'}
          </button>
        </div>
        {keyMsg && <p className="ok">{keyMsg}</p>}
      </section>

      <section className="card">
        <h3>가족 공유</h3>
        {data.sharing ? (
          <>
            <p>가족 코드: <b>{data.familyCode}</b></p>
            <p className="hint">가족 모두 같은 코드를 입력하면 일정이 함께 보여요.</p>
          </>
        ) : (
          <p className="hint">Firebase가 아직 설정되지 않아 이 기기에만 저장돼요. README의 안내를 따라 설정하면 가족과 공유됩니다.</p>
        )}
      </section>
    </>
  )
}
