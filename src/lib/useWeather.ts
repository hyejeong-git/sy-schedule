import { useEffect, useState } from 'react'
import type { DateStr } from '../types'
import { fetchForecast, type DayWeather } from './weather'

/** 위치별 예보를 불러온다. 30분 동안은 기기에 캐시한다. */
export function useWeather(lat: number, lon: number) {
  const [data, setData] = useState<Record<DateStr, DayWeather>>({})
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const key = `sy:weather:${lat.toFixed(2)},${lon.toFixed(2)}`
    try {
      const cached = JSON.parse(localStorage.getItem(key) ?? 'null')
      if (cached && Date.now() - cached.at < 30 * 60 * 1000) {
        setData(cached.data)
        return
      }
    } catch {
      /* 캐시가 깨졌으면 무시 */
    }
    let cancelled = false
    fetchForecast(lat, lon)
      .then((d) => {
        if (cancelled) return
        setData(d)
        setFailed(false)
        localStorage.setItem(key, JSON.stringify({ at: Date.now(), data: d }))
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [lat, lon])

  return { weather: data, weatherFailed: failed }
}
