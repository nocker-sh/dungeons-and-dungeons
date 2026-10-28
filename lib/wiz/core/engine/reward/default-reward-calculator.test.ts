import { describe, expect, it } from "vite-plus/test"
import type { WizRewardConfig } from "@/lib/wiz/core/config/battle/wiz-reward-config"
import { WizEngineBattleDefaultRewardCalculator } from "@/lib/wiz/core/engine/reward/default-reward-calculator"
import { wizMockBossEnemyParty } from "@/lib/wiz/core/mocks/wiz-mock-boss-enemy-party"
import { wizMockMixedEnemyParty } from "@/lib/wiz/core/mocks/wiz-mock-mixed-enemy-party"
import { wizMockWeakEnemyParty } from "@/lib/wiz/core/mocks/wiz-mock-weak-enemy-party"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

describe("calculate (デフォルト設定)", () => {
  it("calculateをbindせず呼べ、実装を差し替えられない", () => {
    const calculator = new WizEngineBattleDefaultRewardCalculator()
    const { calculate } = calculator

    const reward = calculate({ enemies: wizMockWeakEnemyParty() })

    expect(reward.experience).toBe(20)
    expect(Object.isFrozen(calculator)).toBe(true)
    expect(
      Object.isFrozen(WizEngineBattleDefaultRewardCalculator.prototype)
    ).toBe(true)
    expect(Object.isFrozen(WizEngineBattleDefaultRewardCalculator)).toBe(true)

    const verifyReadonly = () => {
      const replacementCalculate = calculator.calculate
      // @ts-expect-error calculateはreadonly function property。
      calculator.calculate = replacementCalculate
    }
    void verifyReadonly
  })

  it("経験値を計算できる", () => {
    const calculator = new WizEngineBattleDefaultRewardCalculator()
    const enemies = wizMockWeakEnemyParty() // 2体

    const reward = calculator.calculate({ enemies })

    // デフォルト: モンスターごとの expReward 合計 (フォールバック10)
    expect(reward.experience).toBe(20)
  })

  it("ゴールドを計算できる", () => {
    const calculator = new WizEngineBattleDefaultRewardCalculator()
    const enemies = wizMockWeakEnemyParty() // 2体

    const reward = calculator.calculate({ enemies })

    // デフォルト: モンスターごとの goldReward 合計 (フォールバック5)
    expect(reward.gold).toBe(10)
  })

  it("複数グループの敵からも計算できる", () => {
    const calculator = new WizEngineBattleDefaultRewardCalculator()
    const enemies = wizMockMixedEnemyParty() // 3 + 1 = 4体

    const reward = calculator.calculate({ enemies })

    expect(reward.experience).toBe(40)
    expect(reward.gold).toBe(20)
  })

  it("ボス戦からも計算できる", () => {
    const calculator = new WizEngineBattleDefaultRewardCalculator()
    const enemies = wizMockBossEnemyParty() // 1体

    const reward = calculator.calculate({ enemies })

    expect(reward.experience).toBe(10)
    expect(reward.gold).toBe(5)
  })

  it("dropがなければ空配列を返す", () => {
    const calculator = new WizEngineBattleDefaultRewardCalculator()
    const enemies = wizMockWeakEnemyParty()

    const reward = calculator.calculate({ enemies })

    expect(reward.droppedItems).toHaveLength(0)
  })
})

