import type { TuneTarget } from "@/builder/lib/tuning/types"
import { deviationOf } from "@/builder/lib/tuning/deviation-of"

/** 目標の範囲に入っているか。 */
export function withinTarget(target: TuneTarget, value: number): boolean {
  return deviationOf(target, value) === 0
}
