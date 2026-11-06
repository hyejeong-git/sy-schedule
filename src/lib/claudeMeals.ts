import type { DateStr } from '../types'
import { fromStr } from './dates'
import type { MonthMeal } from './ocrMeals'

export const MODEL = 'claude-sonnet-5-5'
const KEY_STORAGE = 'sy:anthropicKey'

export const getApiKey = () => localStorage.getItem(KEY_STORAGE) ?? ''
export const setApiKey = (k: string) =>
  k ? localStorage.setItem(KEY_STORAGE, k.trim()) : localStorage.removeItem(KEY_STORAGE)

const TOOL = {
  name: 'save_meals',
  description: '식단표에서 읽은 평일(월~금) 식단을 저장한다.',
  input_schema: {
    type: 'object',
    properties: {
      meals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'yyyy-MM-dd' },
            am: { type: 'string', description: '오전간식 메뉴들을 쉼표로 구분' },
            lunch: { type: 'string', description: '중식(점심) 메뉴들을 쉼표로 구분' },
            pm: { type: 'string', description: '오후간식 메뉴들을 쉼표로 구분' },
          },
          required: ['date', 'am', 'lunch', 'pm'],
        },
      },
    },
    required: ['meals'],
  },
}

/** 도구 호출 결과를 검증해 이번 달 평일 식단만 남긴다 */
export function parseClaudeMeals(input: unknown, year: number, month: number): MonthMeal[] {
  const list = (input as { meals?: unknown })?.meals
  if (!Array.isArray(list)) return []
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const out = new Map<DateStr, MonthMeal>()
  for (const m of list) {
    const date = text((m as { date?: unknown })?.date)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const d = fromStr(date)
    if (d.getFullYear() !== year || d.getMonth() + 1 !== month) continue
    if (d.getDay() === 0 || d.getDay() === 6) continue
    const r = m as Record<string, unknown>
    out.set(date, { date, am: text(r.am), lunch: text(r.lunch), pm: text(r.pm) })
  }
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** 사진을 긴 변 2000px 이하 JPEG(base64)로 줄인다 */
async function toBase64Jpeg(file: File): Promise<string> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.92).split(',')[1]
}

/** Claude에게 식단표 사진을 보여주고 월~금 오전간식·점심·오후간식을 받는다 */
export async function readMealsWithClaude(file: File, year: number, month: number): Promise<MonthMeal[]> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('API 키가 없어요. 설정에서 먼저 입력해 주세요.')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // 이 앱은 서버 없이 브라우저에서 직접 호출한다. 키는 이 기기에만 저장된다.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await toBase64Jpeg(file) } },
            {
              type: 'text',
              text:
                `어린이집 ${year}년 ${month}월 식단표 사진입니다. 월~금 평일만, 날짜별로 "오전간식", "중식", "오후간식" 세 줄의 메뉴를 읽어 save_meals로 저장하세요.\n` +
                '- 토요일·일요일 열과 원산지, 알레르기, 영양 안내 등 다른 칸은 무시하세요.\n' +
                '- 한 칸에 여러 줄이 있으면 줄마다 메뉴 하나이므로 쉼표(, )로 이어 쓰세요.\n' +
                '- 글자 옆의 별·꽃 모양 아이콘이나 색깔 표기는 무시하고, 보이는 글자만 그대로 적으세요. 읽을 수 없는 칸은 빈 문자열로 두세요.\n' +
                '- 날짜는 yyyy-MM-dd 형식으로 쓰세요.',
            },
          ],
        },
      ],
    }),
  })
  if (!res.ok) {
    if (res.status === 401) throw new Error('API 키가 올바르지 않아요. 설정에서 확인해 주세요.')
    if (res.status === 429) throw new Error('요청이 너무 많아요. 잠시 뒤에 다시 해 주세요.')
    throw new Error(`Claude 호출에 실패했어요 (${res.status})`)
  }
  const json = await res.json()
  const block = (json.content as { type: string; input?: unknown }[]).find((b) => b.type === 'tool_use')
  const meals = parseClaudeMeals(block?.input, year, month)
  if (meals.length === 0) throw new Error('식단을 찾지 못했어요. 식단표 사진인지 확인해 주세요.')
  return meals
}
