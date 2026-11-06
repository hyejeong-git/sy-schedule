import { addMonths, endOfMonth, format, getDate, startOfMonth } from 'date-fns'
import type { Academy, DateStr, SessionRecord } from '../types'
import { addDaysStr, fromStr, monthKey, toStr } from './dates'
import { countableDates } from './recurrence'

/** N개월 뒤 같은 날짜. 말일이 없으면 그 달 말일로 보정 (1/31 + 1개월 = 2/28) */
export function addMonthsClamped(date: DateStr, n: number): DateStr {
  return toStr(addMonths(fromStr(date), n))
}

export interface DueInfo {
  /** 다음 납부일 (기간제는 기간의 시작일) */
  date: DateStr | null
  /** 기간제일 때 마지막 날 */
  endDate?: DateStr
  /** 화면에 보여줄 설명 */
  label: string
}

/** 매달 기간 납부: 해당 월의 납부 가능 기간 */
export function monthlyWindow(
  month: string, // 'yyyy-MM'
  startDay: number,
  endDay: number,
): { start: DateStr; end: DateStr } {
  const base = fromStr(`${month}-01`)
  const last = getDate(endOfMonth(base))
  const pad = (n: number) => String(Math.min(n, last)).padStart(2, '0')
  return { start: `${month}-${pad(startDay)}`, end: `${month}-${pad(endDay)}` }
}

/** 마지막 납부일 이후 N번째 수업일 (결석/휴강은 건너뛰고 보강은 포함) */
export function nthSessionAfter(
  academy: Academy,
  sessions: SessionRecord[],
  after: DateStr,
  n: number,
  horizonDays = 800,
): DateStr | null {
  const from = addDaysStr(after, 1)
  const to = addDaysStr(after, horizonDays)
  const dates = countableDates(academy, sessions, from, to)
  return dates.length >= n ? dates[n - 1] : null
}

/** 학원의 다음 납부일 계산 */
export function nextDue(academy: Academy, sessions: SessionRecord[], today: DateStr): DueInfo {
  const b = academy.billing
  switch (b.type) {
    case 'none':
      return { date: null, label: '납부 일정 없음' }
    case 'months': {
      if (!b.lastPaid) return { date: null, label: '납부일을 입력해 주세요' }
      let due = addMonthsClamped(b.lastPaid, b.every)
      // 오래된 납부일이면 지금 이후 첫 납부 예정일까지 반복
      let k = 1
      while (due < today) {
        k += 1
        due = addMonthsClamped(b.lastPaid, b.every * k)
      }
      return { date: due, label: `${b.every}개월마다` }
    }
    case 'monthlyWindow': {
      const startMonth = format(startOfMonth(fromStr(today)), 'yyyy-MM')
      // 이번 달 기간이 아직 안 지났고 미납이면 이번 달, 아니면 다음 달
      for (let i = 0; i < 24; i++) {
        const m = format(addMonths(fromStr(`${startMonth}-01`), i), 'yyyy-MM')
        const w = monthlyWindow(m, b.startDay, b.endDay)
        if (b.paidMonths.includes(m)) continue
        if (w.end < today) continue
        return { date: w.start, endDate: w.end, label: `매달 ${b.startDay}~${b.endDay}일` }
      }
      return { date: null, label: '납부 일정 없음' }
    }
    case 'sessions': {
      if (b.nextOverride) return { date: b.nextOverride, label: '직접 지정한 납부일' }
      if (!b.lastPaid) return { date: null, label: '납부일을 입력해 주세요' }
      const d = nthSessionAfter(academy, sessions, b.lastPaid, b.count)
      return { date: d, label: `${b.count}회 수업마다` }
    }
  }
}

/** 달력의 한 달 범위 안에서 학원별 납부 표시(날짜 → 학원 목록)를 만든다. */
export function dueMarksForRange(
  academies: Academy[],
  sessions: SessionRecord[],
  from: DateStr,
  to: DateStr,
  today: DateStr,
): Map<DateStr, { academy: Academy; kind: 'due' | 'window' }[]> {
  const marks = new Map<DateStr, { academy: Academy; kind: 'due' | 'window' }[]>()
  const push = (d: DateStr, academy: Academy, kind: 'due' | 'window') => {
    if (d < from || d > to) return
    const arr = marks.get(d) ?? []
    arr.push({ academy, kind })
    marks.set(d, arr)
  }
  for (const a of academies) {
    if (a.billing.type === 'monthlyWindow') {
      const b = a.billing
      let cur = format(startOfMonth(fromStr(from)), 'yyyy-MM')
      while (`${cur}-01` <= to) {
        if (!b.paidMonths.includes(cur)) {
          const w = monthlyWindow(cur, b.startDay, b.endDay)
          let d = w.start
          while (d <= w.end) {
            push(d, a, 'window')
            d = addDaysStr(d, 1)
          }
        }
        cur = format(addMonths(fromStr(`${cur}-01`), 1), 'yyyy-MM')
      }
    } else {
      const due = nextDue(a, sessions, today)
      if (due.date) push(due.date, a, 'due')
    }
  }
  return marks
}

export { monthKey }
