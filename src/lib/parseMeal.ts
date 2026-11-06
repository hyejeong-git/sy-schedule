import type { DateStr } from '../types'
import { toStr } from './dates'

/** 칸에서 읽은 글자를 정리한다: 줄마다 메뉴 하나, 알아볼 수 없는 기호·찌꺼기는 버린다. */
export function cleanCellText(raw: string): string {
  const items: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    const t = line
      .replace(/[^가-힣A-Za-z0-9/()·*~.,&+\-\s]/g, ' ') // 이모지·이상한 기호 제거
      .replace(/\s+/g, ' ')
      .trim()
    // 글자가 2개 미만이면 표의 선이나 얼룩을 잘못 읽은 것으로 본다
    if ((t.match(/[가-힣A-Za-z0-9]/g) ?? []).length >= 2) items.push(t)
  }
  return items.join(', ')
}

/** 날짜 칸 글자("2일(월요일)")에서 일(day) 숫자를 읽는다. 못 읽으면 null */
export function dayFromHeader(text: string): number | null {
  const m = text.match(/(\d{1,2})/)
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= 31 ? n : null
}

/**
 * 한 주(블록)의 월~금 날짜를 구한다.
 * 읽은 날짜 숫자들로 "월요일의 일(day)"을 다수결로 정하고, 하나도 못 읽으면 fallbackMonday를 쓴다.
 * 이번 달이 아닌 날(전달/다음 달)은 null.
 */
export function blockDates(
  headerDays: (number | null)[], // 월~금 순서, 못 읽은 칸은 null
  year: number,
  month: number, // 1~12
  fallbackMonday: Date,
): (DateStr | null)[] {
  const votes = new Map<number, number>()
  headerDays.forEach((d, c) => {
    if (d === null) return
    votes.set(d - c, (votes.get(d - c) ?? 0) + 1)
  })
  let mondayDay: number | null = null
  let best = 0
  for (const [k, n] of votes) if (n > best) [mondayDay, best] = [k, n]

  const monday = mondayDay === null ? fallbackMonday : new Date(year, month - 1, mondayDay)
  return [0, 1, 2, 3, 4].map((c) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + c)
    return d.getMonth() === month - 1 && d.getFullYear() === year ? toStr(d) : null
  })
}

/** 읽은 날짜가 없을 때를 위한 기본 추정: 이 달 1일이 속한 주의 월요일(1일이 일요일이면 2일) */
export function defaultFirstMonday(year: number, month: number): Date {
  const first = new Date(year, month - 1, 1)
  const wd = first.getDay() // 0=일
  if (wd === 0) return new Date(year, month - 1, 2)
  return new Date(year, month - 1, 1 - (wd - 1))
}
