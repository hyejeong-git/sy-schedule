import { describe, expect, it } from 'vitest'
import type { Academy, SessionRecord } from '../types'
import { addMonthsClamped, dueMarksForRange, monthlyWindow, nextDue } from './billing'
import { bundledMeals, mergeMeals, showAfterSlash } from './staticMeals'
import { countableDates, regularDates } from './recurrence'
import { chartPoints, lastChange, series } from './growth'
import { describeCode, parseDaily, parseHourly } from './weather'

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


describe('포함된 식단', () => {
  it('11월은 평일 21일치(2~6, 9~13, 16~20, 23~27, 30)가 들어 있다', () => {
    const nov = mergeMeals(bundledMeals, []).filter((m) => m.date.startsWith('2026-11'))
    expect(nov).toHaveLength(21)
    for (const m of nov) {
      const wd = new Date(m.date + 'T00:00:00').getDay()
      expect(wd).toBeGreaterThanOrEqual(1)
      expect(wd).toBeLessThanOrEqual(5)
      expect(m.am && m.lunch && m.pm).toBeTruthy()
    }
    expect(nov.find((m) => m.date === '2026-11-06')?.pm).toBe('기정떡, 유기농요구르트')
  })
  it('앱에서 고친 식단이 포함된 식단보다 우선한다', () => {
    const merged = mergeMeals(
      [{ date: '2026-11-02', am: 'a', lunch: 'b', pm: 'c' }],
      [{ date: '2026-11-02', am: 'x', lunch: 'b', pm: 'c' }, { date: '2026-12-01', am: 'n', lunch: '', pm: '' }],
    )
    expect(merged).toHaveLength(2)
    expect(merged.find((m) => m.date === '2026-11-02')?.am).toBe('x')
  })
})

describe('슬래시 메뉴', () => {
  it('"/"가 있으면 뒤의 것만 보여준다', () => {
    expect(showAfterSlash('백미밥/흑미밥, 황태두부국, 백김치/깍두기')).toBe('흑미밥, 황태두부국, 깍두기')
    expect(showAfterSlash('우유')).toBe('우유')
    expect(showAfterSlash('')).toBe('')
  })
  it('11월 점심에는 슬래시가 남지 않고 26일은 한우우엉잡채', () => {
    const nov = mergeMeals(bundledMeals, [])
    expect(nov.some((m) => (m.am + m.lunch + m.pm).includes('/'))).toBe(false)
    expect(nov.find((m) => m.date === '2026-11-26')?.lunch).toContain('한우우엉잡채')
    expect(nov.find((m) => m.date === '2026-11-02')?.lunch).toContain('흑미밥, 황태두부국')
  })
})

describe('시간별 날씨', () => {
  it('날짜별 시간 목록으로 바꾼다', () => {
    const r = parseHourly({
      hourly: {
        time: ['2026-11-06T08:00', '2026-11-06T09:00', '2026-11-07T00:00'],
        weather_code: [0, 61, 3],
        temperature_2m: [4.4, 6.6, 3],
        precipitation_probability: [0, 70, null],
      },
    })
    expect(r['2026-11-06']).toEqual([
      { hour: 8, icon: '☀️', text: '맑음', temp: 4, rainProb: 0 },
      { hour: 9, icon: '🌧️', text: '비', temp: 7, rainProb: 70 },
    ])
    expect(r['2026-11-07'][0].rainProb).toBe(0)
  })
})

describe('성장 기록', () => {
  const recs = [
    { id: '1', date: '2026-11-01', height: 108, weight: 17.5, place: '집' },
    { id: '2', date: '2026-05-01', height: 104.2, place: '소아과' },
    { id: '3', date: '2026-08-01', height: 106, weight: 17, place: '어린이집' },
  ]
  it('날짜순으로 정렬하고 값이 있는 것만 뽑는다', () => {
    expect(series(recs, 'height').map((p) => p.date)).toEqual(['2026-05-01', '2026-08-01', '2026-11-01'])
    expect(series(recs, 'weight').map((p) => p.value)).toEqual([17, 17.5])
  })
  it('직전 대비 변화량', () => {
    expect(lastChange(series(recs, 'height'))).toBe(2)
    expect(lastChange(series(recs, 'weight'))).toBe(0.5)
    expect(lastChange(series(recs.slice(0, 1), 'height'))).toBeNull()
  })
  it('차트 좌표: 첫 점은 왼쪽, 마지막은 오른쪽, 큰 값일수록 위', () => {
    const { pts } = chartPoints(series(recs, 'height'), 300, 200, 20)
    expect(pts[0].x).toBe(20)
    expect(pts[2].x).toBe(280)
    expect(pts[2].y).toBeLessThan(pts[0].y)
  })
  it('점이 하나면 가운데', () => {
    expect(chartPoints(series(recs.slice(0, 1), 'height'), 300, 200).pts[0].x).toBe(150)
  })
})
