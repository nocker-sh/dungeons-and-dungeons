import { describe, expect, it } from "vite-plus/test"
import { WizAttributeSet } from "@/lib/wiz/core/domain/values/attribute-set"

describe("WizAttributeSet", () => {
  it("literal IDを保ったまま不変更新する", () => {
    const base = WizAttributeSet.create({
      attack: 10,
      defense: 6,
    })
    const increased = base.add("attack", 4)

    expect(base.value("attack")).toBe(10)
    expect(increased.value("attack")).toBe(14)
    expect(increased.toPlain()).toEqual({
      attack: 14,
      defense: 6,
    })
    expect(Object.isFrozen(increased)).toBe(true)

    const verifyAttributeId = (): void => {
      // @ts-expect-error 宣言していないattributeは利用できない。
      base.value("speed")
    }
    void verifyAttributeId
  })

  it("復元時に宣言したID集合と有限値を要求する", () => {
    const restored = WizAttributeSet.fromUnknown(["attack", "defense"] as const, {
      attack: 2,
      defense: 3,
    })

    expect(restored.value("defense")).toBe(3)
    expect(() =>
      WizAttributeSet.fromUnknown(["attack"] as const, {
        attack: 1,
        defense: 2,
      }),
    ).toThrow()
    expect(() =>
      WizAttributeSet.fromUnknown(["attack"] as const, {
        attack: Number.NaN,
      }),
    ).toThrow()
  })
})
