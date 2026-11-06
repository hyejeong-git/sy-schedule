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
  /** 자동이체로 가장 최근에 납부 처리된 날짜 */
  lastAutoPaid?: DateStr
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
  const info = nextDueRaw(academy, sessions, today)
  return academy.autoPay && info.date ? { ...info, label: `🏧 자동이체 · ${info.label}` } : info
}

function nextDueRaw(academy: Academy, sessions: SessionRecord[], today: DateStr): DueInfo {
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
      // 자동이체면 지나간 납부일은 모두 납부된 것으로 본다
      const lastAutoPaid = academy.autoPay && k > 1 ? addMonthsClamped(b.lastPaid, b.every * (k - 1)) : undefined
      return { date: due, label: `${b.every}개월마다`, lastAutoPaid }
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
      if (!b.lastPaid) {
        return b.nextOverride
          ? { date: b.nextOverride, label: '직접 지정한 납부일' }
          : { date: null, label: '납부일을 입력해 주세요' }
      }
      let lastPaid = b.lastPaid
      let override = b.nextOverride
      let lastAutoPaid: DateStr | undefined
      // 자동이체면 지나간 납부일은 납부한 것으로 보고, 그 날을 기준으로 다음 납부일을 다시 센다
      for (let i = 0; i < 60; i++) {
        const d = override ?? nthSessionAfter(academy, sessions, lastPaid, b.count)
        if (!academy.autoPay || !d || d >= today) {
          return {
            date: d,
            label: override ? '직접 지정한 납부일' : `${b.count}회 수업마다`,
            lastAutoPaid,
          }
        }
        lastPaid = d
        lastAutoPaid = d
        override = undefined
      }
      return { date: null, label: '납부 일정 없음', lastAutoPaid }
    }
  }
}

/** due: 납부일, window: 납부 기간, auto: 자동이체 */
export type DueKind = 'due' | 'window' | 'auto'

/** 달력의 한 달 범위 안에서 학원별 납부 표시(날짜 → 학원 목록)를 만든다. */
export function dueMarksForRange(
  academies: Academy[],
  sessions: SessionRecord[],
  from: DateStr,
  to: DateStr,
  today: DateStr,
): Map<DateStr, { academy: Academy; kind: DueKind }[]> {
  const marks = new Map<DateStr, { academy: Academy; kind: DueKind }[]>()
  const push = (d: DateStr, academy: Academy, kind: DueKind) => {
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
          // 자동이체는 지난 기간이 이미 납부된 것이므로 표시하지 않는다
          while (d <= w.end && !(a.autoPay && w.end < today)) {
            push(d, a, a.autoPay ? 'auto' : 'window')
            d = addDaysStr(d, 1)
          }
        }
        cur = format(addMonths(fromStr(`${cur}-01`), 1), 'yyyy-MM')
      }
    } else {
      const due = nextDue(a, sessions, today)
      if (due.date) push(due.date, a, a.autoPay ? 'auto' : 'due')
    }
  }
  return marks
}

export { monthKey }
