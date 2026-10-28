export type WizDiceResult = {
  readonly rolls: readonly number[]
  readonly total: number
  readonly modifier: number
  readonly finalTotal: number
}

/**
 * ダイスロールユーティリティ
 *
 * 不変でテスト可能なダイスロール機能を提供。
 * TRPG風のダイスロール、確率判定、重み付き抽選に対応。
 *
 * @example
 * ```ts
 * // 基本的な使い方
 * const dice = new WizDice()
 *
 * // 2D6ロール
 * const result = dice.roll2d6()
 * console.log(result.total) // 2-12
 *
 * // 修正値付きロール
 * const attack = dice.roll2d6(5) // 2D6+5
 * console.log(attack.finalTotal) // 7-17
 *
 * // 成功判定 (2D6+modifier >= target)
 * const check = dice.check(3, 10) // 2D6+3 >= 10?
 * if (check.success) console.log("成功!")
 *
 * // 確率判定
 * if (dice.chance(30)) console.log("30%の確率で発動!")
 *
 * // ランダム選択
 * const enemy = dice.pick(["スライム", "ゴブリン", "オーク"])
 *
 * // 重み付き抽選 (ドロップテーブル)
 * const drop = dice.weightedPick([
 *   { item: "common", weight: 70 },
 *   { item: "rare", weight: 25 },
 *   { item: "epic", weight: 5 },
 * ])
 * ```
 *
 * @example
 * ```ts
 * // テスト用: 固定値ダイス
 * const fixedDice = WizDice.fixed([6, 6]) // 常に6が出る
 * const crit = fixedDice.roll2d6() // total = 12 (クリティカル)
 *
 * // テスト用: シード付きダイス (再現可能)
 * const seeded = WizDice.withSeed(12345)
 * ```
 */
export type WizDiceDefinition = {
  readonly randomFn?: () => number
}

export class WizDice {
  private readonly _randomFn: () => number

  constructor(properties: WizDiceDefinition = {}) {
    this._randomFn = properties.randomFn ?? Math.random
    Object.freeze(this)
  }

  static withSeed(seed: number): WizDice {
    if (!Number.isSafeInteger(seed)) {
      throw new RangeError("Dice seed must be a safe integer")
    }
    let current = ((seed % 2147483648) + 2147483648) % 2147483648
    const seededRandom = () => {
      current = (current * 1103515245 + 12345) % 2147483648
      return current / 2147483648
    }
    return new WizDice({ randomFn: seededRandom })
  }

  static fixed(values: readonly number[]): WizDice {
    if (
      values.length === 0 ||
      values.some((value) => !Number.isInteger(value) || value < 1 || value > 6)
    ) {
      throw new RangeError("Fixed dice values must be non-empty integers in the range 1..6")
    }
    const fixedValues = Object.freeze([...values])
    let index = 0
    const fixedRandom = () => {
      const value = fixedValues[index % fixedValues.length]
      index++
      return (value - 1) / 6 // 1-6を0-1に変換
    }
    return new WizDice({ randomFn: fixedRandom })
  }

  roll(count: number, sides: number, modifier: number = 0): WizDiceResult {
    if (!Number.isInteger(count) || count <= 0) {
      throw new RangeError("Dice count must be a positive integer")
    }
    if (!Number.isInteger(sides) || sides <= 0) {
      throw new RangeError("Dice sides must be a positive integer")
    }
    if (!Number.isFinite(modifier)) {
      throw new RangeError("Dice modifier must be finite")
    }
    const rolls: number[] = []
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(this.random() * sides) + 1)
    }
    const total = rolls.reduce((sum, r) => sum + r, 0)
    return Object.freeze({
      rolls: Object.freeze(rolls),
      total,
      modifier,
      finalTotal: total + modifier,
    })
  }

  roll2d6(modifier: number = 0): WizDiceResult {
    return this.roll(2, 6, modifier)
  }

  roll1d100(): WizDiceResult {
    return this.roll(1, 100)
  }

  roll1d6(modifier: number = 0): WizDiceResult {
    return this.roll(1, 6, modifier)
  }

  check(modifier: number, target: number): WizCheckResult {
    if (!Number.isFinite(target)) {
      throw new RangeError("Dice check target must be finite")
    }
    const roll = this.roll2d6(modifier)
    const success = roll.finalTotal >= target
    const criticalSuccess = roll.total === 12
    const criticalFailure = roll.total === 2
    return Object.freeze({
      roll,
      target,
      success: criticalFailure ? false : criticalSuccess ? true : success,
      criticalSuccess,
      criticalFailure,
    })
  }

  chance(percent: number): boolean {
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw new RangeError("Dice chance must be in the range 0..100")
    }
    return this.random() * 100 < percent
  }

  pick<T>(items: readonly T[]): T | null {
    if (items.length === 0) return null
    const index = Math.floor(this.random() * items.length)
    return items[index]
  }

  weightedPick<T>(items: readonly { item: T; weight: number }[]): T | null {
    if (items.length === 0) return null
    if (items.some((entry) => !Number.isFinite(entry.weight) || entry.weight < 0)) {
      throw new RangeError("Dice weights must be finite non-negative numbers")
    }
    const totalWeight = items.reduce((sum, i) => sum + i.weight, 0)
    if (totalWeight === 0) return null
    if (!Number.isFinite(totalWeight)) {
      throw new RangeError("Dice total weight must be finite")
    }
    let random = this.random() * totalWeight
    for (const entry of items) {
      if (entry.weight === 0) {
        continue
      }
      random -= entry.weight
      if (random < 0) return entry.item
    }
    return items.reduceRight<T | null>(
      (fallback, entry) => fallback ?? (entry.weight > 0 ? entry.item : null),
      null,
    )
  }

  /** 検証済みの乱数を一つ取得するbind不要callback。 */
  readonly random = (): number => {
    const value = this._randomFn()
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError("Dice random source must return a finite value in 0 <= value < 1")
    }
    return value
  }
}

export type WizCheckResult = {
  readonly roll: WizDiceResult
  readonly target: number
  readonly success: boolean
  readonly criticalSuccess: boolean
  readonly criticalFailure: boolean
}

Object.freeze(WizDice.prototype)
Object.freeze(WizDice)
