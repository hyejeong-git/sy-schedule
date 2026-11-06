import type { DateStr } from '../types'
import { addDays } from 'date-fns'
import { blockDates, cleanCellText, dayFromHeader, defaultFirstMonday } from './parseMeal'
import { findMealGrid, type Gray, type Span } from './tableGrid'

export interface MonthMeal {
  date: DateStr
  am: string
  lunch: string
  pm: string
}

const SCALE = 4 // 칸을 키워서 읽으면 정확도가 크게 올라간다
const PAD = 30

async function loadCanvas(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file)
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  c.getContext('2d')!.drawImage(bmp, 0, 0)
  return c
}

function toGray(c: HTMLCanvasElement): Gray {
  const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height)
  const lum = new Uint8Array(c.width * c.height)
  for (let i = 0; i < lum.length; i++) {
    lum[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2])
  }
  return { width: c.width, height: c.height, data: lum }
}

/** 칸 하나를 잘라 키운다. 테두리 선이 글자로 읽히지 않도록 안쪽으로 조금 들어간다. */
function cropCell(src: HTMLCanvasElement, [x0, x1]: [number, number], { y0, y1 }: Span): HTMLCanvasElement {
  const inset = 3
  const w = x1 - x0 - inset * 2
  const h = y1 - y0 - inset * 2
  const out = document.createElement('canvas')
  out.width = w * SCALE + PAD * 2
  out.height = h * SCALE + PAD * 2
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.filter = 'grayscale(1) contrast(1.3)'
  // 글자가 가장자리에 닿으면 잘 안 읽히므로 흰 여백을 둔다
  ctx.drawImage(src, x0 + inset, y0 + inset, w, h, PAD, PAD, w * SCALE, h * SCALE)
  return out
}

/**
 * 월간 식단표 사진을 읽어 날짜별 오전간식·점심·오후간식을 돌려준다. (토·일 제외)
 * 표의 선을 찾지 못하면 null을 돌려준다.
 */
export async function readMonthlyMeals(
  file: File,
  year: number,
  month: number,
  onProgress: (done: number, total: number) => void,
): Promise<MonthMeal[] | null> {
  const canvas = await loadCanvas(file)
  const grid = findMealGrid(toGray(canvas))
  if (!grid) return null

  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('kor')
  const total = grid.blocks.length * (1 + 3 * 5)
  let done = 0
  const tick = () => onProgress(++done, total)
  const out: MonthMeal[] = []

  try {
    for (let b = 0; b < grid.blocks.length; b++) {
      const blk = grid.blocks[b]
      // 1) 날짜 줄 읽기
      await worker.setParameters({ tessedit_pageseg_mode: '7' as never })
      const days: (number | null)[] = []
      for (const col of grid.cols) {
        const r = await worker.recognize(cropCell(canvas, col, blk.header))
        days.push(dayFromHeader(r.data.text))
        tick()
      }
      const fallback = addDays(defaultFirstMonday(year, month), 7 * b)
      const dates = blockDates(days, year, month, fallback)

      // 2) 오전간식 / 중식 / 오후간식 칸 읽기
      await worker.setParameters({ tessedit_pageseg_mode: '6' as never })
      for (let c = 0; c < 5; c++) {
        const date = dates[c]
        if (!date) {
          done += 3
          onProgress(done, total)
          continue
        }
        const read = async (span: Span) => {
          const r = await worker.recognize(cropCell(canvas, grid.cols[c], span))
          tick()
          return cleanCellText(r.data.text)
        }
        out.push({ date, am: await read(blk.am), lunch: await read(blk.lunch), pm: await read(blk.pm) })
      }
    }
  } finally {
    await worker.terminate()
  }
  return out
}
