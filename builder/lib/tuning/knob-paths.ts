import type { Knob } from "@/builder/lib/tuning/types"

export function knobPaths(knob: Knob): readonly string[] {
  return typeof knob.path === "string" ? [knob.path] : knob.path
}
