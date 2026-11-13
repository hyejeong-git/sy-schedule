import { useCallback, useEffect, useState } from 'react'
import { fetchForecast, type Forecast } from './weather'

const EMPTY: Forecast = { daily: {}, hourly: {} }

export interface WeatherStatus {
  loading: boolean
  /** 실패했을 때 이유 (성공이면 빈 문자열) */
  error: string
  /** 캐시를 무시하고 다시 불러온다 */
  reload: () => void
}

/** 위치별 예보를 불러온다. 30분 동안은 기기에 캐시한다. */
export function useWeather(lat: number, lon: number) {
  const [data, setData] = useState<Forecast>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    setData(EMPTY)
    setError('')
    const key = `sy:weather2:${lat.toFixed(2)},${lon.toFixed(2)}`
    if (nonce === 0) {
      try {
        const cached = JSON.parse(localStorage.getItem(key) ?? 'null')
        if (cached && Date.now() - cached.at < 30 * 60 * 1000 && Object.keys(cached.data?.daily ?? {}).length > 0) {
          setData(cached.data)
          setLoading(false)
          return
        }
      } catch {
        /* 캐시가 깨졌으면 무시 */
      }
    }
    let cancelled = false
    setLoading(true)
    fetchForecast(lat, lon)
      .then((d) => {
        if (cancelled) return
        setData(d)
        try {
          localStorage.setItem(key, JSON.stringify({ at: Date.now(), data: d }))
        } catch {
          /* 저장 공간이 없어도 화면에는 보여준다 */
        }
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : '날씨를 불러오지 못했어요'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [lat, lon, nonce])

  const status: WeatherStatus = { loading, error, reload }
  return { weather: data.daily, hourly: data.hourly, weatherFailed: Boolean(error), status }
}
