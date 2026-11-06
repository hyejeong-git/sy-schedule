import { useMemo, useState } from 'react'
import { addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, eachDayOfInterval, getDay } from 'date-fns'
import type { CalEvent, DateStr, EventCategory } from '../types'
import type { Data } from '../lib/useData'
import { newId } from '../lib/useData'
import { dueMarksForRange } from '../lib/billing'
import { regularDates } from '../lib/recurrence'
import { WEEKDAY_LABELS, fromStr, todayStr, toStr } from '../lib/dates'
import type { DayWeather } from '../lib/weather'

const CAT: Record<EventCategory, { label: string; icon: string; color: string }> = {
  daycare: { label: '어린이집', icon: '🏫', color: '#4caf50' },
  hospital: { label: '병원', icon: '🏥', color: '#e53935' },
  etc: { label: '기타', icon: '📌', color: '#8e6bbf' },
}

interface Props {
  data: Data
  weather: Record<DateStr, DayWeather>
  weatherFailed: boolean
}

export default function Home({ data, weather, weatherFailed }: Props) {
  const today = todayStr()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState<DateStr>(today)

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(month), end: endOfWeek(endOfMonth(month)) }),
    [month],
  )
  const from = toStr(days[0])
  const to = toStr(days[days.length - 1])

  const dueMarks = useMemo(
    () => dueMarksForRange(data.academies, data.sessions, from, to, today),
    [data.academies, data.sessions, from, to, today],
  )
  const classDays = useMemo(() => {
    const m = new Map<DateStr, string[]>()
    for (const a of data.academies) {
      const skipped = new Set(
        data.sessions.filter((s) => s.academyId === a.id && s.status !== 'makeup').map((s) => s.date),
      )
      const dates = [
        ...regularDates(a, from, to).filter((d) => !skipped.has(d)),
        ...data.sessions.filter((s) => s.academyId === a.id && s.status === 'makeup').map((s) => s.date),
      ]
      for (const d of dates) m.set(d, [...(m.get(d) ?? []), a.color])
    }
    return m
  }, [data.academies, data.sessions, from, to])

  return (
    <>
      <div className="monthbar">
        <button onClick={() => setMonth(addMonths(month, -1))} aria-label="이전 달">◀</button>
        <strong>{format(month, 'yyyy년 M월')}</strong>
        <button onClick={() => setMonth(addMonths(month, 1))} aria-label="다음 달">▶</button>
        <button
          className="small"
          onClick={() => {
            setMonth(startOfMonth(new Date()))
            setSelected(today)
          }}
        >
          오늘
        </button>
      </div>
      {weatherFailed && <p className="hint">날씨를 불러오지 못했어요 (인터넷 연결 확인)</p>}

      <div className="grid head">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</div>
        ))}
      </div>
      <div className="grid">
        {days.map((d) => {
          const ds = toStr(d)
          const w = weather[ds]
          const evs = data.events.filter((e) => e.date === ds)
          const dues = dueMarks.get(ds) ?? []
          const dots = classDays.get(ds) ?? []
          return (
            <button
              key={ds}
              className={`cell ${d.getMonth() !== month.getMonth() ? 'other' : ''} ${ds === today ? 'today' : ''} ${ds === selected ? 'sel' : ''}`}
              onClick={() => setSelected(ds)}
            >
              <span className={`num ${getDay(d) === 0 ? 'sun' : getDay(d) === 6 ? 'sat' : ''}`}>{d.getDate()}</span>
              {w && (
                <span className="wx">
                  {w.icon}
                  <small>{w.tMax}°</small>
                </span>
              )}
              <span className="dots">
                {evs.slice(0, 3).map((e) => (
                  <i key={e.id} style={{ background: CAT[e.category].color }} />
                ))}
                {dots.slice(0, 3).map((c, i) => (
                  <i key={i} className="sq" style={{ background: c }} />
                ))}
              </span>
              {dues.length > 0 && <span className="pay">💰</span>}
            </button>
          )
        })}
      </div>
      <DayDetail data={data} date={selected} weather={weather[selected]} />
    </>
  )
}

