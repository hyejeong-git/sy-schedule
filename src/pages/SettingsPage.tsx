import { useState } from 'react'
import type { Data } from '../lib/useData'
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
        <h3>글자 크기</h3>
        <p className="hint">이 폰에만 적용돼요. 할머니 폰에서 크게 맞춰 두세요.</p>
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
        <h3>가족 공유</h3>
        {data.sharing ? (
          <>
            <p>가족 코드: <b>{data.familyCode}</b></p>
            <p className="hint">아빠·할머니 폰에서 같은 코드를 입력하면 일정이 함께 보여요.</p>
          </>
        ) : (
          <p className="hint">Firebase가 아직 설정되지 않아 이 기기에만 저장돼요. README의 안내를 따라 설정하면 가족과 공유됩니다.</p>
        )}
      </section>
    </>
  )
}
