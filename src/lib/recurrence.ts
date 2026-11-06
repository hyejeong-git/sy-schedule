import { getDay } from 'date-fns'
import type { Academy, DateStr, SessionRecord } from '../types'
import { addDaysStr, fromStr } from './dates'

/** from~to(포함) 사이에서 해당 요일들에 해당하는 날짜 목록 */
export function regularDates(academy: Academy, from: DateStr, to: DateStr): DateStr[] {
  const weekdays = new Set(academy.schedule.map((s) => s.weekday))
  const out: DateStr[] = []
  let cur = from
  while (cur <= to) {
    if (weekdays.has(getDay(fromStr(cur))) && (!academy.endedAt || cur <= academy.endedAt)) {
      out.push(cur)
    }
    cur = addDaysStr(cur, 1)
  }
  return out
}

/**
 * 실제로 수업이 있는(회차로 세는) 날짜 목록.
 * 정규 수업일에서 결석/휴강일을 빼고 보강일을 더한다.
 */
export function countableDates(
  academy: Academy,
  sessions: SessionRecord[],
  from: DateStr,
  to: DateStr,
): DateStr[] {
  const mine = sessions.filter((s) => s.academyId === academy.id)
  const skipped = new Set(
    mine.filter((s) => s.status === 'absent' || s.status === 'cancelled').map((s) => s.date),
  )
  const makeups = mine.filter((s) => s.status === 'makeup' && s.date >= from && s.date <= to).map((s) => s.date)
  const set = new Set([...regularDates(academy, from, to).filter((d) => !skipped.has(d)), ...makeups])
  return [...set].sort()
}
