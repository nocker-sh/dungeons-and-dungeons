import type { Knob } from "@/builder/lib/tuning/types"

export function knobInteger(knob: Knob, base: number): boolean {
  if (knob.integer !== undefined) return knob.integer
  return knob.mode === "scale" ? false : Number.isInteger(base)
}
