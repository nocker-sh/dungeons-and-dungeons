import { type TuningSpec, type Knob } from "@/builder/lib/tuning/types"

/** 読み込んだ指定を確かめる（JSON でも同じ形にする）。 */
export function parseTuningSpec(raw: unknown): TuningSpec {
  if (!raw || typeof raw !== "object") throw new Error("調整の指定が読めない")
  const source = raw as Record<string, unknown>
  const id = source.id
  if (typeof id !== "string" || !id) throw new Error("調整の指定に id が要る")
  const targets = source.targets
  if (!Array.isArray(targets) || !targets.length)
    throw new Error(`${id}: 満たす目標（targets）が要る`)
  for (const target of targets)
    if (typeof target !== "string")
      throw new Error(`${id}: targets は目標の id の並び`)
  const knobs = source.knobs
  if (!Array.isArray(knobs) || !knobs.length)
    throw new Error(`${id}: 動かす数値（knobs）が要る`)
  const checked = knobs.map((entry, index) => {
    if (!entry || typeof entry !== "object")
      throw new Error(`${id}: ${index + 1}番目の knob が読めない`)
    const knob = entry as Record<string, unknown>
    const paths =
      typeof knob.path === "string"
        ? [knob.path]
        : Array.isArray(knob.path) &&
            knob.path.every((p) => typeof p === "string")
          ? (knob.path as string[])
          : undefined
    if (!paths?.length)
      throw new Error(`${id}: ${index + 1}番目の knob に path が要る`)
    if (typeof knob.min !== "number" || typeof knob.max !== "number")
      throw new Error(`${id}: ${paths[0]} に min と max が要る`)
    if (knob.min > knob.max)
      throw new Error(`${id}: ${paths[0]} の min が max より大きい`)
    if (knob.mode !== undefined && knob.mode !== "set" && knob.mode !== "scale")
      throw new Error(`${id}: ${paths[0]} の mode は set か scale`)
    const number = (key: string) =>
      typeof knob[key] === "number" ? (knob[key] as number) : undefined
    const checkedKnob: Knob = {
      path: paths,
      mode: knob.mode,
      min: knob.min,
      max: knob.max,
      step: number("step"),
      integer: typeof knob.integer === "boolean" ? knob.integer : undefined,
      keep: number("keep"),
      label: typeof knob.label === "string" ? knob.label : undefined,
    }
    return checkedKnob
  })
  return {
    id,
    label: typeof source.label === "string" ? source.label : undefined,
    targets: targets as string[],
    knobs: checked,
  }
}
