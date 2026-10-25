import { describe, expect, it } from "vite-plus/test"
import type { WizPreset } from "@/lib/wiz/core/presets/wiz-preset"
import {
  assertValidWizPreset,
  diagnoseWizPreset,
  WizPresetValidationError,
} from "@/lib/wiz/core/presets/preset-validation"
import { WizPresetValue } from "@/lib/wiz/core/presets/wiz-preset"

const defaultPresetObject = (): WizPreset => WizPresetValue.create()

describe("diagnoseWizPreset", () => {
  it("有効なデフォルトをimmutableな空診断として返す", () => {
    const diagnostics = diagnoseWizPreset(WizPresetValue.create())

    expect(diagnostics).toEqual([])
    expect(Object.isFrozen(diagnostics)).toBe(true)
  })

  it("主要カテゴリの意味的な不正値を一度に診断する", () => {
    const baseline = defaultPresetObject()
    const invalid = {
      ...baseline,
      damage: {
        ...baseline.damage,
        criticalChance: 1.1,
        varianceMin: 2,
        varianceMax: 1,
        minimumDamage: Number.NaN,
      },
      flee: {
        ...baseline.flee,
        baseChance: 0.8,
        maxChance: 0.2,
      },
      effect: {
        ...baseline.effect,
        defaultBuffTurns: -1,
        defaultDebuffTurns: 1.5,
      },
      statusConversion: {
        ...baseline.statusConversion,
        maxHpBase: Number.POSITIVE_INFINITY,
      },
      levelUp: {
        ...baseline.levelUp,
        pointsPerLevelUp: -2,
      },
      conversation: {
        ...baseline.conversation,
        affinity: {
          minimum: 20,
          maximum: 10,
          levels: [{ id: "invalid", minimum: 20 }],
        },
      },
      exploration: {
        ...baseline.exploration,
        monsterEncounterBase: 101,
        eventMin: 70,
        eventMax: 20,
      },
      time: {
        ...baseline.time,
        timeEffects: {
          ...baseline.time.timeEffects,
          night: {
            ...baseline.time.timeEffects.night,
            monsterEncounterRate: -0.1,
          },
        },
        weatherWeights: {
          ...baseline.time.weatherWeights,
          spring: [
            { weather: "sunny", weight: -1 },
            { weather: "rainy", weight: 1 },
          ],
          summer: [
            { weather: "sunny", weight: 0 },
            { weather: "rainy", weight: 0 },
          ],
        },
      },
    } satisfies WizPreset

    const diagnostics = diagnoseWizPreset(invalid)
    const findings = diagnostics.map(({ code, path }) => ({ code, path }))

    expect(findings).toEqual(
      expect.arrayContaining([
        { code: "out_of_range", path: "damage.criticalChance" },
        { code: "invalid_order", path: "damage.variance" },
        { code: "not_finite", path: "damage.minimumDamage" },
        { code: "invalid_order", path: "flee.chance" },
        { code: "out_of_range", path: "effect.defaultBuffTurns" },
        { code: "not_integer", path: "effect.defaultDebuffTurns" },
        { code: "not_finite", path: "statusConversion.maxHpBase" },
        { code: "out_of_range", path: "levelUp.pointsPerLevelUp" },
        { code: "invalid_order", path: "conversation.affinity" },
        { code: "out_of_range", path: "exploration.monsterEncounterBase" },
        { code: "invalid_order", path: "exploration.event" },
        { code: "out_of_range", path: "time.timeEffects.night.monsterEncounterRate" },
        { code: "out_of_range", path: "time.weatherWeights.spring[0].weight" },
        { code: "non_positive_weight_total", path: "time.weatherWeights.summer" },
      ]),
    )
    expect(diagnostics.length).toBeGreaterThanOrEqual(14)
    expect(Object.isFrozen(diagnostics)).toBe(true)
    expect(diagnostics.every(Object.isFrozen)).toBe(true)
  })

  it("負の効果bonusは有効なカスタマイズとして許可する", () => {
    const baseline = defaultPresetObject()
    const preset = {
      ...baseline,
      conversation: {
        ...baseline.conversation,
        affinity: {
          minimum: -100,
          maximum: 100,
          levels: [{ id: "neutral", minimum: -100 }],
        },
        dialogueAffinityBonus: -5,
      },
      exploration: {
        ...baseline.exploration,
        eventWeatherCoefficient: -2,
      },
      time: {
        ...baseline.time,
        seasonEffects: {
          ...baseline.time.seasonEffects,
          winter: {
            ...baseline.time.seasonEffects.winter,
            gatheringBonus: -10,
          },
        },
        weatherEffects: {
          ...baseline.time.weatherEffects,
          stormy: {
            ...baseline.time.weatherEffects.stormy,
            combatBonus: -20,
            explorationBonus: -20,
            gatheringBonus: -20,
          },
        },
      },
    } satisfies WizPreset

    expect(diagnoseWizPreset(preset)).toEqual([])
  })
})

describe("WizPresetValue semantic validation", () => {
  it("createで複数カテゴリの診断を集約したimmutable errorを投げる", () => {
    try {
      WizPresetValue.create({
        damage: {
          criticalChance: Number.NaN,
        },
        effect: {
          defaultEffectTurns: -1,
        },
        exploration: {
          eventBase: 120,
        },
      })
      throw new TypeError("Expected preset validation to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(WizPresetValidationError)
      const validationError = error as WizPresetValidationError
      expect(validationError.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
        "damage.criticalChance",
        "effect.defaultEffectTurns",
        "exploration.eventBase",
      ])
      expect(Object.isFrozen(validationError)).toBe(true)
      expect(Object.isFrozen(validationError.diagnostics)).toBe(true)
      expect(validationError.diagnostics.every(Object.isFrozen)).toBe(true)
    }
  })

  it("withでも完成したpreset全体を再検証する", () => {
    expect(() =>
      WizPresetValue.create().with({
        damage: {
          varianceMin: 1.2,
          varianceMax: 0.8,
        },
      }),
    ).toThrow(WizPresetValidationError)
  })

  it("fromでplain presetの所有権を切って検証する", () => {
    const baseline = defaultPresetObject()
    const damage = {
      ...baseline.damage,
      criticalChance: 0.25,
    }
    const value = WizPresetValue.from({
      ...baseline,
      damage,
    })

    damage.criticalChance = 0.75

    expect(value.damage.criticalChance).toBe(0.25)
    expect(Object.isFrozen(value)).toBe(true)
    expect(Object.isFrozen(value.damage)).toBe(true)
  })

  it("assert境界でもplain presetの集約診断を返す", () => {
    const baseline = defaultPresetObject()
    const invalid = {
      ...baseline,
      exploration: {
        ...baseline.exploration,
        eventMin: -1,
        eventMax: 101,
      },
    }

    expect(() => assertValidWizPreset(invalid)).toThrow(WizPresetValidationError)
  })
})
