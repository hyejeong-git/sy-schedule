import { useEffect, useState } from 'react'
import { addDays, format, startOfWeek } from 'date-fns'
import type { MealSlot } from '../types'
import type { Data } from '../lib/useData'
import { parseMealText, type MealGrid } from '../lib/parseMeal'
import { toStr } from '../lib/dates'

const ROWS: { slot: MealSlot; label: string }[] = [
  { slot: 'am', label: '오전간식' },
  { slot: 'lunch', label: '점심' },
  { slot: 'pm', label: '오후간식' },
]
const DAYS = ['월', '화', '수', '목', '금']

export default function Meals({ data }: { data: Data }) {
  const [monday, setMonday] = useState(() => toStr(startOfWeek(new Date(), { weekStartsOn: 1 })))
  const [grid, setGrid] = useState<MealGrid>(() => load(data, monday))
  const [busy, setBusy] = useState('')
  const [raw, setRaw] = useState('')
  const [saved, setSaved] = useState(false)

  // 주를 바꾸면 저장된 식단을 불러온다
  useEffect(() => {
    setGrid(load(data, monday))
    setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monday])

  const dateOf = (i: number) => toStr(addDays(new Date(monday + 'T00:00:00'), i))

  const onPhoto = async (file: File) => {
    setBusy('글자를 읽는 중… (처음엔 언어 데이터를 받느라 1분쯤 걸릴 수 있어요)')
    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('kor', 1, {
        logger: (m) => m.status === 'recognizing text' && setBusy(`글자를 읽는 중… ${Math.round(m.progress * 100)}%`),
      })
      const { data: result } = await worker.recognize(file)
      await worker.terminate()
      setRaw(result.text)
      setGrid(parseMealText(result.text))
      setBusy('')
    } catch {
      setBusy('')
      alert('사진을 읽지 못했어요. 아래 표에 직접 입력해 주세요.')
    }
  }

  const save = async () => {
    for (let i = 0; i < 5; i++) {
      const date = dateOf(i)
      const day = { id: date, date, am: grid.am[i], lunch: grid.lunch[i], pm: grid.pm[i] }
      if (day.am || day.lunch || day.pm) await data.put('meals', day)
      else if (data.meals.some((m) => m.date === date)) await data.remove('meals', date)
    }
    setSaved(true)
  }

  const edit = (slot: MealSlot, i: number, v: string) => {
    setSaved(false)
    setGrid((g) => ({ ...g, [slot]: g[slot].map((x, j) => (j === i ? v : x)) }))
  }

  return (
    <>
      <div className="monthbar">
        <strong>🍱 어린이집 식단표</strong>
      </div>
      <label>어느 주 식단인가요? (월요일 날짜)
        <input type="date" value={monday} onChange={(e) => setMonday(toStr(startOfWeek(new Date(e.target.value + 'T00:00:00'), { weekStartsOn: 1 })))} />
      </label>
      <label className="filebtn">
        📷 식단표 사진 올리기
        <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])} />
      </label>
      {busy && <p className="hint">{busy}</p>}
      <p className="hint">사진에서 읽은 내용은 틀릴 수 있어요. 아래 표에서 확인하고 고쳐 주세요. (월~금 오전간식·점심·오후간식만 사용)</p>

      <div className="mealgrid">
        {ROWS.map((r) => (
          <div key={r.slot} className="mealrow">
            <b>{r.label}</b>
            {DAYS.map((d, i) => (
              <label key={d}>
                {d} {format(new Date(dateOf(i) + 'T00:00:00'), 'M/d')}
                <input value={grid[r.slot][i]} onChange={(e) => edit(r.slot, i, e.target.value)} />
              </label>
            ))}
          </div>
        ))}
      </div>
      <button className="primary" onClick={save}>달력에 반영하기</button>
      {saved && <p className="ok">저장했어요! 달력에서 날짜를 누르면 식단이 보여요.</p>}
      {raw && (
        <details>
          <summary>읽어낸 원본 글자 보기</summary>
          <pre>{raw}</pre>
        </details>
      )}
    </>
  )
}

function load(data: Data, monday: string): MealGrid {
  const g: MealGrid = { am: ['', '', '', '', ''], lunch: ['', '', '', '', ''], pm: ['', '', '', '', ''] }
  for (let i = 0; i < 5; i++) {
    const date = toStr(addDays(new Date(monday + 'T00:00:00'), i))
    const m = data.meals.find((x) => x.date === date)
    if (m) {
      g.am[i] = m.am
      g.lunch[i] = m.lunch
      g.pm[i] = m.pm
    }
  }
  return g
}
