import { round6 } from "@/builder/lib/tuning/round6"

/** 数値を上書きの書き方にする。 */
export function formatKnobValue(value: number): string {
  return Number.isInteger(value) ? String(value) : String(round6(value))
}
