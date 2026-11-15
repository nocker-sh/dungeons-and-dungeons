import type { StatRange } from "@/development/simulate-growth"

export function formatRange(range: StatRange) {
  const average = Number.isInteger(range.average)
    ? String(range.average)
    : range.average.toFixed(1)
  return range.min === range.max
    ? average
    : `${average}（${range.min}〜${range.max}）`
}
