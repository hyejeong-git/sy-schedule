import { useMemo, useState } from 'react'
import { addDays, endOfMonth, format, startOfMonth } from 'date-fns'
import type { DateStr, MealDay } from '../types'
import type { Data } from '../lib/useData'
import { WEEKDAY_LABELS, fromStr, toStr } from '../lib/dates'

type Fields = Pick<MealDay, 'am' | 'lunch' | 'pm'>
const EMPTY: Fields = { am: '', lunch: '', pm: '' }
const SLOTS: { key: keyof Fields; label: string }[] = [
  { key: 'am', label: '오전간식' },
  { key: 'lunch', label: '점심' },
  { key: 'pm', label: '오후간식' },
]

/** 그 달의 평일(월~금) 날짜들을 주 단위로 묶는다 */
function weekdaysByWeek(month: Date): DateStr[][] {
  const weeks: DateStr[][] = []
  for (let d = startOfMonth(month); d <= endOfMonth(month); d = addDays(d, 1)) {
    const wd = d.getDay()
    if (wd === 0 || wd === 6) continue
    if (wd === 1 || weeks.length === 0) weeks.push([])
    weeks[weeks.length - 1].push(toStr(d))
  }
  return weeks
}

export default function Meals({ data }: { data: Data }) {
  const [ym, setYm] = useState(() => format(new Date(), 'yyyy-MM'))
  const [editing, setEditing] = useState(false)
  const [edits, setEdits] = useState<Record<DateStr, Fields>>({})
  const [saved, setSaved] = useState(false)

  const month = useMemo(() => fromStr(`${ym}-01`), [ym])
  const weeks = useMemo(() => weekdaysByWeek(month), [month])
  const today = toStr(new Date())
  const hasAny = weeks.flat().some((d) => data.meals.some((m) => m.date === d))

  const valueOf = (date: DateStr): Fields => edits[date] ?? data.meals.find((m) => m.date === date) ?? EMPTY

  const edit = (date: DateStr, key: keyof Fields, v: string) => {
    setSaved(false)
    setEdits((e) => ({ ...e, [date]: { ...valueOf(date), [key]: v } }))
  }

  const save = async () => {
    for (const [date, f] of Object.entries(edits)) {
      await data.put('meals', { id: date, date, ...f })
    }
    setEdits({})
    setSaved(true)
  }

  return (
    <>
      <div className="monthbar">
        <strong>🍱 어린이집 식단표</strong>
      </div>
      <label>
        <input
          type="month"
          value={ym}
          onChange={(e) => {
            if (!e.target.value) return
            setYm(e.target.value)
            setEdits({})
            setSaved(false)
          }}
        />
      </label>

      {!hasAny && <p className="hint">이 달 식단표는 아직 등록되지 않았어요.</p>}

      {weeks.map((days) => (
        <details key={days[0]} className="week" open={days.some((d) => d >= today) || undefined}>
          <summary>
            {format(fromStr(days[0]), 'M월 d일')} ~ {format(fromStr(days[days.length - 1]), 'M월 d일')}
          </summary>
          {days.map((date) => {
            const v = valueOf(date)
            return (
              <div key={date} className="mealday">
                <b>
                  {format(fromStr(date), 'd일')} ({WEEKDAY_LABELS[fromStr(date).getDay()]})
                </b>
                {editing ? (
                  SLOTS.map((s) => (
                    <label key={s.key}>
                      {s.label}
                      <input value={v[s.key]} onChange={(e) => edit(date, s.key, e.target.value)} />
                    </label>
                  ))
                ) : (
                  SLOTS.map((s) => (
                    <div key={s.key} className="mealline">
                      <span>{s.label}</span> {v[s.key] || '-'}
                    </div>
                  ))
                )}
              </div>
            )
          })}
        </details>
      ))}

      {editing ? (
        <div className="row">
          <button className="primary grow" onClick={save} disabled={Object.keys(edits).length === 0}>
            수정 내용 저장
          </button>
          <button className="grow" onClick={() => { setEditing(false); setEdits({}) }}>닫기</button>
        </div>
      ) : (
        <button onClick={() => { setEditing(true); setSaved(false) }}>✏️ 식단 고치기</button>
      )}
      {saved && <p className="ok">저장했어요!</p>}
    </>
  )
}
