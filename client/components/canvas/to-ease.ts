import { steps } from "motion"
import type { Ease } from "@/client/components/canvas/play"

export const NAMED: Record<string, Ease> = {
  linear: "linear",
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
}

/** CSS の書き方のイージングを motion の書き方へ。 */
export function toEase(easing: string | undefined): Ease {
  if (!easing) return "linear"
  const named = NAMED[easing]
  if (named) return named
  const bezier = easing.match(/^cubic-bezier\(([^)]+)\)$/)
  if (bezier) {
    const [a, b, c, d] = bezier[1].split(",").map(Number)
    return [a, b, c, d]
  }
  const step = easing.match(/^steps\((\d+)(?:,\s*(\w+))?\)$/)
  if (step)
    return steps(
      Number(step[1]),
      step[2] === "start" || step[2] === "jump-start" ? "start" : "end"
    )
  return "linear"
}
