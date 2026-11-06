import type { DateStr } from '../types'
import { PROFILES, type Data } from '../lib/useData'
import { todayStr } from '../lib/dates'
import type { DayWeather, HourWeather } from '../lib/weather'
import { DayDetail } from './Home'

/** 앱을 열면 처음 보이는 화면: 오늘의 날씨·일정·학원·식단 */
export default function Today({
  data,
  weather,
  hourly,
}: {
  data: Data
  weather: Record<DateStr, DayWeather>
  hourly: Record<DateStr, HourWeather[]>
}) {
  const today = todayStr()
  const me = PROFILES.find((p) => p.id === data.profile)
  return (
    <>
      <p className="greet">{me ? `${me.icon} ${me.label}, 안녕하세요!` : '안녕하세요!'} 오늘 소율이는요</p>
      <DayDetail data={data} date={today} weather={weather[today]} hours={hourly[today]} />
    </>
  )
}
