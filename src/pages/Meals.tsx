import { useMemo, useState } from 'react'
import { addDays, endOfMonth, format, startOfMonth } from 'date-fns'
import type { DateStr, MealDay } from '../types'
import type { Data } from '../lib/useData'
import { readMonthlyMeals } from '../lib/ocrMeals'
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
  const [edits, setEdits] = useState<Record<DateStr, Fields>>({})
  const [busy, setBusy] = useState('')
  const [saved, setSaved] = useState(false)

  const month = useMemo(() => fromStr(`${ym}-01`), [ym])
  const weeks = useMemo(() => weekdaysByWeek(month), [month])

  const valueOf = (date: DateStr): Fields =>
    edits[date] ?? data.meals.find((m) => m.date === date) ?? EMPTY

  const edit = (date: DateStr, key: keyof Fields, v: string) => {
    setSaved(false)
    setEdits((e) => ({ ...e, [date]: { ...valueOf(date), [key]: v } }))
  }

  const onPhoto = async (file: File) => {
    setSaved(false)
    setBusy('표를 찾는 중…')
    try {
      const found = await readMonthlyMeals(file, month.getFullYear(), month.getMonth() + 1, (done, total) =>
        setBusy(`글자를 읽는 중… ${Math.round((done / total) * 100)}% (처음에는 언어 데이터를 받느라 오래 걸릴 수 있어요)`),
      )
      if (!found) {
        alert('식단표의 표 모양을 찾지 못했어요. 표 전체가 반듯하게 보이는 사진(또는 캡처)으로 다시 올리거나 아래에 직접 입력해 주세요.')
      } else {
        setEdits((e) => {
          const next = { ...e }
          for (const m of found) next[m.date] = { am: m.am, lunch: m.lunch, pm: m.pm }
          return next
        })
      }
    } catch {
      alert('사진을 읽지 못했어요. 아래에 직접 입력해 주세요.')
    } finally {
      setBusy('')
    }
  }

  const save = async () => {
    for (const [date, f] of Object.entries(edits)) {
      if (f.am || f.lunch || f.pm) await data.put('meals', { id: date, date, ...f })
      else if (data.meals.some((m) => m.date === date)) await data.remove('meals', date)
    }
    setEdits({})
    setSaved(true)
  }

  const changed = Object.keys(edits).length > 0

  return (
    <>
      <div className="monthbar">
        <strong>🍱 어린이집 식단표 (월간)</strong>
      </div>
      <label>어느 달 식단표인가요?
        <input type="month" value={ym} onChange={(e) => e.target.value && (setYm(e.target.value), setEdits({}), setSaved(false))} />
      </label>
      <label className="filebtn">
        📷 월간 식단표 사진 올리기
        <input type="file" accept="image/*" hidden disabled={!!busy} onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])} />
      </label>
      {busy && <p className="hint">{busy}</p>}
      <p className="hint">
        월~금 오전간식·점심·오후간식만 가져와요. 사진에서 읽은 글자는 틀릴 수 있으니 아래에서 확인하고 고쳐 주세요.
      </p>

      {weeks.map((days) => (
        <details key={days[0]} className="week" open={days.some((d) => d >= format(new Date(), 'yyyy-MM-dd')) || undefined}>
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
                {SLOTS.map((s) => (
                  <label key={s.key}>
                    {s.label}
                    <input value={v[s.key]} onChange={(e) => edit(date, s.key, e.target.value)} />
                  </label>
                ))}
              </div>
            )
          })}
        </details>
      ))}

      <button className="primary" onClick={save} disabled={!changed}>달력에 반영하기</button>
      {saved && <p className="ok">저장했어요! 달력에서 날짜를 누르면 식단이 보여요.</p>}
    </>
  )
}
