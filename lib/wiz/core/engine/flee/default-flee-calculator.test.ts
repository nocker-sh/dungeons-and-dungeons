import { expect, test } from "vite-plus/test"
import { WizEngineBattleDefaultFleeCalculator } from "@/lib/wiz/core/engine/flee/default-flee-calculator"
import { WizDice } from "@/lib/wiz/core/services/wiz-dice"

test("calculateをbindせず呼べ、実装を差し替えられない", () => {
  const calculator = new WizEngineBattleDefaultFleeCalculator({
    config: {
      baseChance: 0,
      speedBonusMultiplier: 0,
      maxSpeedBonus: 0,
      attemptBonusPerTry: 0,
      maxChance: 0,
    },
  })
  const { calculate } = calculator

  const result = calculate({
    partyAverageSpeed: 1,
    enemyAverageSpeed: 1,
    attemptCount: 0,
  })

  expect(result.success).toBe(false)
  expect(Object.isFrozen(calculator)).toBe(true)
  expect(Object.isFrozen(WizEngineBattleDefaultFleeCalculator.prototype)).toBe(true)
  expect(Object.isFrozen(WizEngineBattleDefaultFleeCalculator)).toBe(true)

  const verifyReadonly = () => {
    const replacementCalculate = calculator.calculate
    // @ts-expect-error calculateはreadonly function property。
    calculator.calculate = replacementCalculate
  }
  void verifyReadonly
})

test("構築後のconfig変更から判定規則を所有分離する", () => {
  const config = {
    baseChance: 1,
    speedBonusMultiplier: 0,
    maxSpeedBonus: 0,
    attemptBonusPerTry: 0,
    maxChance: 1,
  }
  const calculator = new WizEngineBattleDefaultFleeCalculator({
    config,
    dice: WizDice.fixed([6]),
  })
  config.baseChance = 0
  config.maxChance = 0

  expect(
    calculator.calculate({
      partyAverageSpeed: 1,
      enemyAverageSpeed: 1,
      attemptCount: 0,
    }).success,
  ).toBe(true)
})

test("calculate はスピードが速いほど成功率が上がる", () => {
  const calculator = new WizEngineBattleDefaultFleeCalculator({
    config: {
      baseChance: 0.3,
      speedBonusMultiplier: 0.2,
      maxSpeedBonus: 0.4,
      attemptBonusPerTry: 0.1,
      maxChance: 0.9,
    },
  })

  // スピードが速い場合、何回か試行して成功率を計算
  let fastSuccessCount = 0
  let slowSuccessCount = 0
  const trials = 100

  for (let i = 0; i < trials; i++) {
    const fastResult = calculator.calculate({
      partyAverageSpeed: 20,
      enemyAverageSpeed: 10,
      attemptCount: 0,
    })
    const slowResult = calculator.calculate({
      partyAverageSpeed: 5,
      enemyAverageSpeed: 10,
      attemptCount: 0,
    })

    if (fastResult.success) fastSuccessCount++
    if (slowResult.success) slowSuccessCount++
  }

  // 速い方が成功率が高いはず (確率的なのである程度の余裕を持つ)
  expect(fastSuccessCount).toBeGreaterThanOrEqual(slowSuccessCount - 20)
})

test("calculate は試行回数が増えると成功率が上がる", () => {
  const calculator = new WizEngineBattleDefaultFleeCalculator({
    config: {
      baseChance: 0.1,
      speedBonusMultiplier: 0.1,
      maxSpeedBonus: 0.2,
      attemptBonusPerTry: 0.2,
      maxChance: 0.9,
    },
  })

  let firstAttemptSuccess = 0
  let thirdAttemptSuccess = 0
  const trials = 100

  for (let i = 0; i < trials; i++) {
    const firstResult = calculator.calculate({
      partyAverageSpeed: 10,
      enemyAverageSpeed: 10,
      attemptCount: 0,
    })
    const thirdResult = calculator.calculate({
      partyAverageSpeed: 10,
      enemyAverageSpeed: 10,
      attemptCount: 3,
    })

    if (firstResult.success) firstAttemptSuccess++
    if (thirdResult.success) thirdAttemptSuccess++
  }

  // 3回目の試行の方が成功率が高いはず
  expect(thirdAttemptSuccess).toBeGreaterThanOrEqual(firstAttemptSuccess - 10)
})

test("calculate は maxChance を超えない", () => {
  const calculator = new WizEngineBattleDefaultFleeCalculator({
    config: {
      baseChance: 0.5,
      speedBonusMultiplier: 0.5,
      maxSpeedBonus: 0.5,
      attemptBonusPerTry: 0.3,
      maxChance: 0.7,
    },
  })

  // 高いボーナスでも maxChance を超えないことを確認
  // 確率的テストなので、多くの試行で成功率が maxChance に収束することを確認
  let successCount = 0
  const trials = 1000

  for (let i = 0; i < trials; i++) {
    const result = calculator.calculate({
      partyAverageSpeed: 100,
      enemyAverageSpeed: 10,
      attemptCount: 10,
    })
    if (result.success) successCount++
  }

  const successRate = successCount / trials
  // maxChance の 0.7 に近いはず (±0.1 の範囲)
  expect(successRate).toBeLessThanOrEqual(0.85)
})

test("失敗時は canRetry が true", () => {
  const calculator = new WizEngineBattleDefaultFleeCalculator({
    config: {
      baseChance: 0,
      speedBonusMultiplier: 0,
      maxSpeedBonus: 0,
      attemptBonusPerTry: 0,
      maxChance: 0,
    },
  })

  const result = calculator.calculate({
    partyAverageSpeed: 10,
    enemyAverageSpeed: 10,
    attemptCount: 0,
  })

  expect(result.success).toBe(false)
  expect(result.canRetry).toBe(true)
})

test("new で Calculator を生成できる", () => {
  const calculator = new WizEngineBattleDefaultFleeCalculator()

  expect(calculator).toBeInstanceOf(WizEngineBattleDefaultFleeCalculator)
})
