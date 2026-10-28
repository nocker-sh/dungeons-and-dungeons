import type { TuneTarget } from "@/builder/lib/tuning/types"
import { show } from "@/builder/lib/tuning/show"

/** 目標の範囲を文字にする。 */
export function rangeText(target: TuneTarget): string {
  const low = target.min !== undefined ? show(target, target.min) : ""
  const high = target.max !== undefined ? show(target, target.max) : ""
  return `${low}〜${high}`
}
