import { useState } from 'react'
import { format } from 'date-fns'
import type { Academy, BillingRule, DateStr } from '../types'
import type { Data } from '../lib/useData'
import { newId } from '../lib/useData'
import { nextDue } from '../lib/billing'
import { WEEKDAY_LABELS, fromStr, monthKey, todayStr } from '../lib/dates'

const COLORS = ['#ff7043', '#42a5f5', '#66bb6a', '#ab47bc', '#ffca28', '#26a69a']
type BillingType = 'months' | 'monthlyWindow' | 'sessions' | 'none'

const fmt = (d: DateStr) => `${format(fromStr(d), 'M월 d일')} (${WEEKDAY_LABELS[fromStr(d).getDay()]})`

export default function Academies({ data }: { data: Data }) {
  const [editing, setEditing] = useState<Academy | 'new' | null>(null)
  const today = todayStr()

  if (editing) {
    return <AcademyForm initial={editing === 'new' ? null : editing} data={data} onDone={() => setEditing(null)} />
  }

  return (
    <>
      <div className="monthbar">
        <strong>학원 · 납부일</strong>
        <button className="primary small" onClick={() => setEditing('new')}>+ 학원 추가</button>
      </div>
      {data.academies.length === 0 && <p className="hint">학원을 추가하면 수업 요일과 납부일이 달력에 표시돼요.</p>}
      {data.academies.map((a) => (
        <AcademyCard key={a.id} a={a} data={data} today={today} onEdit={() => setEditing(a)} />
      ))}
    </>
  )
}

