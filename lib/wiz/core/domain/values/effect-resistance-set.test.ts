import { describe, expect, it } from "vite-plus/test"
import { WizEffectResistanceSet } from "@/lib/wiz/core/domain/values/effect-resistance-set"

describe("WizEffectResistanceSet", () => {
  it("耐性なし、短縮、完全耐性の有効時間を決定する", () => {
    const resistances = WizEffectResistanceSet.create<"bleeding" | "stunned">({
      entries: [
        { effectId: "stunned", resistance: 0.5 },
        { effectId: "bleeding", resistance: 1 },
      ],
    })

    expect(resistances.resolveDuration("stunned", 1_501)).toEqual({
      effectId: "stunned",
      baseDurationMs: 1_501,
      resistance: 0.5,
      durationMs: 750,
      isImmune: false,
    })
    expect(resistances.resolveDuration("bleeding", 4_000).durationMs).toBe(0)
    expect(resistances.resolveDuration("bleeding", 4_000).isImmune).toBe(true)
    expect(WizEffectResistanceSet.create().resolveDuration("unknown", 900).durationMs).toBe(900)
  })

  it("元の集合を変えずに耐性を追加、更新する", () => {
    const empty = WizEffectResistanceSet.create<"stunned">()
    const resistant = empty.withResistance("stunned", 0.25)
    const updated = resistant.withResistance("stunned", 0.75)

    expect(empty.entries).toEqual([])
    expect(resistant.resistanceOf("stunned")).toBe(0.25)
    expect(updated.resistanceOf("stunned")).toBe(0.75)
    expect(updated.withResistance("stunned", 0.75)).toBe(updated)
  })

  it("入力を防御所有し、effect id順のplain stateを返す", () => {
    const input = {
      entries: [
        { effectId: "stunned", resistance: 0.5 },
        { effectId: "bleeding", resistance: 0.25 },
      ],
    }
    const resistances = WizEffectResistanceSet.create(input)
    input.entries[0] = { effectId: "changed", resistance: 1 }

    expect(resistances.toPlain()).toEqual({
      entries: [
        { effectId: "bleeding", resistance: 0.25 },
        { effectId: "stunned", resistance: 0.5 },
      ],
    })
    expect(Object.isFrozen(resistances)).toBe(true)
    expect(Object.isFrozen(resistances.toPlain())).toBe(true)
    expect(Object.isFrozen(resistances.entries)).toBe(true)
    expect(Object.isFrozen(resistances.entries[0])).toBe(true)
  })

  it.each([
    { entries: [{ effectId: "", resistance: 0.5 }] },
    { entries: [{ effectId: "stunned", resistance: -0.1 }] },
    { entries: [{ effectId: "stunned", resistance: 1.1 }] },
    { entries: [{ effectId: "stunned", resistance: Number.NaN }] },
    {
      entries: [
        { effectId: "stunned", resistance: 0.25 },
        { effectId: "stunned", resistance: 0.5 },
      ],
    },
  ])("不正な耐性stateを拒否する", (state) => {
    expect(() => WizEffectResistanceSet.create(state)).toThrow()
  })

  it("不正な時間と偽のinstanceを拒否する", () => {
    const resistances = WizEffectResistanceSet.create()

    expect(() => resistances.resolveDuration("stunned", 0)).toThrow(TypeError)
    expect(() => resistances.resolveDuration("stunned", 1.5)).toThrow(TypeError)
    expect(() => WizEffectResistanceSet.require({ entries: [] })).toThrow(TypeError)
  })
})
