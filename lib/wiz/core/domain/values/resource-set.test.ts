import { describe, expect, it } from "vite-plus/test"
import {
  WizResourceOperationError,
  WizResourceSet,
} from "@/lib/wiz/core/domain/values/resource-set"

describe("WizResourceSet", () => {
  it("複数resourceのcostを原子的に支払う", () => {
    const resources = WizResourceSet.create({
      mana: { current: 20, maximum: 30 },
      stamina: { current: 40, maximum: 40 },
    })
    const spent = resources.spend({
      mana: 8,
      stamina: 15,
    })

    expect(resources.current("mana")).toBe(20)
    expect(resources.current("stamina")).toBe(40)
    expect(spent.current("mana")).toBe(12)
    expect(spent.current("stamina")).toBe(25)
    expect(spent.restore("mana", 50).current("mana")).toBe(30)

    const verifyResourceId = (): void => {
      // @ts-expect-error 宣言していないresourceは利用できない。
      resources.current("rage")
    }
    void verifyResourceId
  })

  it("一つでも不足する場合は新しいstateを作らず拒否する", () => {
    const resources = WizResourceSet.create({
      mana: { current: 5, maximum: 10 },
      stamina: { current: 20, maximum: 20 },
    })

    expect(() =>
      resources.spend({
        mana: 6,
        stamina: 10,
      }),
    ).toThrow(
      expect.objectContaining({
        available: 5,
        code: "RESOURCE_INSUFFICIENT",
        required: 6,
        resourceId: "mana",
      }),
    )
    expect(resources.current("stamina")).toBe(20)
  })

  it("復元時にID集合とcurrent/maximumを検証する", () => {
    const restored = WizResourceSet.fromUnknown(["health"] as const, {
      health: { current: 3, maximum: 5 },
    })

    expect(restored.current("health")).toBe(3)
    expect(() =>
      WizResourceSet.fromUnknown(["health"] as const, {
        health: { current: 6, maximum: 5 },
      }),
    ).toThrow()
    expect(() => restored.spend({ missing: 1 } as never)).toThrow(WizResourceOperationError)
  })
})
