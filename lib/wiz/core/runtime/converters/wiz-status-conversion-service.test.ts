import { describe, expect, it } from "vite-plus/test"
import { DEFAULT_STATUS_CONVERSION_CONFIG } from "@/lib/wiz/core/config/battle/wiz-status-conversion-config"
import { WizSceneBattleStatusConversionService } from "@/lib/wiz/core/runtime/converters/wiz-status-conversion-service"
import type { WizDefaultBattleStatus } from "@/lib/wiz/core/types/wiz-types"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

type MagicBattleStatus = WizDefaultBattleStatus & {
  readonly magic: number
}

describe("convert", () => {
  it("converts player stats using default config", () => {
    const service = WizSceneBattleStatusConversionService.createDefault()
    const status = service.convert({
      hp: 80,
      maxHp: 100,
      strength: 10,
      vitality: 8,
      agility: 12,
    })

    // attackBase(10) + strength(10) * attackPerStrength(2) = 30
    expect(status.attributes.value("attack")).toBe(30)
    // defenseBase(5) + vitality(8) * defensePerVitality(1) = 13
    expect(status.attributes.value("defense")).toBe(13)
    // speedBase(0) + agility(12) * speedPerAgility(1) = 12
    expect(status.attributes.value("speed")).toBe(12)
    expect(status.resources.current("health")).toBe(80)
    expect(status.resources.maximum("health")).toBe(100)
  })

  it("uses mp values when provided", () => {
    const service = WizSceneBattleStatusConversionService.createDefault()
    const status = service.convert({
      hp: 50,
      maxHp: 50,
      mp: 30,
      maxMp: 40,
      strength: 5,
      vitality: 5,
      agility: 5,
    })

    expect(status.resources.current("mana")).toBe(30)
    expect(status.resources.maximum("mana")).toBe(40)
  })

  it("defaults mp to 0 when not provided", () => {
    const service = WizSceneBattleStatusConversionService.createDefault()
    const status = service.convert({
      hp: 50,
      maxHp: 50,
      strength: 5,
      vitality: 5,
      agility: 5,
    })

    expect(status.resources.current("mana")).toBe(0)
    expect(status.resources.maximum("mana")).toBe(0)
  })

  it("accepts custom config", () => {
    const customConfig = {
      ...DEFAULT_STATUS_CONVERSION_CONFIG,
      attackBase: 20,
      attackPerStrength: 3,
    }
    const service = new WizSceneBattleStatusConversionService(customConfig)
    customConfig.attackBase = 999
    customConfig.attackPerStrength = 999

    const status = service.convert({
      hp: 50,
      maxHp: 50,
      strength: 10,
      vitality: 5,
      agility: 5,
    })

    // attackBase(20) + strength(10) * attackPerStrength(3) = 50
    expect(status.attributes.value("attack")).toBe(50)
  })
})

describe("calculateAttack", () => {
  it("calculates attack from strength", () => {
    const service = WizSceneBattleStatusConversionService.createDefault()
    // attackBase(10) + strength(15) * attackPerStrength(2) = 40
    expect(service.calculateAttack(15)).toBe(40)
  })
})

describe("calculateDefense", () => {
  it("calculates defense from vitality", () => {
    const service = WizSceneBattleStatusConversionService.createDefault()
    // defenseBase(5) + vitality(10) * defensePerVitality(1) = 15
    expect(service.calculateDefense(10)).toBe(15)
  })
})

describe("calculateSpeed", () => {
  it("calculates speed from agility", () => {
    const service = WizSceneBattleStatusConversionService.createDefault()
    // speedBase(0) + agility(20) * speedPerAgility(1) = 20
    expect(service.calculateSpeed(20)).toBe(20)
  })
})

describe("immutability", () => {
  it("is frozen", () => {
    const service = WizSceneBattleStatusConversionService.createDefault()
    expect(Object.isFrozen(service)).toBe(true)
  })
})

