import type { TuneTarget } from "@/builder/lib/tuning/types"
import { toleranceOf } from "@/builder/lib/tuning/tolerance-of"

/** 届かない・測れないときの逸脱。有限の値ならここまで大きくならない。 */
export const UNREACHABLE_DEVIATION = 8

/** 範囲からの外れ具合。範囲の中なら0。 */
export function deviationOf(target: TuneTarget, value: number): number {
  if (!Number.isFinite(value)) return UNREACHABLE_DEVIATION
  const tolerance = toleranceOf(target)
  // 頭を押さえない。押さえると遠いところで傾きが消えて、動かす向きが分からなくなる。
  if (target.min !== undefined && value < target.min)
    return (target.min - value) / tolerance
  if (target.max !== undefined && value > target.max)
    return (value - target.max) / tolerance
  return 0
}
