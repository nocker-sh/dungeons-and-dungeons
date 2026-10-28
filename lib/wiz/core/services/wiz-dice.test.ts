import { describe, expect, it } from "vite-plus/test"
import { WizDice } from "@/lib/wiz/core/services/wiz-dice"

describe("roll", () => {
  it("1d6のロールが1-6の範囲を返す", () => {
    const dice = new WizDice()
    for (let i = 0; i < 100; i++) {
      const result = dice.roll(1, 6)
      expect(result.total).toBeGreaterThanOrEqual(1)
      expect(result.total).toBeLessThanOrEqual(6)
      expect(result.rolls).toHaveLength(1)
    }
  })

  it("2d6のロールが2-12の範囲を返す", () => {
    const dice = new WizDice()
    for (let i = 0; i < 100; i++) {
      const result = dice.roll(2, 6)
      expect(result.total).toBeGreaterThanOrEqual(2)
      expect(result.total).toBeLessThanOrEqual(12)
      expect(result.rolls).toHaveLength(2)
    }
  })

  it("修正値が正しく加算される", () => {
    const dice = new WizDice()
    for (let i = 0; i < 100; i++) {
      const result = dice.roll(1, 6, 5)
      expect(result.modifier).toBe(5)
      expect(result.finalTotal).toBe(result.total + 5)
      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.rolls)).toBe(true)
    }
  })

  it("不正なdice式とrandom sourceを拒否する", () => {
    const invalidRandom = new WizDice({ randomFn: () => 1 })

    expect(() => invalidRandom.roll(1, 6)).toThrowError(RangeError)
    expect(() => new WizDice().roll(0, 6)).toThrowError(RangeError)
    expect(() => new WizDice().roll(1, 0)).toThrowError(RangeError)
    expect(() => new WizDice().roll(1.5, 6)).toThrowError(RangeError)
  })
})

describe("roll2d6", () => {
  it("2D6の結果を返す", () => {
    const dice = new WizDice()
    const result = dice.roll2d6()
    expect(result.rolls).toHaveLength(2)
    expect(result.total).toBeGreaterThanOrEqual(2)
    expect(result.total).toBeLessThanOrEqual(12)
  })

  it("修正値付き2D6", () => {
    const dice = new WizDice()
    const result = dice.roll2d6(3)
    expect(result.modifier).toBe(3)
    expect(result.finalTotal).toBe(result.total + 3)
  })
})

describe("check", () => {
  it("目標値以上で成功", () => {
    // 固定値ダイスで確実に成功するケースをテスト
    const dice = WizDice.fixed([6, 6]) // 2D6 = 12
    const result = dice.check(0, 7) // 目標7
    expect(result.success).toBe(true)
    expect(result.roll.total).toBe(12)
  })

  it("目標値未満で失敗", () => {
    const dice = WizDice.fixed([1, 1]) // 2D6 = 2
    const result = dice.check(0, 10) // 目標10
    // ファンブル(2)は常に失敗
    expect(result.success).toBe(false)
    expect(result.criticalFailure).toBe(true)
  })

  it("クリティカル成功 (12)", () => {
    const dice = WizDice.fixed([6, 6])
    const result = dice.check(0, 20) // 普通なら失敗する目標値
    expect(result.criticalSuccess).toBe(true)
    expect(result.success).toBe(true)
  })

  it("クリティカル失敗 (2)", () => {
    const dice = WizDice.fixed([1, 1])
    const result = dice.check(10, 5) // 普通なら成功する目標値
    expect(result.criticalFailure).toBe(true)
    expect(result.success).toBe(false)
  })
})

describe("chance", () => {
  it("100%なら常に成功に近い確率", () => {
    const dice = new WizDice()
    let successes = 0
    for (let i = 0; i < 100; i++) {
      if (dice.chance(100)) successes++
    }
    // 100%なので全て成功するはず
    expect(successes).toBe(100)
  })

  it("0%なら常に失敗", () => {
    const dice = new WizDice()
    let successes = 0
    for (let i = 0; i < 100; i++) {
      if (dice.chance(0)) successes++
    }
    expect(successes).toBe(0)
  })

  it("範囲外percentを拒否する", () => {
    const dice = new WizDice()

    expect(() => dice.chance(-1)).toThrowError(RangeError)
    expect(() => dice.chance(101)).toThrowError(RangeError)
  })

  it("50%なら大体半分成功する", () => {
    const dice = new WizDice()
    let successes = 0
    for (let i = 0; i < 1000; i++) {
      if (dice.chance(50)) successes++
    }
    // 50%の確率なので、350-650の範囲に収まるはず
    expect(successes).toBeGreaterThan(350)
    expect(successes).toBeLessThan(650)
  })
})