export function DayDetail({ data, date, weather }: { data: Data; date: DateStr; weather?: DayWeather }) {
  const today = todayStr()
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [cat, setCat] = useState<EventCategory>('daycare')
  const [memo, setMemo] = useState('')
  const [makeupAcademy, setMakeupAcademy] = useState('')

  const evs = data.events.filter((e) => e.date === date).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  const meal = data.meals.find((m) => m.date === date)
  const weekday = getDay(fromStr(date))
  const dues = dueMarksForRange(data.academies, data.sessions, date, date, today).get(date) ?? []

  const classes = data.academies
    .filter((a) => regularDates(a, date, date).length > 0)
    .map((a) => ({ a, rec: data.sessions.find((s) => s.academyId === a.id && s.date === date) }))
  const makeups = data.sessions
    .filter((s) => s.date === date && s.status === 'makeup')
    .map((s) => ({ s, a: data.academies.find((a) => a.id === s.academyId) }))

  const setStatus = async (academyId: string, status: 'absent' | 'cancelled' | null) => {
    const existing = data.sessions.find((s) => s.academyId === academyId && s.date === date)
    if (existing) await data.remove('sessions', existing.id)
    if (status) await data.put('sessions', { id: newId(), academyId, date, status })
  }

  const addEvent = async () => {
    if (!title.trim()) return
    const ev: CalEvent = { id: newId(), title: title.trim(), date, category: cat, ...(time ? { time } : {}), ...(memo.trim() ? { memo: memo.trim() } : {}) }
    await data.put('events', ev)
    setTitle('')
    setTime('')
    setMemo('')
  }

  return (
    <section className="detail">
      <h2>
        {format(fromStr(date), 'M월 d일')} ({WEEKDAY_LABELS[weekday]})
      </h2>

      <h3>🌤️ 날씨</h3>
      {!weather && <p className="hint">이 날의 날씨 정보가 없어요 (예보는 오늘부터 약 16일까지)</p>}
      {weather && (
        <div className={`weather ${weather.alert ? 'alert' : ''}`}>
          <span className="big">{weather.icon}</span>
          <div>
            <b>{weather.text}</b> · 최고 {weather.tMax}° / 최저 {weather.tMin}°
            <div>
              ☔ 강수확률 {weather.rainProb}%{weather.precipMm > 0 ? ` · 강수량 ${weather.precipMm}mm` : ''}
            </div>
            {weather.alert && <div className="warnText">{weather.alert}</div>}
          </div>
        </div>
      )}

      {dues.map(({ academy, kind }) => (
        <div key={academy.id} className="payrow" style={{ borderColor: academy.color }}>
          💰 <b>{academy.name}</b> {kind === 'window' ? '납부 기간이에요' : '납부일이에요'}
        </div>
      ))}

      <h3>🍱 식단</h3>
      {meal && (meal.am || meal.lunch || meal.pm) ? (
        <div className="meal">
          <div>오전간식: {meal.am || '-'}</div>
          <div>점심: {meal.lunch || '-'}</div>
          <div>오후간식: {meal.pm || '-'}</div>
        </div>
      ) : (
        <p className="hint">등록된 식단이 없어요</p>
      )}

      <h3>🎒 학원 수업</h3>
      {classes.length + makeups.length === 0 && <p className="hint">이 날은 학원 수업이 없어요</p>}
      {classes.map(({ a, rec }) => (
        <div key={a.id} className="row">
          <span className="chip" style={{ background: a.color }} />
          <span className={rec ? 'strike' : ''}>
            {a.name} {a.schedule.find((s) => s.weekday === weekday)?.time ?? ''}
          </span>
          {rec ? (
            <>
              <em>{rec.status === 'absent' ? '결석' : '휴강'}</em>
              <button className="small" onClick={() => setStatus(a.id, null)}>되돌리기</button>
            </>
          ) : (
            <>
              <button className="small" onClick={() => setStatus(a.id, 'absent')}>결석</button>
              <button className="small" onClick={() => setStatus(a.id, 'cancelled')}>휴강</button>
            </>
          )}
        </div>
      ))}
      {makeups.map(({ s, a }) => (
        <div key={s.id} className="row">
          <span className="chip" style={{ background: a?.color ?? '#999' }} />
          <span>{a?.name ?? '학원'} 보강</span>
          <button className="small" onClick={() => data.remove('sessions', s.id)}>삭제</button>
        </div>
      ))}
      {data.academies.length > 0 && (
        <div className="row">
          <select value={makeupAcademy} onChange={(e) => setMakeupAcademy(e.target.value)}>
            <option value="">보강 수업 추가…</option>
            {data.academies.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button
            className="small"
            disabled={!makeupAcademy}
            onClick={async () => {
              await data.put('sessions', { id: newId(), academyId: makeupAcademy, date, status: 'makeup' })
              setMakeupAcademy('')
            }}
          >
            추가
          </button>
        </div>
      )}

      <h3>📌 어린이집·병원 일정</h3>
      {evs.length === 0 && <p className="hint">등록된 일정이 없어요</p>}
      {evs.map((e) => (
        <div key={e.id} className="row">
          <span>{CAT[e.category].icon}</span>
          <span>
            {e.time && <b>{e.time} </b>}
            {e.title}
            {e.memo && <small className="memo"> · {e.memo}</small>}
          </span>
          <button className="small danger" onClick={() => data.remove('events', e.id)}>삭제</button>
        </div>
      ))}

      <div className="form">
        <div className="row">
          <select value={cat} onChange={(e) => setCat(e.target.value as EventCategory)}>
            {Object.entries(CAT).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="일정 제목 (예: 예방접종)" />
        <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모 (선택)" />
        <button className="primary" onClick={addEvent} disabled={!title.trim()}>일정 추가</button>
      </div>
    </section>
  )
}
