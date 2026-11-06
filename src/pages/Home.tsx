import { useEffect, useMemo, useRef, useState } from 'react'
import { addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, eachDayOfInterval, getDay } from 'date-fns'
import Modal from '../components/Modal'
import type { Academy, CalEvent, DateStr, EventCategory } from '../types'
import type { Data } from '../lib/useData'
import { newId } from '../lib/useData'
import { dueMarksForRange } from '../lib/billing'
import { regularDates } from '../lib/recurrence'
import { WEEKDAY_LABELS, addDaysStr, fromStr, todayStr, toStr } from '../lib/dates'
import type { DayWeather, HourWeather } from '../lib/weather'

const CAT: Record<EventCategory, { label: string; icon: string; color: string }> = {
  daycare: { label: '어린이집', icon: '🏫', color: '#4caf50' },
  hospital: { label: '병원', icon: '🏥', color: '#e53935' },
  etc: { label: '기타', icon: '📌', color: '#8e6bbf' },
}

interface Props {
  data: Data
  weather: Record<DateStr, DayWeather>
  hourly: Record<DateStr, HourWeather[]>
  weatherFailed: boolean
}

export default function Home({ data, weather, hourly, weatherFailed }: Props) {
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
              {dues.length > 0 && <span className="pay">{dues.every((x) => x.kind === 'auto') ? '🏧' : '💰'}</span>}
            </button>
          )
        })}
      </div>
      <DayDetail data={data} date={selected} weather={weather[selected]} hours={hourly[selected]} />
    </>
  )
}

/** 시간대별 날씨 (6시~22시). 오늘이면 지금 시각을 강조하고 그 자리로 스크롤한다 */
function HourlyStrip({ hours, isToday }: { hours: HourWeather[]; isToday: boolean }) {
  const nowHour = new Date().getHours()
  const shown = hours.filter((h) => h.hour >= 6 && h.hour <= 22)
  const box = useRef<HTMLDivElement>(null)

  // 가로로만 스크롤한다. (scrollIntoView는 화면 전체가 위아래로 튈 수 있다)
  useEffect(() => {
    const el = box.current
    const now = el?.querySelector<HTMLElement>('.hr.now')
    if (el && now) el.scrollLeft = now.offsetLeft - el.clientWidth / 2 + now.clientWidth / 2
  }, [isToday, nowHour, hours])

  return (
    <div className="hourly" role="list" aria-label="시간대별 날씨" ref={box}>
      {shown.map((h) => (
        <div key={h.hour} role="listitem" className={`hr ${isToday && h.hour === nowHour ? 'now' : ''}`}>
          <small>{h.hour}시</small>
          <span className="ic">{h.icon}</span>
          <b>{h.temp}°</b>
          <small className={h.rainProb >= 50 ? 'rain' : ''}>☔{h.rainProb}%</small>
        </div>
      ))}
    </div>
  )
}