function AcademyCard({ a, data, today, onEdit }: { a: Academy; data: Data; today: DateStr; onEdit: () => void }) {
  const [paidOn, setPaidOn] = useState(today)
  const [override, setOverride] = useState('')
  const due = nextDue(a, data.sessions, today)
  const b = a.billing
  const save = (billing: BillingRule) => data.put('academies', { ...a, billing })

  return (
    <section className="card" style={{ borderLeftColor: a.color }}>
      <div className="row">
        <b className="grow">{a.name}</b>
        <button className="small" onClick={onEdit}>수정</button>
      </div>
      <div className="hint">
        {a.schedule.length > 0
          ? a.schedule.map((s) => `${WEEKDAY_LABELS[s.weekday]}${s.time ? ' ' + s.time : ''}`).join(', ')
          : '수업 요일 없음'}
      </div>
      <div className="duebox">
        <small>{due.label}</small>
        <div className="dueDate">
          {due.date ? (
            <>
              다음 납부 {due.endDate ? `${fmt(due.date)} ~ ${fmt(due.endDate)}` : fmt(due.date)}
            </>
          ) : (
            '납부일을 기록해 주세요'
          )}
        </div>
      </div>

      {(b.type === 'months' || b.type === 'sessions') && (
        <>
          <div className="row">
            <label className="grow">납부한 날
              <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </label>
            <button
              className="primary small"
              onClick={() => save(b.type === 'months' ? { ...b, lastPaid: paidOn } : { type: 'sessions', count: b.count, lastPaid: paidOn })}
            >
              납부 기록
            </button>
          </div>
          {b.lastPaid && <small className="hint">마지막 납부: {fmt(b.lastPaid)}</small>}
        </>
      )}

      {b.type === 'sessions' && (
        <div className="row">
          <label className="grow">납부일 직접 바꾸기
            <input type="date" value={override || b.nextOverride || ''} onChange={(e) => setOverride(e.target.value)} />
          </label>
          <button className="small" disabled={!override} onClick={() => { save({ ...b, nextOverride: override }); setOverride('') }}>적용</button>
          {b.nextOverride && <button className="small" onClick={() => { const { nextOverride: _n, ...rest } = b; void _n; save(rest) }}>자동으로</button>}
        </div>
      )}

      {b.type === 'monthlyWindow' && due.date && (
        <div className="row">
          <button
            className="primary small"
            onClick={() => save({ ...b, paidMonths: [...b.paidMonths, monthKey(due.date!)] })}
          >
            {monthKey(due.date)} 납부 완료
          </button>
          {b.paidMonths.length > 0 && (
            <button className="small" onClick={() => save({ ...b, paidMonths: b.paidMonths.slice(0, -1) })}>
              마지막 완료 취소
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function AcademyForm({ initial, data, onDone }: { initial: Academy | null; data: Data; onDone: () => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? COLORS[0])
  const [days, setDays] = useState<number[]>(initial?.schedule.map((s) => s.weekday) ?? [])
  const [time, setTime] = useState(initial?.schedule[0]?.time ?? '')
  const ib = initial?.billing
  const [type, setType] = useState<BillingType>(ib?.type ?? 'months')
  const [every, setEvery] = useState(ib?.type === 'months' ? ib.every : 3)
  const [startDay, setStartDay] = useState(ib?.type === 'monthlyWindow' ? ib.startDay : 18)
  const [endDay, setEndDay] = useState(ib?.type === 'monthlyWindow' ? ib.endDay : 23)
  const [count, setCount] = useState(ib?.type === 'sessions' ? ib.count : 13)

  const toggle = (d: number) => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d].sort()))

  const buildBilling = (): BillingRule => {
    // 같은 방식을 유지하면 기존 납부 기록을 보존한다
    if (type === 'months') return { type, every, lastPaid: ib?.type === 'months' ? ib.lastPaid : undefined }
    if (type === 'monthlyWindow')
      return { type, startDay, endDay, paidMonths: ib?.type === 'monthlyWindow' ? ib.paidMonths : [] }
    if (type === 'sessions')
      return {
        type,
        count,
        lastPaid: ib?.type === 'sessions' ? ib.lastPaid : undefined,
        nextOverride: ib?.type === 'sessions' ? ib.nextOverride : undefined,
      }
    return { type: 'none' }
  }

  const save = async () => {
    const a: Academy = {
      id: initial?.id ?? newId(),
      name: name.trim(),
      color,
      schedule: days.map((weekday) => ({ weekday, ...(time ? { time } : {}) })),
      billing: buildBilling(),
    }
    await data.put('academies', a)
    onDone()
  }

  return (
    <section className="form">
      <h2>{initial ? '학원 수정' : '학원 추가'}</h2>
      <label>학원 이름
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 발레, 수영, 아지트" />
      </label>
      <div>색상
        <div className="row">
          {COLORS.map((c) => (
            <button key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
          ))}
        </div>
      </div>
      <div>수업 요일
        <div className="row">
          {WEEKDAY_LABELS.map((w, i) => (
            <button key={w} className={`pill ${days.includes(i) ? 'on' : ''}`} onClick={() => toggle(i)}>{w}</button>
          ))}
        </div>
      </div>
      <label>수업 시간 (선택)
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>

      <label>납부 방식
        <select value={type} onChange={(e) => setType(e.target.value as BillingType)}>
          <option value="months">N개월마다 같은 날짜</option>
          <option value="monthlyWindow">매달 정해진 기간</option>
          <option value="sessions">N회 수업마다</option>
          <option value="none">납부 표시 안 함</option>
        </select>
      </label>
      {type === 'months' && (
        <label>몇 개월마다?
          <input type="number" min={1} value={every} onChange={(e) => setEvery(Math.max(1, Number(e.target.value)))} />
        </label>
      )}
      {type === 'monthlyWindow' && (
        <div className="row">
          <label className="grow">시작일<input type="number" min={1} max={31} value={startDay} onChange={(e) => setStartDay(Number(e.target.value))} /></label>
          <label className="grow">마지막일<input type="number" min={1} max={31} value={endDay} onChange={(e) => setEndDay(Number(e.target.value))} /></label>
        </div>
      )}
      {type === 'sessions' && (
        <label>몇 회마다?
          <input type="number" min={1} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} />
          <small className="hint">결석·휴강한 날은 세지 않아 납부일이 뒤로 밀려요. 보강은 달력에서 추가할 수 있어요.</small>
        </label>
      )}

      <div className="row">
        <button className="primary grow" disabled={!name.trim() || (type === 'monthlyWindow' && startDay > endDay)} onClick={save}>저장</button>
        <button className="grow" onClick={onDone}>취소</button>
      </div>
      {initial && (
        <button
          className="danger"
          onClick={async () => {
            if (confirm(`'${initial.name}' 학원을 삭제할까요?`)) {
              await data.remove('academies', initial.id)
              onDone()
            }
          }}
        >
          이 학원 삭제
        </button>
      )}
    </section>
  )
}
