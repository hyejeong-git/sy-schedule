import type { DateStr, MealDay } from '../types'

type Fields = { am: string; lunch: string; pm: string }

/**
 * 앱에 포함된 월별 식단표: src/data/meals/yyyy-MM.json
 * (매달 식단표 사진을 받아 Claude가 읽어 이 파일을 추가한다)
 */
const files = import.meta.glob<Record<DateStr, Fields>>('../data/meals/*.json', {
  eager: true,
  import: 'default',
})

export const bundledMeals: MealDay[] = Object.values(files).flatMap((month) =>
  Object.entries(month).map(([date, f]) => ({ date, am: f.am, lunch: f.lunch, pm: f.pm })),
)

/** 메뉴에 "/"가 있으면 뒤의 것만 보여준다. 예: "백미밥/흑미밥" → "흑미밥" */
export function showAfterSlash(text: string): string {
  return text
    .split(',')
    .map((item) => item.split('/').pop()!.trim())
    .filter(Boolean)
    .join(', ')
}

/** 앱에 포함된 식단을 바탕으로, 앱에서 직접 고친 식단(저장된 것)이 있으면 그것을 우선한다 */
export function mergeMeals(bundled: MealDay[], stored: MealDay[]): MealDay[] {
  const map = new Map<DateStr, MealDay>()
  for (const m of bundled) map.set(m.date, m)
  for (const m of stored) map.set(m.date, m)
  return [...map.values()].map((m) => ({
    ...m,
    am: showAfterSlash(m.am),
    lunch: showAfterSlash(m.lunch),
    pm: showAfterSlash(m.pm),
  }))
}