describe("formula override", () => {
  const baseInput = {
    hp: 50,
    maxHp: 50,
    strength: 5,
    vitality: 5,
    agility: 5,
    wisdom: 5,
  }

  it("attackFormula を設定すると線形式が無視される", () => {
    const service = new WizSceneBattleStatusConversionService({
      ...DEFAULT_STATUS_CONVERSION_CONFIG,
      attackFormula: (input) => input.strength * 100,
    })

    const status = service.convert(baseInput)
    expect(status.attributes.value("attack")).toBe(500)
  })

  it("formula から customAttributes にアクセスできる", () => {
    const service = new WizSceneBattleStatusConversionService({
      ...DEFAULT_STATUS_CONVERSION_CONFIG,
      speedFormula: (input) =>
        input.agility + (input.customAttributes?.luck ?? 0),
    })

    const status = service.convert({
      ...baseInput,
      customAttributes: { luck: 10 },
    })

    expect(status.attributes.value("speed")).toBe(15)
  })

  it("customAttributes が未指定でも formula は安全に動作する", () => {
    const service = new WizSceneBattleStatusConversionService({
      ...DEFAULT_STATUS_CONVERSION_CONFIG,
      speedFormula: (input) =>
        input.agility + (input.customAttributes?.luck ?? 0),
    })

    const status = service.convert(baseInput)
    expect(status.attributes.value("speed")).toBe(5)
  })

  it("calculateAttack(strength) 単独呼び出しはデフォルト線形を使う", () => {
    const service = new WizSceneBattleStatusConversionService({
      ...DEFAULT_STATUS_CONVERSION_CONFIG,
      attackFormula: (input) => input.strength * 100,
    })

    expect(service.calculateAttack(5)).toBe(20)
  })

  it("customStatusFormulaが型付きcustom fieldを生成する", () => {
    const service =
      new WizSceneBattleStatusConversionService<MagicBattleStatus>({
        ...DEFAULT_STATUS_CONVERSION_CONFIG,
        customStatusFormula: (input) => ({
          magic: (input.wisdom ?? 0) + (input.customAttributes?.luck ?? 0),
        }),
      })

    const status = service.convert({
      ...baseInput,
      customAttributes: { luck: 7 },
    })

    expect(status.custom.magic).toBe(12)
    expect(status.toFormulaView().magic).toBe(12)
  })

  it("battleStatusFormulaで標準fieldを含む完全なviewを生成できる", () => {
    const service =
      new WizSceneBattleStatusConversionService<MagicBattleStatus>({
        ...DEFAULT_STATUS_CONVERSION_CONFIG,
        battleStatusFormula: (input, base) => ({
          ...base,
          attack: input.strength * 10,
          magic: input.wisdom ?? 0,
        }),
      })

    const status = service.convert(baseInput)

    expect(status.attributes.value("attack")).toBe(50)
    expect(status.custom.magic).toBe(5)
    expect(status.toFormulaView()).toEqual({
      hp: 50,
      maxHp: 50,
      mp: 0,
      maxMp: 0,
      attack: 50,
      defense: 10,
      speed: 5,
      magic: 5,
    })
  })
})

describe("formula output validation", () => {
  const baseInput = {
    hp: 50,
    maxHp: 50,
    strength: 5,
    vitality: 5,
    agility: 5,
    wisdom: 5,
  }

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["negative", -1],
    ["invalid shape", {} as unknown as number],
  ] as const)("attackFormulaの%s出力を拒否する", (_label, value) => {
    const service = new WizSceneBattleStatusConversionService({
      ...DEFAULT_STATUS_CONVERSION_CONFIG,
      attackFormula: () => value,
    })
    let caught: unknown

    try {
      service.convert(baseInput)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(WizValueValidationError)
    expect(caught).toMatchObject({
      path: "attackFormula",
      source: "status-conversion",
    })
  })

  it("customStatusFormulaのnested numeric fieldを検証する", () => {
    const service =
      new WizSceneBattleStatusConversionService<MagicBattleStatus>({
        ...DEFAULT_STATUS_CONVERSION_CONFIG,
        customStatusFormula: () => ({
          magic: Number.POSITIVE_INFINITY,
        }),
      })
    let caught: unknown

    try {
      service.convert(baseInput)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(WizValueValidationError)
    expect(caught).toMatchObject({
      path: "customStatusFormula.magic",
      source: "status-conversion",
    })
  })

  it("battleStatusFormulaの不正shapeを検証する", () => {
    const service =
      new WizSceneBattleStatusConversionService<MagicBattleStatus>({
        ...DEFAULT_STATUS_CONVERSION_CONFIG,
        battleStatusFormula: () => null as unknown as MagicBattleStatus,
      })

    expect(() => service.convert(baseInput)).toThrow(WizValueValidationError)
  })

  it("battleStatusFormulaのcurrent/maximum相関を検証する", () => {
    const service =
      new WizSceneBattleStatusConversionService<MagicBattleStatus>({
        ...DEFAULT_STATUS_CONVERSION_CONFIG,
        battleStatusFormula: (_input, base) => ({
          ...base,
          hp: base.maxHp + 1,
          magic: 1,
        }),
      })
    let caught: unknown

    try {
      service.convert(baseInput)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(WizValueValidationError)
    expect(caught).toMatchObject({
      path: "battleStatusFormula.hp",
      source: "status-conversion",
    })
  })

  it("不正inputをformula実行前に拒否する", () => {
    let formulaCalled = false
    const service = new WizSceneBattleStatusConversionService({
      ...DEFAULT_STATUS_CONVERSION_CONFIG,
      attackFormula: () => {
        formulaCalled = true
        return 1
      },
    })

    expect(() =>
      service.convert({
        ...baseInput,
        hp: Number.NaN,
      })
    ).toThrow(WizValueValidationError)
    expect(formulaCalled).toBe(false)
  })
})

describe("constructor boundary", () => {
  it("必須configと数値を実行時にも検証する", () => {
    expect(() =>
      Reflect.construct(WizSceneBattleStatusConversionService, [])
    ).toThrow(WizValueValidationError)
    expect(
      () =>
        new WizSceneBattleStatusConversionService({
          ...DEFAULT_STATUS_CONVERSION_CONFIG,
          attackBase: Number.NaN,
        })
    ).toThrow(WizValueValidationError)
  })

  it("classとprototypeを固定する", () => {
    expect(Object.isFrozen(WizSceneBattleStatusConversionService)).toBe(true)
    expect(
      Object.isFrozen(WizSceneBattleStatusConversionService.prototype)
    ).toBe(true)
  })
})
