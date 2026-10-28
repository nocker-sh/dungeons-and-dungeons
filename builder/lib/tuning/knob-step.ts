import type { Knob } from "@/builder/lib/tuning/types"

/** 一度に動かす幅。 */
export function knobStep(knob: Knob, integer: boolean): number {
  if (knob.step !== undefined && knob.step > 0) return knob.step
  const span = Math.abs(knob.max - knob.min) / 20
  return integer ? Math.max(1, Math.round(span)) : span || 1
}
