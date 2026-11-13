import type { DateStr } from '../types'

export interface DayWeather {
  date: DateStr
  icon: string
  text: string
  tMax: number
  tMin: number
  rainProb: number // %
  precipMm: number
  /** 비/눈 알림 문구. 해당 없으면 빈 문자열 */
  alert: string
}

export function describeCode(code: number): { icon: string; text: string; precip: 'rain' | 'snow' | null } {
  if (code === 0) return { icon: '☀️', text: '맑음', precip: null }
  if (code <= 2) return { icon: '🌤️', text: '구름 조금', precip: null }
  if (code === 3) return { icon: '☁️', text: '흐림', precip: null }
  if (code === 45 || code === 48) return { icon: '🌫️', text: '안개', precip: null }
  if (code >= 51 && code <= 57) return { icon: '🌦️', text: '이슬비', precip: 'rain' }
  if (code >= 61 && code <= 67) return { icon: '🌧️', text: '비', precip: 'rain' }
  if (code >= 71 && code <= 77) return { icon: '❄️', text: '눈', precip: 'snow' }
  if (code >= 80 && code <= 82) return { icon: '🌧️', text: '소나기', precip: 'rain' }
  if (code === 85 || code === 86) return { icon: '❄️', text: '눈 소나기', precip: 'snow' }
  if (code >= 95) return { icon: '⛈️', text: '천둥번개', precip: 'rain' }
  return { icon: '❔', text: '알 수 없음', precip: null }
}

interface DailyResponse {
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_probability_max: (number | null)[]
    precipitation_sum: (number | null)[]
  }
}

/** Open-Meteo 응답 → 날짜별 날씨 */
export function parseDaily(json: DailyResponse): Record<DateStr, DayWeather> {
  const d = json.daily
  const out: Record<DateStr, DayWeather> = {}
  d.time.forEach((date, i) => {
    const info = describeCode(d.weather_code[i])
    const rainProb = d.precipitation_probability_max[i] ?? 0
    const precipMm = d.precipitation_sum[i] ?? 0
    let alert = ''
    if (info.precip === 'snow') alert = '눈 소식이 있어요. 따뜻하게 입혀 주세요!'
    else if (info.precip === 'rain' || rainProb >= 60) alert = '비 소식이 있어요. 우산·우비를 챙기세요!'
    out[date] = {
      date,
      icon: info.icon,
      text: info.text,
      tMax: Math.round(d.temperature_2m_max[i]),
      tMin: Math.round(d.temperature_2m_min[i]),
      rainProb,
      precipMm,
      alert,
    }
  })
  return out
}

export interface HourWeather {
  hour: number // 0~23
  icon: string
  text: string
  temp: number
  rainProb: number // %
}

interface HourlyResponse {
  hourly: {
    time: string[] // '2026-11-06T13:00'
    weather_code: number[]
    temperature_2m: number[]
    precipitation_probability: (number | null)[]
  }
}

/** Open-Meteo 시간별 응답 → 날짜별 시간 목록 */
export function parseHourly(json: HourlyResponse): Record<DateStr, HourWeather[]> {
  const h = json.hourly
  const out: Record<DateStr, HourWeather[]> = {}
  h.time.forEach((t, i) => {
    const [date, clock] = t.split('T')
    const info = describeCode(h.weather_code[i])
    ;(out[date] ??= []).push({
      hour: Number(clock.slice(0, 2)),
      icon: info.icon,
      text: info.text,
      temp: Math.round(h.temperature_2m[i]),
      rainProb: h.precipitation_probability[i] ?? 0,
    })
  })
  return out
}

export interface Forecast {
  daily: Record<DateStr, DayWeather>
  hourly: Record<DateStr, HourWeather[]>
}

export async function fetchForecast(lat: number, lon: number): Promise<Forecast> {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${lat}&longitude=${lon}` +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum' +
    '&hourly=weather_code,temperature_2m,precipitation_probability' +
    '&timezone=auto&forecast_days=16'
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`날씨 서버 오류 (${res.status})`)
    const json = await res.json()
    if (!json?.daily?.time) throw new Error('날씨 서버 응답이 올바르지 않아요')
    return { daily: parseDaily(json), hourly: json.hourly?.time ? parseHourly(json) : {} }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('날씨')) throw e
    throw new Error(ctrl.signal.aborted ? '날씨 서버 응답이 너무 느려요' : '인터넷에 연결되지 않았거나 날씨 서버에 접속할 수 없어요')
  } finally {
    clearTimeout(timer)
  }
}

export interface GeoResult {
  name: string
  admin1?: string
  latitude: number
  longitude: number
}

export async function searchCity(name: string): Promise<GeoResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=6&language=ko`
  const res = await fetch(url)
  if (!res.ok) throw new Error('도시 검색에 실패했어요')
  const json = await res.json()
  return json.results ?? []
}
