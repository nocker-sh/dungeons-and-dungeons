import { describe, expect, it } from "vite-plus/test"
import { WizEngineBattleDamageResult } from "@/lib/wiz/core/engine/damage/damage-result"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

describe("constructor", () => {
  it("ダメージ結果を作成できる", () => {
    const result = new WizEngineBattleDamageResult({
      damage: 50,
      isCritical: false,
      isEvaded: false,
      isBlocked: false,
      elementalModifier: 1.0,
      hitCount: 1,
    })

    expect(result.damage).toBe(50)
    expect(result.isCritical).toBe(false)
    expect(result.isEvaded).toBe(false)
    expect(result.hitCount).toBe(1)
  })

  it("クリティカルヒットを記録できる", () => {
    const result = new WizEngineBattleDamageResult({
      damage: 100,
      isCritical: true,
      isEvaded: false,
      isBlocked: false,
      elementalModifier: 1.0,
      hitCount: 1,
    })

    expect(result.isCritical).toBe(true)
  })
})

describe("getTotalDamage", () => {
  it("ヒット数に応じた合計ダメージを返す", () => {
    const result = new WizEngineBattleDamageResult({
      damage: 30,
      isCritical: false,
      isEvaded: false,
      isBlocked: false,
      elementalModifier: 1.0,
      hitCount: 3,
    })

    expect(result.getTotalDamage()).toBe(90)
  })

  it("回避された場合は0を返す", () => {
    const result = new WizEngineBattleDamageResult({
      damage: 50,
      isCritical: false,
      isEvaded: true,
      isBlocked: false,
      elementalModifier: 1.0,
      hitCount: 1,
    })

    expect(result.getTotalDamage()).toBe(0)
  })
})

describe("isHit", () => {
  it("命中した場合はtrueを返す", () => {
    const result = new WizEngineBattleDamageResult({
      damage: 50,
      isCritical: false,
      isEvaded: false,
      isBlocked: false,
      elementalModifier: 1.0,
      hitCount: 1,
    })

    expect(result.isHit()).toBe(true)
  })

  it("回避された場合はfalseを返す", () => {
    const result = new WizEngineBattleDamageResult({
      damage: 0,
      isCritical: false,
      isEvaded: true,
      isBlocked: false,
      elementalModifier: 1.0,
      hitCount: 0,
    })

    expect(result.isHit()).toBe(false)
  })
})

describe("toProperties", () => {
  it("プロパティをオブジェクトとして返す", () => {
    const result = new WizEngineBattleDamageResult({
      damage: 50,
      isCritical: true,
      isEvaded: false,
      isBlocked: false,
      elementalModifier: 1.5,
      hitCount: 2,
    })

    const properties = result.toProperties()

    expect(properties.damage).toBe(50)
    expect(properties.isCritical).toBe(true)
    expect(properties.elementalModifier).toBe(1.5)
    expect(properties.hitCount).toBe(2)
  })
})

describe("属性相性", () => {
  it("属性倍率が記録される", () => {
    const result = new WizEngineBattleDamageResult({
      damage: 50,
      isCritical: false,
      isEvaded: false,
      isBlocked: false,
      elementalModifier: 2.0, // 弱点
      hitCount: 1,
    })

    expect(result.elementalModifier).toBe(2.0)
  })

  it("属性耐性も記録される", () => {
    const result = new WizEngineBattleDamageResult({
      damage: 50,
      isCritical: false,
      isEvaded: false,
      isBlocked: false,
      elementalModifier: 0.5, // 耐性
      hitCount: 1,
    })

    expect(result.elementalModifier).toBe(0.5)
  })
})

describe("validation", () => {
  const createProperties = () => ({
    damage: 50,
    isCritical: false,
    isEvaded: false,
    isBlocked: false,
    elementalModifier: 1,
    hitCount: 1,
  })

  it.each([
    ["damage", Number.NaN],
    ["damage", Number.POSITIVE_INFINITY],
    ["damage", -1],
    ["elementalModifier", Number.NEGATIVE_INFINITY],
    ["elementalModifier", -0.1],
    ["hitCount", 1.5],
    ["hitCount", -1],
  ] as const)("%s の不正値を拒否する", (path, value) => {
    expect(
      () =>
        new WizEngineBattleDamageResult({
          ...createProperties(),
          [path]: value,
        })
    ).toThrow(WizValueValidationError)
  })

  it("必須boolean fieldの不正shapeを拒否する", () => {
    expect(
      () =>
        new WizEngineBattleDamageResult({
          ...createProperties(),
          isCritical: undefined as unknown as boolean,
        })
    ).toThrow(WizValueValidationError)
  })

  it("合計ダメージがoverflowする値を拒否する", () => {
    expect(
      () =>
        new WizEngineBattleDamageResult({
          ...createProperties(),
          damage: Number.MAX_VALUE,
          hitCount: 2,
        })
    ).toThrow(WizValueValidationError)
  })

  it("typed errorにsource/path/valueを保持してfreezeする", () => {
    let caught: unknown
    try {
      new WizEngineBattleDamageResult({
        ...createProperties(),
        damage: Number.NaN,
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(WizValueValidationError)
    const validationError = caught as WizValueValidationError
    expect(validationError.source).toBe("damage-result")
    expect(validationError.path).toBe("damage")
    expect(validationError.value).toBeNaN()
    expect(Object.isFrozen(validationError)).toBe(true)
  })
})