export function DayDetail({
  data,
  date,
  weather,
  hours,
}: {
  data: Data
  date: DateStr
  weather?: DayWeather
  hours?: HourWeather[]
}) {
  const today = todayStr()
  const [eventOpen, setEventOpen] = useState(false)
  const [makeupFor, setMakeupFor] = useState<Academy | null>(null)

  const evs = data.events.filter((e) => e.date === date).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  const meal = data.meals.find((m) => m.date === date)
  const weekday = getDay(fromStr(date))
  const dues = dueMarksForRange(data.academies, data.sessions, date, date, today).get(date) ?? []

  /** 그 날 결석/휴강 기록 (보강 기록은 제외) */
  const findSkip = (academyId: string) =>
    data.sessions.find((s) => s.academyId === academyId && s.date === date && s.status !== 'makeup')

  const classes = data.academies
    .filter((a) => regularDates(a, date, date).length > 0)
    .map((a) => ({ a, rec: findSkip(a.id) }))
  const makeups = data.sessions
    .filter((s) => s.date === date && s.status === 'makeup')
    .map((s) => ({ s, a: data.academies.find((a) => a.id === s.academyId) }))

  const setStatus = async (academyId: string, status: 'absent' | 'cancelled' | null) => {
    const existing = findSkip(academyId)
    if (existing) await data.remove('sessions', existing.id)
    if (status) await data.put('sessions', { id: newId(), academyId, date, status })
  }

  const addEvent = async (ev: Omit<CalEvent, 'id' | 'date'>) => {
    await data.put('events', { id: newId(), date, ...ev })
    setEventOpen(false)
  }

  /** 이 날 수업은 빠지는 것으로 보고(결석 처리), 정한 날짜에 보강 수업을 추가한다 */
  const addMakeup = async (academy: Academy, makeupDate: DateStr) => {
    const rec = findSkip(academy.id)
    if (!rec) await data.put('sessions', { id: newId(), academyId: academy.id, date, status: 'absent' })
    await data.put('sessions', { id: newId(), academyId: academy.id, date: makeupDate, status: 'makeup' })
    setMakeupFor(null)
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
      {hours && hours.length > 0 && <HourlyStrip hours={hours} isToday={date === today} />}

      {dues.map(({ academy, kind }) => (
        <div key={academy.id} className="payrow" style={{ borderColor: academy.color }}>
          {kind === 'auto' ? '🏧' : '💰'} <b>{academy.name}</b>{' '}
          {kind === 'auto' ? '자동이체 예정이에요 (직접 낼 필요 없어요)' : kind === 'window' ? '납부 기간이에요' : '납부일이에요'}
        </div>
      ))}

      <h3>🍱 식단</h3>
      {meal && (meal.am || meal.lunch || meal.pm) ? (
        <div className="meal">
          {(
            [
              ['am', '오전간식', meal.am],
              ['lunch', '점심', meal.lunch],
              ['pm', '오후간식', meal.pm],
            ] as const
          ).map(([k, label, text]) => (
            <div key={k} className={`mrow ${k}`}>
              <span className="mlabel">{label}</span>
              <span className="mmenu">{text || '-'}</span>
            </div>
          ))}
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
          <button className="small" onClick={() => setMakeupFor(a)}>보강</button>
        </div>
      ))}
      {makeups.map(({ s, a }) => (
        <div key={s.id} className="row">
          <span className="chip" style={{ background: a?.color ?? '#999' }} />
          <span>{a?.name ?? '학원'} 보강</span>
          <button className="small" onClick={() => data.remove('sessions', s.id)}>삭제</button>
        </div>
      ))}
      <div className="row">
        <h3 className="grow">📌 어린이집·병원 일정</h3>
        <button className="primary small" onClick={() => setEventOpen(true)}>+ 추가</button>
      </div>
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

      {eventOpen && (
        <Modal title={`${format(fromStr(date), 'M월 d일')} 일정 추가`} onClose={() => setEventOpen(false)}>
          <EventForm onSave={addEvent} />
        </Modal>
      )}
      {makeupFor && (
        <Modal title={`${makeupFor.name} 보강 수업`} onClose={() => setMakeupFor(null)}>
          <MakeupForm academy={makeupFor} originalDate={date} onSave={(d) => addMakeup(makeupFor, d)} />
        </Modal>
      )}
    </section>
  )
}

function EventForm({ onSave }: { onSave: (e: Omit<CalEvent, 'id' | 'date'>) => void }) {
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [cat, setCat] = useState<EventCategory>('daycare')
  const [memo, setMemo] = useState('')
  return (
    <div className="form">
      <label>종류
        <select value={cat} onChange={(e) => setCat(e.target.value as EventCategory)}>
          {Object.entries(CAT).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
      </label>
      <label>제목
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 예방접종" />
      </label>
      <label>시간 (선택)
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <label>메모 (선택)
        <input value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>
      <button
        className="primary"
        disabled={!title.trim()}
        onClick={() =>
          onSave({ title: title.trim(), category: cat, ...(time ? { time } : {}), ...(memo.trim() ? { memo: memo.trim() } : {}) })
        }
      >
        저장
      </button>
    </div>
  )
}

function MakeupForm({ academy, originalDate, onSave }: { academy: Academy; originalDate: DateStr; onSave: (d: DateStr) => void }) {
  const [d, setD] = useState(addDaysStr(originalDate, 7))
  return (
    <div className="form">
      <label>보강 받는 날짜
        <input type="date" value={d} onChange={(e) => setD(e.target.value)} />
      </label>
      <p className="hint">
        {format(fromStr(originalDate), 'M월 d일')} {academy.name} 수업은 결석으로 처리되고, 정한 날짜에 보강 수업이 달력에 추가돼요.
        납부일 계산에는 보강 수업만 세어져요.
      </p>
      <button className="primary" disabled={!d} onClick={() => onSave(d)}>저장</button>
    </div>
  )
}
