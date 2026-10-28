import { expect, test } from "vite-plus/test"
import { WizEngineBattleDefaultDamageCalculator } from "@/lib/wiz/core/engine/damage/default-damage-calculator"
import { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"
import { wizMockGoblinStatus } from "@/lib/wiz/core/mocks/wiz-mock-goblin-status"
import { wizMockHeroStatus } from "@/lib/wiz/core/mocks/wiz-mock-hero-status"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

const createCalculator = () =>
  new WizEngineBattleDefaultDamageCalculator({
    config: {
      minimumDamage: 1,
      damageFormula: (attacker, defender) =>
        Math.max(1, attacker.attack - defender.defense),
      evasionFormula: () => 0, // 回避なし
      criticalChance: 0,
      criticalMultiplier: 2.0,
      backAttackMultiplier: 1.5,
      defendMultiplier: 0.5,
      varianceMin: 1.0,
      varianceMax: 1.0,
    },
  })

const createContext = () => ({
  abilityId: null,
  element: "none" as const,
  defenderAffinity: {
    fire: 1.0,
    ice: 1.0,
    thunder: 1.0,
    none: 1.0,
  },
  isBackAttack: false,
  isCriticalGuaranteed: false,
  isDefending: false,
  weatherBonus: 0,
})

test("calculateをbindせず呼べ、実装を差し替えられない", () => {
  const calculator = createCalculator()
  const { calculate } = calculator

  const result = calculate({
    attacker: wizMockHeroStatus(),
    defender: wizMockGoblinStatus(),
    context: createContext(),
  })

  expect(result.damage).toBe(12)
  expect(Object.isFrozen(calculator)).toBe(true)
  expect(
    Object.isFrozen(WizEngineBattleDefaultDamageCalculator.prototype)
  ).toBe(true)
  expect(Object.isFrozen(WizEngineBattleDefaultDamageCalculator)).toBe(true)

  const verifyReadonly = () => {
    const replacementCalculate = calculator.calculate
    // @ts-expect-error calculateはreadonly function property。
    calculator.calculate = replacementCalculate
  }
  void verifyReadonly
})

test("calculate は攻撃力と防御力に基づいたダメージを返す", () => {
  const calculator = createCalculator()
  const attacker = wizMockHeroStatus()
  const defender = wizMockGoblinStatus()

  const result = calculator.calculate({
    attacker,
    defender,
    context: createContext(),
  })

  // attacker.attack (15) - defender.defense (3) = 12
  expect(result.damage).toBe(12)
  expect(result.isCritical).toBe(false)
  expect(result.isEvaded).toBe(false)
})

test("ability power multiplierを暗黙換算せず直接適用する", () => {
  const calculator = createCalculator()

  const result = calculator.calculate({
    attacker: wizMockHeroStatus(),
    defender: wizMockGoblinStatus(),
    context: {
      ...createContext(),
      abilityId: "focused-strike",
      abilityPowerMultiplier: 0.25,
    },
  })

  expect(result.damage).toBe(3)

  const basicAttack = calculator.calculate({
    attacker: wizMockHeroStatus(),
    defender: wizMockGoblinStatus(),
    context: {
      ...createContext(),
      abilityPowerMultiplier: 0.25,
    },
  })

  expect(basicAttack.damage).toBe(12)
})

test("構築後のconfig変更から計算規則を所有分離する", () => {
  const config = {
    minimumDamage: 10,
    damageFormula: () => 0,
    evasionFormula: () => 0,
    criticalChance: 0,
    criticalMultiplier: 1,
    backAttackMultiplier: 1,
    defendMultiplier: 1,
    varianceMin: 1,
    varianceMax: 1,
  }
  const calculator = new WizEngineBattleDefaultDamageCalculator({ config })
  config.minimumDamage = 0

  const result = calculator.calculate({
    attacker: wizMockHeroStatus(),
    defender: wizMockGoblinStatus(),
    context: createContext(),
  })

  expect(result.damage).toBe(10)
})

test("回避が発生した場合はダメージ 0", () => {
  const calculator = new WizEngineBattleDefaultDamageCalculator({
    config: {
      minimumDamage: 1,
      damageFormula: () => 10,
      evasionFormula: () => 1.0, // 100% 回避
      criticalChance: 0,
      criticalMultiplier: 2.0,
      backAttackMultiplier: 1.5,
      defendMultiplier: 0.5,
      varianceMin: 1.0,
      varianceMax: 1.0,
    },
  })
  const attacker = wizMockHeroStatus()
  const defender = wizMockGoblinStatus()

  const result = calculator.calculate({
    attacker,
    defender,
    context: createContext(),
  })

  expect(result.damage).toBe(0)
  expect(result.isEvaded).toBe(true)
  expect(result.hitCount).toBe(0)
})

test("クリティカルが発生するとダメージが倍加する", () => {
  const calculator = new WizEngineBattleDefaultDamageCalculator({
    config: {
      minimumDamage: 1,
      damageFormula: () => 10,
      evasionFormula: () => 0,
      criticalChance: 1.0, // 100% クリティカル
      criticalMultiplier: 2.0,
      backAttackMultiplier: 1.5,
      defendMultiplier: 0.5,
      varianceMin: 1.0,
      varianceMax: 1.0,
    },
  })
  const attacker = wizMockHeroStatus()
  const defender = wizMockGoblinStatus()

  const result = calculator.calculate({
    attacker,
    defender,
    context: createContext(),
  })

  expect(result.damage).toBe(20)
  expect(result.isCritical).toBe(true)
})

test("isCriticalGuaranteed が true の場合は確定クリティカル", () => {
  const calculator = new WizEngineBattleDefaultDamageCalculator({
    config: {
      minimumDamage: 1,
      damageFormula: () => 10,
      evasionFormula: () => 0,
      criticalChance: 0, // 0% クリティカル
      criticalMultiplier: 2.0,
      backAttackMultiplier: 1.5,
      defendMultiplier: 0.5,
      varianceMin: 1.0,
      varianceMax: 1.0,
    },
  })
  const attacker = wizMockHeroStatus()
  const defender = wizMockGoblinStatus()
  const context = { ...createContext(), isCriticalGuaranteed: true }

  const result = calculator.calculate({
    attacker,
    defender,
    context,
  })

  expect(result.isCritical).toBe(true)
})

test("バックアタックはダメージが増加する", () => {
  const calculator = createCalculator()
  const attacker = wizMockHeroStatus()
  const defender = wizMockGoblinStatus()
  const context = { ...createContext(), isBackAttack: true }

  const result = calculator.calculate({
    attacker,
    defender,
    context,
  })

  // 12 * 1.5 = 18
  expect(result.damage).toBe(18)
})

test("防御中はダメージが減少する", () => {
  const calculator = createCalculator()
  const attacker = wizMockHeroStatus()
  const defender = wizMockGoblinStatus()
  const context = { ...createContext(), isDefending: true }

  const result = calculator.calculate({
    attacker,
    defender,
    context,
  })

  // 12 * 0.5 = 6
  expect(result.damage).toBe(6)
})

test("属性相性でダメージが変化する", () => {
  const calculator = createCalculator()
  const attacker = wizMockHeroStatus()
  const defender = wizMockGoblinStatus()
  const context = {
    ...createContext(),
    element: "fire" as const,
    defenderAffinity: {
      fire: 2.0, // 弱点
      ice: 0.5,
      thunder: 1.0,
      none: 1.0,
    },
  }

  const result = calculator.calculate({
    attacker,
    defender,
    context,
  })

  // 12 * 2.0 = 24
  expect(result.damage).toBe(24)
  expect(result.elementalModifier).toBe(2.0)
})

test("雨天(weatherBonus: -1)はダメージが0.9倍になる", () => {
  const calculator = createCalculator()
  const attacker = wizMockHeroStatus()
  const defender = wizMockGoblinStatus()
  const context = { ...createContext(), weatherBonus: -1 }

  const result = calculator.calculate({
    attacker,
    defender,
    context,
  })

  // 12 * 0.9 = 10.8 → 10
  expect(result.damage).toBe(10)
})

test("嵐(weatherBonus: -2)はダメージが0.8倍になる", () => {
  const calculator = createCalculator()
  const attacker = wizMockHeroStatus()
  const defender = wizMockGoblinStatus()
  const context = { ...createContext(), weatherBonus: -2 }

  const result = calculator.calculate({
    attacker,
    defender,
    context,
  })

  // 12 * 0.8 = 9.6 → 9
  expect(result.damage).toBe(9)
})

test("weatherBonus の最低倍率は 0.5 になる", () => {
  const calculator = createCalculator()
  const attacker = wizMockHeroStatus()
  const defender = wizMockGoblinStatus()
  const context = { ...createContext(), weatherBonus: -10 }

  const result = calculator.calculate({
    attacker,
    defender,
    context,
  })

  // 12 * 0.5 = 6
  expect(result.damage).toBe(6)
})

test("晴天(weatherBonus: 0)はダメージに影響しない", () => {
  const calculator = createCalculator()
  const attacker = wizMockHeroStatus()
  const defender = wizMockGoblinStatus()

  const result = calculator.calculate({
    attacker,
    defender,
    context: createContext(),
  })

  // 12 * 1.0 = 12
  expect(result.damage).toBe(12)
})

test("new でインスタンスを生成できる", () => {
  const calculator = new WizEngineBattleDefaultDamageCalculator()

  expect(calculator).toBeInstanceOf(WizEngineBattleDefaultDamageCalculator)
})

test("custom fieldを含むimmutable BattleStatus viewがformulaへ渡る", () => {
  type MagicStatus = { readonly magic: number }
  let formulaReceivedFrozenViews = false
  const calculator = new WizEngineBattleDefaultDamageCalculator<MagicStatus>({
    config: {
      minimumDamage: 1,
      damageFormula: (attacker, defender) => {
        formulaReceivedFrozenViews =
          Object.isFrozen(attacker) && Object.isFrozen(defender)
        return attacker.magic - defender.magic
      },
      evasionFormula: () => 0,
      criticalChance: 0,
      criticalMultiplier: 2,
      backAttackMultiplier: 1.5,
      defendMultiplier: 0.5,
      varianceMin: 1,
      varianceMax: 1,
    },
  })
  const attacker = WizBattleActorState.create({
    attributes: { attack: 1, defense: 1, speed: 1 },
    resources: {
      health: { current: 100, maximum: 100 },
      mana: { current: 20, maximum: 20 },
    },
    custom: { magic: 14 },
  })
  const defender = WizBattleActorState.create({
    attributes: { attack: 1, defense: 1, speed: 1 },
    resources: {
      health: { current: 100, maximum: 100 },
      mana: { current: 20, maximum: 20 },
    },
    custom: { magic: 2 },
  })

  const result = calculator.calculate({
    attacker,
    defender,
    context: createContext(),
  })

  expect(result.damage).toBe(12)
  expect(formulaReceivedFrozenViews).toBe(true)
})

test.each([
  ["NaN", Number.NaN],
  ["Infinity", Number.POSITIVE_INFINITY],
  ["negative", -1],
  ["invalid shape", {} as unknown as number],
] as const)("damageFormulaが%sを返すと即座に拒否する", (_label, value) => {
  const calculator = new WizEngineBattleDefaultDamageCalculator({
    config: {
      minimumDamage: 1,
      damageFormula: () => value,
      evasionFormula: () => 0,
      criticalChance: 0,
      criticalMultiplier: 2,
      backAttackMultiplier: 1.5,
      defendMultiplier: 0.5,
      varianceMin: 1,
      varianceMax: 1,
    },
  })

  let caught: unknown
  try {
    calculator.calculate({
      attacker: wizMockHeroStatus(),
      defender: wizMockGoblinStatus(),
      context: createContext(),
    })
  } catch (error) {
    caught = error
  }

  expect(caught).toBeInstanceOf(WizValueValidationError)
  expect(caught).toMatchObject({
    path: "damageFormula",
    source: "damage-calculator",
  })
})

test.each([Number.NaN, Number.NEGATIVE_INFINITY, -0.1, 1.1])(
  "evasionFormulaの範囲外出力 %s を拒否する",
  (value) => {
    const calculator = new WizEngineBattleDefaultDamageCalculator({
      config: {
        minimumDamage: 1,
        damageFormula: () => 10,
        evasionFormula: () => value,
        criticalChance: 0,
        criticalMultiplier: 2,
        backAttackMultiplier: 1.5,
        defendMultiplier: 0.5,
        varianceMin: 1,
        varianceMax: 1,
      },
    })

    expect(() =>
      calculator.calculate({
        attacker: wizMockHeroStatus(),
        defender: wizMockGoblinStatus(),
        context: createContext(),
      })
    ).toThrow(WizValueValidationError)
  }
)

test("非finiteな属性倍率を最終damageへ流さない", () => {
  const calculator = createCalculator()

  expect(() =>
    calculator.calculate({
      attacker: wizMockHeroStatus(),
      defender: wizMockGoblinStatus(),
      context: {
        ...createContext(),
        defenderAffinity: {
          ...createContext().defenderAffinity,
          none: Number.POSITIVE_INFINITY,
        },
      },
    })
  ).toThrow(WizValueValidationError)
})
