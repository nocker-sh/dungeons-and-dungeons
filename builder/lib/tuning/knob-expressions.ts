import type { Knob } from "@/builder/lib/tuning/types"
import { formatKnobValue } from "@/builder/lib/tuning/format-knob-value"
import { knobPaths } from "@/builder/lib/tuning/knob-paths"

/** つまみの値を上書きの式にする。今の値と同じなら空。 */
export function knobExpressions(
  knob: Knob,
  base: number,
  value: number
): string[] {
  if (value === base) return []
  const operator = knob.mode === "scale" ? "*=" : "="
  const text = formatKnobValue(value)
  return knobPaths(knob).map((path) => `${path}${operator}${text}`)
}
