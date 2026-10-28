import type { Knob } from "@/builder/lib/tuning/types"
import { knobInteger } from "@/builder/lib/tuning/knob-integer"
import { knobStep } from "@/builder/lib/tuning/knob-step"
import { round6 } from "@/builder/lib/tuning/round6"

/** 値を幅の刻みに乗せ、min/max に収める。刻みは今の値を起点にする。 */
export function snapKnob(
  knob: Knob,
  base: number,
  value: number,
  options?: { step?: number; integer?: boolean }
): number {
  const integer = options?.integer ?? knobInteger(knob, base)
  const step = options?.step ?? knobStep(knob, integer)
  const low = Math.min(knob.min, knob.max)
  const high = Math.max(knob.min, knob.max)
  const snapped = base + Math.round((value - base) / step) * step
  const clamped = Math.min(high, Math.max(low, snapped))
  return integer ? Math.round(clamped) : round6(clamped)
}