describe("weightedPick", () => {
  it("重み付きリストからアイテムを選択する", () => {
    const dice = new WizDice()
    const items = [
      { item: "common", weight: 70 },
      { item: "rare", weight: 25 },
      { item: "epic", weight: 5 },
    ]
    const picked = dice.weightedPick(items)
    expect(picked).not.toBeNull()
    if (picked) expect(["common", "rare", "epic"]).toContain(picked)
  })

  it("空リストはnullを返す", () => {
    const dice = new WizDice()
    const result = dice.weightedPick([])
    expect(result).toBeNull()
  })

  it("全weightが0ならnull、不正weightは拒否する", () => {
    const dice = new WizDice()

    expect(dice.weightedPick([{ item: "none", weight: 0 }])).toBeNull()
    expect(() => dice.weightedPick([{ item: "invalid", weight: -1 }])).toThrowError(RangeError)
    expect(() =>
      dice.weightedPick([
        { item: "first", weight: Number.MAX_VALUE },
        { item: "second", weight: Number.MAX_VALUE },
      ]),
    ).toThrowError("Dice total weight must be finite")
  })

  it("randomが0でもweight 0の項目を選ばず、累積weightの境界を半開区間として扱う", () => {
    const zeroRandomDice = new WizDice({ randomFn: () => 0 })
    const boundaryRandomDice = new WizDice({ randomFn: () => 0.5 })

    expect(
      zeroRandomDice.weightedPick([
        { item: "impossible", weight: 0 },
        { item: "certain", weight: 1 },
      ]),
    ).toBe("certain")
    expect(
      boundaryRandomDice.weightedPick([
        { item: "first", weight: 1 },
        { item: "impossible", weight: 0 },
        { item: "second", weight: 1 },
      ]),
    ).toBe("second")
  })

  it("重みの高いアイテムがより頻繁に選ばれる", () => {
    const dice = new WizDice()
    const items = [
      { item: "common", weight: 90 },
      { item: "rare", weight: 10 },
    ]
    let commonCount = 0
    for (let i = 0; i < 1000; i++) {
      if (dice.weightedPick(items) === "common") commonCount++
    }
    // 90%の確率なので、700回以上は選ばれるはず
    expect(commonCount).toBeGreaterThan(700)
  })
})

describe("pick", () => {
  it("配列からランダムに選択する", () => {
    const dice = new WizDice()
    const items = ["a", "b", "c"]
    const picked = dice.pick(items)
    expect(picked).not.toBeNull()
    if (picked) expect(items).toContain(picked)
  })

  it("空配列はnullを返す", () => {
    const dice = new WizDice()
    const result = dice.pick([])
    expect(result).toBeNull()
  })
})

describe("withSeed", () => {
  it("同じシードで同じ結果を返す", () => {
    const dice1 = WizDice.withSeed(12345)
    const dice2 = WizDice.withSeed(12345)

    const results1 = [dice1.roll(1, 6).total, dice1.roll(1, 6).total, dice1.roll(1, 6).total]
    const results2 = [dice2.roll(1, 6).total, dice2.roll(1, 6).total, dice2.roll(1, 6).total]

    expect(results1).toEqual(results2)
  })
})

describe("fixed", () => {
  it("入力配列を所有し、後からの変更に影響されない", () => {
    const values = [1, 6]
    const dice = WizDice.fixed(values)
    values[0] = 6

    expect(dice.roll(1, 6).total).toBe(1)
    expect(dice.roll(1, 6).total).toBe(6)
  })

  it("空配列と1d6範囲外の値を拒否する", () => {
    expect(() => WizDice.fixed([])).toThrowError(RangeError)
    expect(() => WizDice.fixed([0])).toThrowError(RangeError)
    expect(() => WizDice.fixed([7])).toThrowError(RangeError)
  })
})
