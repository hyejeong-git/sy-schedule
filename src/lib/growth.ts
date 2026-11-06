import type { DateStr, GrowthRecord } from '../types'
import { fromStr } from './dates'

export type Metric = 'height' | 'weight'

export interface Point {
  date: DateStr
  value: number
  place: string
}

/** 해당 항목(키/몸무게) 값이 있는 기록만 날짜순으로 */
export function series(records: GrowthRecord[], metric: Metric): Point[] {
  return records
    .filter((r) => typeof r[metric] === 'number')
    .map((r) => ({ date: r.date, value: r[metric] as number, place: r.place }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** 직전 기록 대비 변화량 (기록이 2개 미만이면 null) */
export function lastChange(points: Point[]): number | null {
  if (points.length < 2) return null
  const d = points[points.length - 1].value - points[points.length - 2].value
  return Math.round(d * 10) / 10
}

export interface ChartPoint extends Point {
  x: number
  y: number
}

/**
 * 차트 좌표 계산. x는 날짜 간격에 비례하고, y는 값 범위에 여백을 둔다.
 * 점이 하나면 가운데에 놓는다.
 */
export function chartPoints(points: Point[], width: number, height: number, pad = 28): { pts: ChartPoint[]; min: number; max: number } {
  if (points.length === 0) return { pts: [], min: 0, max: 0 }
  const values = points.map((p) => p.value)
  let min = Math.min(...values)
  let max = Math.max(...values)
  const span = max - min || 1
  min -= span * 0.15
  max += span * 0.15
  const t0 = fromStr(points[0].date).getTime()
  const t1 = fromStr(points[points.length - 1].date).getTime()
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  const pts = points.map((p) => ({
    ...p,
    x: t1 === t0 ? width / 2 : pad + ((fromStr(p.date).getTime() - t0) / (t1 - t0)) * innerW,
    y: pad + (1 - (p.value - min) / (max - min)) * innerH,
  }))
  return { pts, min, max }
}
