import { describe, expect, it } from 'vitest'
import type { Academy, SessionRecord } from '../types'
import { addMonthsClamped, dueMarksForRange, monthlyWindow, nextDue } from './billing'
import { blockDates, cleanCellText, dayFromHeader, defaultFirstMonday } from './parseMeal'
import { parseClaudeMeals } from './claudeMeals'
import { findMealGrid, type Gray } from './tableGrid'
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


describe('식단 글자 정리', () => {
  it('줄마다 메뉴 하나, 기호 찌꺼기는 버린다', () => {
    expect(cleanCellText('밀크롤인 \n우유 🌼\n ㅣ \n')).toBe('밀크롤인, 우유')
  })
  it('날짜 칸에서 일 숫자를 읽는다', () => {
    expect(dayFromHeader('10밀(화요일)')).toBe(10)
    expect(dayFromHeader('abc')).toBeNull()
  })
  it('읽은 날짜를 다수결로 월요일 기준을 정한다', () => {
    // 3번째 칸을 잘못 읽어도(11) 나머지가 맞으면 9~13일
    const d = blockDates([9, 10, 99 % 31, 12, 13], 2026, 11, new Date(2026, 10, 2))
    expect(d).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'])
  })
  it('이번 달이 아닌 날은 제외', () => {
    // 11월 30일(월)이 있는 주: 화~금은 12월
    expect(blockDates([30, null, null, null, null], 2026, 11, new Date(2026, 10, 30))).toEqual([
      '2026-11-30', null, null, null, null,
    ])
  })
  it('읽은 날짜가 없으면 기본 추정 사용', () => {
    expect(blockDates([null, null, null, null, null], 2026, 11, defaultFirstMonday(2026, 11))[0]).toBe('2026-11-02')
    expect(defaultFirstMonday(2026, 10).getDate()).toBe(28) // 10/1(목)이 속한 주의 월요일은 9/28 
  })
})

describe('표 칸 찾기', () => {
  // 가짜 식단표: 4줄(날짜 20, 오전 36, 중식 110, 오후 36) × 2주, 열 8개 선
  const W = 600
  const ys = [10, 30, 66, 176, 212, 232, 268, 378, 414]
  const xs = [10, 70, 160, 250, 340, 430, 520, 590]
  const data = new Uint8Array(W * 450).fill(255)
  for (const y of ys) for (let x = xs[0]; x <= xs[xs.length - 1]; x++) data[y * W + x] = 60
  for (const x of xs) for (let y = ys[0]; y <= ys[ys.length - 1]; y++) data[y * W + x] = 60
  const g: Gray = { width: W, height: 450, data }
  it('주 블록과 월~금 열을 찾는다', () => {
    const grid = findMealGrid(g)!
    expect(grid.blocks).toHaveLength(2)
    expect(grid.blocks[0].lunch).toEqual({ y0: 66, y1: 176 })
    expect(grid.cols).toHaveLength(5)
    expect(grid.cols[0]).toEqual([70, 160])
    expect(grid.cols[4]).toEqual([430, 520])
  })
  it('표가 없으면 null', () => {
    expect(findMealGrid({ width: 100, height: 100, data: new Uint8Array(10000).fill(255) })).toBeNull()
  })
})

describe('Claude 식단 결과 정리', () => {
  it('이번 달 평일만 남기고 잘못된 항목은 버린다', () => {
    const r = parseClaudeMeals(
      {
        meals: [
          { date: '2026-11-03', am: ' 우유 ', lunch: '밥, 국', pm: '과일' },
          { date: '2026-11-07', am: '토요일', lunch: '', pm: '' }, // 토
          { date: '2026-12-01', am: '다음 달', lunch: '', pm: '' },
          { date: '11월 4일', am: '형식 오류', lunch: '', pm: '' },
          { date: '2026-11-02', am: 5, lunch: '밥', pm: '' }, // 숫자는 빈 문자열로
        ],
      },
      2026,
      11,
    )
    expect(r).toEqual([
      { date: '2026-11-02', am: '', lunch: '밥', pm: '' },
      { date: '2026-11-03', am: '우유', lunch: '밥, 국', pm: '과일' },
    ])
  })
  it('이상한 입력은 빈 목록', () => {
    expect(parseClaudeMeals(null, 2026, 11)).toEqual([])
    expect(parseClaudeMeals({ meals: 'x' }, 2026, 11)).toEqual([])
  })
})

