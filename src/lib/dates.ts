import { addDays, format, parseISO } from 'date-fns'
import type { DateStr } from '../types'

export const toStr = (d: Date): DateStr => format(d, 'yyyy-MM-dd')
export const fromStr = (s: DateStr): Date => parseISO(s)
export const todayStr = (): DateStr => toStr(new Date())
export const addDaysStr = (s: DateStr, n: number): DateStr => toStr(addDays(fromStr(s), n))
export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
export const monthKey = (s: DateStr): string => s.slice(0, 7)
