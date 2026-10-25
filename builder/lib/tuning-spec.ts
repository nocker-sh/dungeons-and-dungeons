/** 調整の指定（builder/tunings/*.ts, *.json）を読み、つまみの今の値を作品データから引く。 */
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"
import { buildContent, overrideSlots } from "./content"
import {
  knobLabel,
  knobPaths,
  parseTuningSpec,
  type Knob,
  type TuningSpec,
} from "./tune"

/** TS でも JSON でも読める。TS は default か、そのまま export したものを使う。 */
export async function loadTuningSpec(file: string): Promise<TuningSpec> {
  const path = resolve(file)
  if (path.endsWith(".json"))
    return parseTuningSpec(JSON.parse(readFileSync(path, "utf8")))
  const loaded: unknown = await import(pathToFileURL(path).href)
  const module = loaded as { default?: unknown }
  return parseTuningSpec(module.default ?? loaded)
}

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
