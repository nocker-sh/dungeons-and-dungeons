import type { TuneTarget } from "@/builder/lib/tuning/types"

export const EPSILON = 1e-9

/** 目標の「これくらい外れたら 1」の幅。 */
export function toleranceOf(target: TuneTarget): number {
  if (target.min !== undefined && target.max !== undefined)
    return Math.max(Math.abs(target.max - target.min), EPSILON)
  const bound = target.min ?? target.max ?? 1
  if (target.unit === "rate") return 0.1
  return Math.max(1, Math.abs(bound) * 0.2)
}
