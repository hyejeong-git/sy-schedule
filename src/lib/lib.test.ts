import { describe, expect, it } from 'vitest'
import type { Academy, SessionRecord } from '../types'
import { addMonthsClamped, dueMarksForRange, monthlyWindow, nextDue } from './billing'
import { parseMealText } from './parseMeal'
import { countableDates, regularDates } from './recurrence'
import { describeCode, parseDaily } from './weather'

const base = (over: Partial<Academy>): Academy => ({
  id: 'a1',
  name: '테스트',
  color: '#f00',
  schedule: [{ weekday: 1 }, { weekday: 3 }], // 월, 수
  billing: { type: 'none' },
  ...over,
})

describe('addMonthsClamped', () => {
  it('말일을 보정한다', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
  })
  it('3개월 뒤 같은 날짜', () => {
    expect(addMonthsClamped('2026-11-10', 3)).toBe('2027-02-10')
  })
})

describe('regularDates / countableDates', () => {
  it('요일에 맞는 날짜를 만든다', () => {
    expect(regularDates(base({}), '2026-11-02', '2026-11-09')).toEqual(['2026-11-02', '2026-11-04', '2026-11-09'])
  })
  it('결석은 빼고 보강은 더한다', () => {
    const s: SessionRecord[] = [
      { id: '1', academyId: 'a1', date: '2026-11-04', status: 'absent' },
      { id: '2', academyId: 'a1', date: '2026-11-07', status: 'makeup' },
    ]
    expect(countableDates(base({}), s, '2026-11-02', '2026-11-09')).toEqual(['2026-11-02', '2026-11-07', '2026-11-09'])
  })
})

describe('nextDue: N개월', () => {
  it('마지막 납부일 + N개월', () => {
    const a = base({ billing: { type: 'months', every: 3, lastPaid: '2026-08-10' } })
    expect(nextDue(a, [], '2026-11-06').date).toBe('2026-11-10')
  })
  it('납부일이 없으면 안내', () => {
    const a = base({ billing: { type: 'months', every: 3 } })
    expect(nextDue(a, [], '2026-11-06').date).toBeNull()
  })
})

describe('nextDue: 매달 기간', () => {
  const a = (paid: string[]) => base({ billing: { type: 'monthlyWindow', startDay: 18, endDay: 23, paidMonths: paid } })
  it('이번 달 기간', () => {
    const d = nextDue(a([]), [], '2026-11-06')
    expect([d.date, d.endDate]).toEqual(['2026-11-18', '2026-11-23'])
  })
  it('이번 달 납부 완료면 다음 달', () => {
    expect(nextDue(a(['2026-11']), [], '2026-11-06').date).toBe('2026-12-18')
  })
  it('기간이 지났으면 다음 달', () => {
    expect(nextDue(a([]), [], '2026-11-24').date).toBe('2026-12-18')
  })
  it('2월처럼 짧은 달은 말일로 보정', () => {
    expect(monthlyWindow('2027-02', 28, 31)).toEqual({ start: '2027-02-28', end: '2027-02-28' })
  })
})

describe('nextDue: N회 수업', () => {
  const a = base({ billing: { type: 'sessions', count: 3, lastPaid: '2026-11-01' } })
  it('N번째 수업일', () => {
    expect(nextDue(a, [], '2026-11-06').date).toBe('2026-11-09')
  })
  it('결석하면 뒤로 밀린다', () => {
    const s: SessionRecord[] = [{ id: '1', academyId: 'a1', date: '2026-11-04', status: 'absent' }]
    expect(nextDue(a, s, '2026-11-06').date).toBe('2026-11-11')
  })
  it('보강을 지정하면 그 날을 센다', () => {
    const s: SessionRecord[] = [
      { id: '1', academyId: 'a1', date: '2026-11-04', status: 'absent' },
      { id: '2', academyId: 'a1', date: '2026-11-07', status: 'makeup' },
    ]
    expect(nextDue(a, s, '2026-11-06').date).toBe('2026-11-09')
  })
  it('직접 지정한 날짜가 우선', () => {
    const o = base({ billing: { type: 'sessions', count: 3, lastPaid: '2026-11-01', nextOverride: '2026-11-20' } })
    expect(nextDue(o, [], '2026-11-06').date).toBe('2026-11-20')
  })
})

describe('dueMarksForRange', () => {
  it('기간제는 기간 전체, 나머지는 납부일 하루', () => {
    const swim = base({ id: 's', billing: { type: 'monthlyWindow', startDay: 18, endDay: 20, paidMonths: [] } })
    const ballet = base({ id: 'b', billing: { type: 'months', every: 3, lastPaid: '2026-08-10' } })
    const m = dueMarksForRange([swim, ballet], [], '2026-11-01', '2026-11-30', '2026-11-06')
    expect([...m.keys()].sort()).toEqual(['2026-11-10', '2026-11-18', '2026-11-19', '2026-11-20'])
  })
})

describe('parseMealText', () => {
  it('월~금 3개 행만 뽑는다', () => {
    const text = [
      '월  화  수  목  금',
      '오전간식  우유  요거트  주스  두유  우유',
      '점심  잡곡밥  쌀밥  김밥  카레  볶음밥',
      '오후간식  과일  빵  떡  고구마  쿠키',
      '저녁  무시됨',
    ].join('\n')
    const g = parseMealText(text)
    expect(g.am).toEqual(['우유', '요거트', '주스', '두유', '우유'])
    expect(g.lunch[2]).toBe('김밥')
    expect(g.pm[4]).toBe('쿠키')
  })
  it('칸이 모자라면 빈 칸으로 채운다', () => {
    const g = parseMealText('점심  밥  국')
    expect(g.lunch).toEqual(['밥', '국', '', '', ''])
  })
})

describe('weather', () => {
  it('비 소식 문구', () => {
    const w = parseDaily({
      daily: {
        time: ['2026-11-06'],
        weather_code: [63],
        temperature_2m_max: [12.4],
        temperature_2m_min: [4.6],
        precipitation_probability_max: [80],
        precipitation_sum: [5.2],
      },
    })['2026-11-06']
    expect(w.tMax).toBe(12)
    expect(w.tMin).toBe(5)
    expect(w.alert).toContain('비')
  })
  it('맑음은 알림 없음', () => {
    expect(describeCode(0).text).toBe('맑음')
  })
})
