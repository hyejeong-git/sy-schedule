import type { MealSlot } from '../types'

export type MealGrid = Record<MealSlot, string[]> // 각 5칸: 월~금

const ROW_PATTERNS: { slot: MealSlot; re: RegExp }[] = [
  { slot: 'am', re: /^\s*오\s*전\s*간\s*식/ },
  { slot: 'pm', re: /^\s*오\s*후\s*간\s*식/ },
  { slot: 'lunch', re: /^\s*(점\s*심|중\s*식)/ },
]

const emptyGrid = (): MealGrid => ({
  am: ['', '', '', '', ''],
  lunch: ['', '', '', '', ''],
  pm: ['', '', '', '', ''],
})

function splitCells(rest: string): string[] {
  const text = rest.trim()
  const byGap = text.split(/\s{2,}|\||\t/).map((s) => s.trim()).filter(Boolean)
  if (byGap.length === 5) return byGap
  const bySpace = text.split(/\s+/).filter(Boolean)
  if (bySpace.length === 5) return bySpace
  const cells = byGap.length >= bySpace.length ? byGap : bySpace
  return cells.slice(0, 5)
}

/**
 * OCR 결과 텍스트에서 월~금 × (오전간식/점심/오후간식)만 뽑아낸다.
 * 다른 행(저녁, 알레르기 정보 등)은 무시한다. 인식이 불완전할 수 있으니
 * 화면에서 사용자가 확인·수정할 수 있게 항상 5칸으로 맞춰 돌려준다.
 */
export function parseMealText(text: string): MealGrid {
  const grid = emptyGrid()
  for (const line of text.split(/\r?\n/)) {
    for (const { slot, re } of ROW_PATTERNS) {
      const m = line.match(re)
      if (!m) continue
      const cells = splitCells(line.slice(m[0].length))
      grid[slot] = [0, 1, 2, 3, 4].map((i) => cells[i] ?? '')
      break
    }
  }
  return grid
}
