import { describe, expect, it } from "vite-plus/test"
import { WizStateCraftingResult } from "@/lib/wiz/core/domain/values/crafting-result"
import type { WizSkillCheckResult } from "@/lib/wiz/core/types"

const createDiceResult = (overrides: Partial<WizSkillCheckResult> = {}): WizSkillCheckResult => ({
  dice: [4, 3] as const,
  total: 7,
  modifier: 0,
  targetNumber: 10,
  success: true,
  critical: false,
  fumble: false,
  ...overrides,
})

describe("pending", () => {
  it("creates a pending result", () => {
    const result = WizStateCraftingResult.pending()
    expect(result.status).toBe("pending")
    expect(result.isPending).toBe(true)
    expect(result.isSuccess).toBe(false)
    expect(result.isFailure).toBe(false)
  })

  it("returns null for quality", () => {
    expect(WizStateCraftingResult.pending().quality).toBeNull()
  })

  it("returns null for diceResult", () => {
    expect(WizStateCraftingResult.pending().diceResult).toBeNull()
  })

  it("returns 0 for materialsLost", () => {
    expect(WizStateCraftingResult.pending().materialsLost).toBe(0)
  })

  it("isHighQuality returns false", () => {
    expect(WizStateCraftingResult.pending().isHighQuality).toBe(false)
  })
})

describe("success", () => {
  it("creates a normal quality success when not critical", () => {
    const dice = createDiceResult({ critical: false })
    const result = WizStateCraftingResult.success(dice)
    expect(result.status).toBe("success")
    expect(result.isSuccess).toBe(true)
    expect(result.isPending).toBe(false)
    expect(result.isFailure).toBe(false)
    expect(result.quality).toBe("normal")
    expect(result.isHighQuality).toBe(false)
  })

  it("creates a high quality success when critical", () => {
    const dice = createDiceResult({ critical: true })
    const result = WizStateCraftingResult.success(dice)
    expect(result.quality).toBe("high")
    expect(result.isHighQuality).toBe(true)
  })

  it("exposes diceResult", () => {
    const dice = createDiceResult()
    const result = WizStateCraftingResult.success(dice)
    expect(result.diceResult).toEqual(dice)
  })

  it("returns 0 for materialsLost", () => {
    const dice = createDiceResult()
    expect(WizStateCraftingResult.success(dice).materialsLost).toBe(0)
  })
})

describe("failure", () => {
  it("creates a failure result", () => {
    const dice = createDiceResult({ success: false })
    const result = WizStateCraftingResult.failure(dice, 2)
    expect(result.status).toBe("failure")
    expect(result.isFailure).toBe(true)
    expect(result.isPending).toBe(false)
    expect(result.isSuccess).toBe(false)
  })

  it("exposes materialsLost", () => {
    const dice = createDiceResult({ success: false })
    const result = WizStateCraftingResult.failure(dice, 3)
    expect(result.materialsLost).toBe(3)
  })

  it("exposes diceResult", () => {
    const dice = createDiceResult({ success: false })
    const result = WizStateCraftingResult.failure(dice, 1)
    expect(result.diceResult).toEqual(dice)
  })

  it("returns null for quality", () => {
    const dice = createDiceResult({ success: false })
    expect(WizStateCraftingResult.failure(dice, 1).quality).toBeNull()
  })

  it("isHighQuality returns false", () => {
    const dice = createDiceResult({ success: false })
    expect(WizStateCraftingResult.failure(dice, 1).isHighQuality).toBe(false)
  })
})

describe("toPlain round-trip", () => {
  it("round-trips pending result", () => {
    const original = WizStateCraftingResult.pending()
    const plain = original.toPlain()
    expect(plain).toEqual({ status: "pending" })
  })

  it("round-trips success result", () => {
    const dice = createDiceResult({ critical: true })
    const original = WizStateCraftingResult.success(dice)
    const plain = original.toPlain()
    expect(plain).toEqual({
      status: "success",
      quality: "high",
      diceResult: dice,
    })
  })

  it("round-trips failure result", () => {
    const dice = createDiceResult({ success: false })
    const original = WizStateCraftingResult.failure(dice, 2)
    const plain = original.toPlain()
    expect(plain).toEqual({
      status: "failure",
      diceResult: dice,
      materialsLost: 2,
    })
  })
})

describe("immutability", () => {
  it("pending is frozen", () => {
    expect(Object.isFrozen(WizStateCraftingResult.pending())).toBe(true)
  })

  it("success is frozen", () => {
    const dice = createDiceResult()
    const result = WizStateCraftingResult.success(dice)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.toPlain())).toBe(true)
    expect(Object.isFrozen(result.diceResult)).toBe(true)
    expect(Object.isFrozen(result.diceResult?.dice)).toBe(true)
  })

  it("failure is frozen", () => {
    const dice = createDiceResult({ success: false })
    expect(Object.isFrozen(WizStateCraftingResult.failure(dice, 1))).toBe(true)
  })

  it("入力のdice resultをdefensive copyする", () => {
    const dice = {
      ...createDiceResult(),
      dice: [4, 3] as [number, number],
    }
    const result = WizStateCraftingResult.success(dice)

    dice.total = 99
    dice.dice[0] = 6

    expect(result.diceResult?.total).toBe(7)
    expect(result.diceResult?.dice).toEqual([4, 3])
  })
})
