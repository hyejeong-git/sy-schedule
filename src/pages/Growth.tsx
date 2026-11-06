import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import type { GrowthRecord } from '../types'
import type { Data } from '../lib/useData'
import { newId } from '../lib/useData'
import { chartPoints, lastChange, series, type Metric } from '../lib/growth'
import { fromStr, todayStr } from '../lib/dates'

const META: Record<Metric, { label: string; unit: string; color: string; icon: string }> = {
  height: { label: '키', unit: 'cm', color: '#42a5f5', icon: '📏' },
  weight: { label: '몸무게', unit: 'kg', color: '#ff7043', icon: '⚖️' },
}
const W = 340
const H = 190

export default function Growth({ data }: { data: Data }) {
  const [date, setDate] = useState(todayStr())
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [place, setPlace] = useState('')
  const [msg, setMsg] = useState('')

  const places = useMemo(() => [...new Set(data.growth.map((r) => r.place).filter(Boolean))], [data.growth])
  const sorted = useMemo(() => [...data.growth].sort((a, b) => b.date.localeCompare(a.date)), [data.growth])

  const h = parseFloat(height)
  const w = parseFloat(weight)
  const valid = (!Number.isNaN(h) || !Number.isNaN(w)) && !!date

  const save = async () => {
    const rec: GrowthRecord = {
      id: newId(),
      date,
      place: place.trim(),
      ...(!Number.isNaN(h) ? { height: h } : {}),
      ...(!Number.isNaN(w) ? { weight: w } : {}),
    }
    await data.put('growth', rec)
    setHeight('')
    setWeight('')
    setMsg('저장했어요!')
  }

  return (
    <>
      <div className="monthbar"><strong>📏 소율이 성장 기록</strong></div>

      <section className="card">
        <h3>새로 기록하기</h3>
        <label>잰 날짜
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="row">
          <label className="grow">키 (cm)
            <input type="number" inputMode="decimal" step="0.1" min="0" value={height} onChange={(e) => { setHeight(e.target.value); setMsg('') }} placeholder="예: 108.5" />
          </label>
          <label className="grow">몸무게 (kg)
            <input type="number" inputMode="decimal" step="0.1" min="0" value={weight} onChange={(e) => { setWeight(e.target.value); setMsg('') }} placeholder="예: 17.8" />
          </label>
        </div>
        <label>어디서 쟀나요?
          <input list="places" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="예: 어린이집, 소아과, 집" />
          <datalist id="places">
            {places.map((p) => <option key={p} value={p} />)}
          </datalist>
        </label>
        <button className="primary" disabled={!valid} onClick={save}>기록 저장</button>
        {msg && <p className="ok">{msg}</p>}
      </section>

      {(['height', 'weight'] as Metric[]).map((m) => (
        <Chart key={m} metric={m} data={data} />
      ))}

      <h3>기록 목록</h3>
      {sorted.length === 0 && <p className="hint">아직 기록이 없어요. 위에서 첫 기록을 남겨 보세요.</p>}
      {sorted.map((r) => (
        <div key={r.id} className="row growthrow">
          <b>{format(fromStr(r.date), 'yyyy.M.d')}</b>
          <span className="grow">
            {r.height !== undefined && <>📏 {r.height}cm </>}
            {r.weight !== undefined && <>⚖️ {r.weight}kg </>}
            {r.place && <small className="memo">· {r.place}</small>}
          </span>
          <button
            className="small danger"
            onClick={() => confirm('이 기록을 삭제할까요?') && data.remove('growth', r.id)}
          >
            삭제
          </button>
        </div>
      ))}
    </>
  )
}

function Chart({ metric, data }: { metric: Metric; data: Data }) {
  const m = META[metric]
  const points = useMemo(() => series(data.growth, metric), [data.growth, metric])
  const { pts, min, max } = useMemo(() => chartPoints(points, W, H), [points])
  const change = lastChange(points)
  const last = points[points.length - 1]

  return (
    <section className="card" style={{ borderLeftColor: m.color }}>
      <div className="row">
        <b className="grow">{m.icon} {m.label} 변화</b>
        {last && (
          <span>
            최근 <b>{last.value}{m.unit}</b>
            {change !== null && (
              <small className={change >= 0 ? 'up' : 'down'}> ({change >= 0 ? '+' : ''}{change}{m.unit})</small>
            )}
          </span>
        )}
      </div>
      {points.length === 0 ? (
        <p className="hint">{m.label} 기록이 없어요.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`${m.label} 변화 그래프`}>
          {[0, 0.5, 1].map((f) => {
            const y = 28 + f * (H - 56)
            const v = max - f * (max - min)
            return (
              <g key={f}>
                <line x1={28} x2={W - 28} y1={y} y2={y} stroke="#eadfd6" strokeDasharray="3 3" />
                <text x={2} y={y + 4} fontSize="10" fill="#777">{v.toFixed(1)}</text>
              </g>
            )
          })}
          {pts.length > 1 && (
            <polyline fill="none" stroke={m.color} strokeWidth="2.5" points={pts.map((p) => `${p.x},${p.y}`).join(' ')} />
          )}
          {pts.map((p) => (
            <g key={p.date + p.value}>
              <circle cx={p.x} cy={p.y} r="4.5" fill={m.color}>
                <title>{`${p.date} ${p.value}${m.unit}${p.place ? ' · ' + p.place : ''}`}</title>
              </circle>
              <text x={p.x} y={p.y - 9} fontSize="10" textAnchor="middle" fill="#333">{p.value}</text>
            </g>
          ))}
          <text x={28} y={H - 6} fontSize="10" fill="#777">{format(fromStr(points[0].date), 'yy.M.d')}</text>
          {points.length > 1 && (
            <text x={W - 28} y={H - 6} fontSize="10" textAnchor="end" fill="#777">
              {format(fromStr(points[points.length - 1].date), 'yy.M.d')}
            </text>
          )}
        </svg>
      )}
    </section>
  )
}
