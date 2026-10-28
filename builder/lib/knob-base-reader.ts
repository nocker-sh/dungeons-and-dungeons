import { buildContent } from "@/builder/lib/build-content"
import { overrideSlots } from "@/builder/lib/override-slots"
import { knobLabel } from "@/builder/lib/tuning/knob-label"
import { knobPaths } from "@/builder/lib/tuning/knob-paths"
import type { Knob } from "@/builder/lib/tuning/types"

/**
 * つまみの今の値を読む関数。scale のつまみは倍率なので 1 から始める。
 * パスが指す先が数値でなければ、探索を始める前に投げる。
 */
export function knobBaseReader(overrides: readonly string[] = []) {
  const { source } = buildContent(overrides)
  return (knob: Knob): number => {
    const values = knobPaths(knob).flatMap((path) =>
      overrideSlots(source, path).map((slot) => slot.parent[slot.key])
    )
    for (const value of values)
      if (typeof value !== "number")
        throw new Error(`${knobLabel(knob)} は数値でない項目を指している`)
    if (!values.length) throw new Error(`${knobLabel(knob)} が何も指していない`)
    return knob.mode === "scale" ? 1 : (values[0] as number)
  }
}
