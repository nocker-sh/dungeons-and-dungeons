import type { Knob } from "@/builder/lib/tuning/types"
import { knobPaths } from "@/builder/lib/tuning/knob-paths"

export function knobLabel(knob: Knob): string {
  if (knob.label) return knob.label
  const paths = knobPaths(knob)
  const head =
    paths.length > 1 ? `${paths[0]} ほか${paths.length - 1}件` : paths[0]
  return knob.mode === "scale" ? `${head}（倍率）` : head
}