describe("calculate (カスタム設定)", () => {
  it("構築後のconfig変更から計算規則を所有分離する", () => {
    const config: {
      expFormula: WizRewardConfig["expFormula"]
      goldFormula: WizRewardConfig["goldFormula"]
    } = {
      expFormula: () => 25,
      goldFormula: () => 5,
    }
    const calculator = new WizEngineBattleDefaultRewardCalculator({ config })
    config.expFormula = () => 999
    config.goldFormula = () => 999

    const reward = calculator.calculate({ enemies: wizMockWeakEnemyParty() })

    expect(reward.experience).toBe(25)
    expect(reward.gold).toBe(5)
  })

  it("カスタム経験値計算式を使用できる", () => {
    const config: WizRewardConfig = {
      expFormula: (monsters) => monsters.length * 100,
      goldFormula: (monsters) => monsters.length * 5,
    }
    const calculator = new WizEngineBattleDefaultRewardCalculator({ config })
    const enemies = wizMockWeakEnemyParty() // 2体

    const reward = calculator.calculate({ enemies })

    expect(reward.experience).toBe(200)
  })

  it("カスタムゴールド計算式を使用できる", () => {
    const config: WizRewardConfig = {
      expFormula: (monsters) => monsters.length * 10,
      goldFormula: (monsters) => monsters.length * 50,
    }
    const calculator = new WizEngineBattleDefaultRewardCalculator({ config })
    const enemies = wizMockWeakEnemyParty() // 2体

    const reward = calculator.calculate({ enemies })

    expect(reward.gold).toBe(100)
  })

  it("モンスターのステータスに基づく計算式を使用できる", () => {
    type MockMonster = {
      status: {
        resources: { maximum: (resourceId: "health") => number }
        attributes: { value: (attributeId: "attack") => number }
      }
    }
    const config: WizRewardConfig<MockMonster> = {
      expFormula: (monsters) =>
        monsters.reduce(
          (sum, m) => sum + m.status.resources.maximum("health"),
          0
        ),
      goldFormula: (monsters) =>
        monsters.reduce(
          (sum, m) => sum + m.status.attributes.value("attack"),
          0
        ),
    }
    // WizSceneBattleMonster の status 構造を使う計算式
    const calculator = new WizEngineBattleDefaultRewardCalculator({
      config: config as WizRewardConfig,
    })
    const enemies = wizMockWeakEnemyParty() // ゴブリン2体 (HP: 30, ATK: 8)

    const reward = calculator.calculate({ enemies })

    expect(reward.experience).toBe(60) // 30 * 2
    expect(reward.gold).toBe(16) // 8 * 2
  })
})

describe("constructor", () => {
  it("コンストラクタでインスタンスを作成できる", () => {
    const calculator = new WizEngineBattleDefaultRewardCalculator()

    expect(calculator).toBeInstanceOf(WizEngineBattleDefaultRewardCalculator)
  })

  it("カスタム設定で作成できる", () => {
    const config: WizRewardConfig = {
      expFormula: () => 999,
      goldFormula: () => 999,
    }
    const calculator = new WizEngineBattleDefaultRewardCalculator({ config })
    const enemies = wizMockWeakEnemyParty()

    const reward = calculator.calculate({ enemies })

    expect(reward.experience).toBe(999)
    expect(reward.gold).toBe(999)
  })
})

describe("formula output validation", () => {
  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["negative", -1],
    ["invalid shape", {} as unknown as number],
  ] as const)("expFormulaが%sを返すと即座に拒否する", (_label, value) => {
    let goldFormulaCalled = false
    const calculator = new WizEngineBattleDefaultRewardCalculator({
      config: {
        expFormula: () => value,
        goldFormula: () => {
          goldFormulaCalled = true
          return 0
        },
      },
    })

    let caught: unknown
    try {
      calculator.calculate({ enemies: wizMockWeakEnemyParty() })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(WizValueValidationError)
    expect(caught).toMatchObject({
      path: "expFormula",
      source: "reward-calculator",
    })
    expect(goldFormulaCalled).toBe(false)
  })

  it.each([Number.NaN, Number.NEGATIVE_INFINITY, -1])(
    "goldFormulaの不正出力 %s を拒否する",
    (value) => {
      const calculator = new WizEngineBattleDefaultRewardCalculator({
        config: {
          expFormula: () => 0,
          goldFormula: () => value,
        },
      })

      expect(() =>
        calculator.calculate({ enemies: wizMockWeakEnemyParty() })
      ).toThrow(WizValueValidationError)
    }
  )

  it.each([
    [{ itemId: "", chance: 100 }, "enemies[0].custom.drops[0].itemId"],
    [
      { itemId: "herb", chance: Number.POSITIVE_INFINITY },
      "enemies[0].custom.drops[0].chance",
    ],
  ] as const)("drop definitionの不正値を拒否する", (drop, expectedPath) => {
    const calculator = new WizEngineBattleDefaultRewardCalculator()
    const enemies = {
      getAllMonsters: () => [{ custom: { drops: [drop] } }],
    }
    let caught: unknown

    try {
      calculator.calculate({ enemies: enemies as never })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(WizValueValidationError)
    expect(caught).toMatchObject({
      path: expectedPath,
      source: "reward-calculator",
    })
  })
})
