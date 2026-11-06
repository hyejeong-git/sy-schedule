/**
 * 월간 식단표 이미지에서 표의 칸(셀) 위치를 찾는다.
 *
 * 식단표는 한 주마다 [날짜 줄 / 오전간식 / 중식 / 오후간식] 4줄이 반복되는 표다.
 * 글자를 먼저 읽는 대신 표의 가로·세로 선을 찾아 칸을 정확히 잘라내고,
 * 칸마다 따로 글자를 읽으면 훨씬 정확하다.
 */

export interface Gray {
  width: number
  height: number
  /** 밝기(0=검정, 255=흰색), 길이 = width * height */
  data: ArrayLike<number>
}

export interface Span {
  y0: number
  y1: number
}

export interface WeekBlock {
  header: Span
  am: Span
  lunch: Span
  pm: Span
}

export interface MealGrid {
  /** 월~금 5개 열의 [x0, x1] */
  cols: [number, number][]
  blocks: WeekBlock[]
}

const INK = 190 // 이보다 어두우면 선/글자로 본다
const MAX_GAP = 2 // 선이 살짝 끊겨 보여도 이어진 것으로 본다

/** 연속된 정수 위치를 하나로 묶어 가운데 값을 돌려준다 */
function groupCenters(positions: number[]): number[] {
  const out: number[] = []
  let start = -1
  let prev = -10
  for (const p of positions) {
    if (p - prev > 2) {
      if (start >= 0) out.push(Math.round((start + prev) / 2))
      start = p
    }
    prev = p
  }
  if (start >= 0) out.push(Math.round((start + prev) / 2))
  return out
}

function longestRun(isInk: (i: number) => boolean, from: number, to: number): number {
  let best = 0
  let run = 0
  let gap = 0
  for (let i = from; i < to; i++) {
    if (isInk(i)) {
      run += gap + 1
      gap = 0
      if (run > best) best = run
    } else if (run > 0 && ++gap > MAX_GAP) {
      run = 0
      gap = 0
    }
  }
  return best
}

/** 이미지를 가로로 가로지르는 긴 선들의 y 위치 */
export function findHorizontalLines(g: Gray, minFrac = 0.5): number[] {
  const ys: number[] = []
  for (let y = 0; y < g.height; y++) {
    const base = y * g.width
    if (longestRun((x) => g.data[base + x] < INK, 0, g.width) >= minFrac * g.width) ys.push(y)
  }
  return groupCenters(ys)
}

/** y0~y1 구간을 세로로 가로지르는 긴 선들의 x 위치 */
export function findVerticalLines(g: Gray, y0: number, y1: number, minFrac = 0.85): number[] {
  const xs: number[] = []
  for (let x = 0; x < g.width; x++) {
    if (longestRun((y) => g.data[y * g.width + x] < INK, y0, y1) >= minFrac * (y1 - y0)) xs.push(x)
  }
  return groupCenters(xs)
}

/** 선 위치들에서 [날짜줄, 오전간식, 중식, 오후간식]이 반복되는 구간을 찾는다 */
export function findBlocks(lines: number[]): WeekBlock[] {
  const h = (i: number) => lines[i + 1] - lines[i]
  const isBlockAt = (i: number) => {
    if (i + 4 >= lines.length) return false
    const [hd, ham, hlu, hpm] = [h(i), h(i + 1), h(i + 2), h(i + 3)]
    return hlu > 1.8 * Math.max(ham, hpm) && hd < 0.9 * Math.min(ham, hpm)
  }
  let start = 0
  while (start + 4 < lines.length && !isBlockAt(start)) start++
  const blocks: WeekBlock[] = []
  for (let i = start; isBlockAt(i); i += 4) {
    blocks.push({
      header: { y0: lines[i], y1: lines[i + 1] },
      am: { y0: lines[i + 1], y1: lines[i + 2] },
      lunch: { y0: lines[i + 2], y1: lines[i + 3] },
      pm: { y0: lines[i + 3], y1: lines[i + 4] },
    })
  }
  return blocks
}

/** 표 전체 구조 찾기. 못 찾으면 null */
export function findMealGrid(g: Gray): MealGrid | null {
  const blocks = findBlocks(findHorizontalLines(g))
  if (blocks.length === 0) return null
  const lunch = blocks[0].lunch
  const vs = findVerticalLines(g, lunch.y0 + 4, lunch.y1 - 4)
  // 왼쪽 테두리, 구분 칸, 월~토 6칸의 경계 = 최소 8개 선
  if (vs.length < 8) return null
  const cols: [number, number][] = []
  for (let c = 0; c < 5; c++) cols.push([vs[1 + c], vs[2 + c]])
  return { cols, blocks }
}
