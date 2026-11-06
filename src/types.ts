/** 날짜는 모두 'yyyy-MM-dd' 문자열로 저장합니다. */
export type DateStr = string

export type EventCategory = 'daycare' | 'hospital' | 'etc'

export interface CalEvent {
  id: string
  title: string
  date: DateStr
  time?: string // 'HH:mm'
  category: EventCategory
  memo?: string
}

export interface WeeklySlot {
  weekday: number // 0=일 ... 6=토
  time?: string // 'HH:mm'
}

export type BillingRule =
  /** N개월마다 같은 날짜에 납부 (예: 발레 3개월) */
  | { type: 'months'; every: number; lastPaid?: DateStr }
  /** 매달 startDay~endDay 사이에 납부 (예: 수영 18~23일) */
  | { type: 'monthlyWindow'; startDay: number; endDay: number; paidMonths: string[] } // 'yyyy-MM'
  /** N회 수업마다 납부 (예: 아지트 13회). nextOverride가 있으면 그 날짜로 직접 지정 */
  | { type: 'sessions'; count: number; lastPaid?: DateStr; nextOverride?: DateStr }
  /** 납부 일정 없음 */
  | { type: 'none' }

export interface Academy {
  id: string
  name: string
  color: string
  schedule: WeeklySlot[]
  billing: BillingRule
  /** 자동이체: 납부일이 지나면 납부한 것으로 자동 반영한다 */
  autoPay?: boolean
  endedAt?: DateStr
}

/** 수업일 예외 기록: 결석/휴강은 회차에 세지 않고, 보강은 추가 수업으로 센다. */
export type SessionStatus = 'absent' | 'cancelled' | 'makeup'

export interface SessionRecord {
  id: string
  academyId: string
  date: DateStr
  status: SessionStatus
}

export type MealSlot = 'am' | 'lunch' | 'pm'

export interface MealDay {
  date: DateStr
  am: string
  lunch: string
  pm: string
}

/** 키·몸무게 기록 (둘 중 하나만 있어도 됨) */
export interface GrowthRecord {
  id: string
  date: DateStr
  height?: number // cm
  weight?: number // kg
  place: string // 어디서 쟀는지
}

export interface Settings {
  fontScale: number // 1 = 보통
  city: string
  latitude: number
  longitude: number
}

export const DEFAULT_SETTINGS: Settings = {
  fontScale: 1,
  city: '서울',
  latitude: 37.5665,
  longitude: 126.978,
}
