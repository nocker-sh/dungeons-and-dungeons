import { expect, test } from "vite-plus/test"
import {
  DEFAULT_TIME_CONFIG,
  zWizTimeConfig,
  type WizTimeConfig,
} from "@/lib/wiz/core/config/time/wiz-time-config"
import {
  WizEngineTimeFactory,
  type WizEngineTimeFactoryDefinition,
} from "@/lib/wiz/core/engine/time/wiz-time-factory"
import type { WizSeasonEffect, WizTimeEffect, WizWeatherEffect } from "@/lib/wiz/core/types/time"

const factory = new WizEngineTimeFactory()

test("構築後のnested config変更から時間規則を所有分離する", () => {
  const config = {
    seasonEffects: {
      ...DEFAULT_TIME_CONFIG.seasonEffects,
      spring: { ...DEFAULT_TIME_CONFIG.seasonEffects.spring },
    },
    timeEffects: { ...DEFAULT_TIME_CONFIG.timeEffects },
    weatherEffects: { ...DEFAULT_TIME_CONFIG.weatherEffects },
    weatherWeights: { ...DEFAULT_TIME_CONFIG.weatherWeights },
  }
  const ownedFactory = new WizEngineTimeFactory({ config })
  config.seasonEffects.spring.gatheringBonus = 99

  expect(ownedFactory.getSeasonEffect("spring").gatheringBonus).toBe(1)
  expect(Object.isFrozen(ownedFactory.getSeasonEffect("spring"))).toBe(true)
})

test("custom configを構築時に完全検証する", () => {
  const negativeModifier = {
    ...DEFAULT_TIME_CONFIG,
    seasonEffects: {
      ...DEFAULT_TIME_CONFIG.seasonEffects,
      spring: {
        ...DEFAULT_TIME_CONFIG.seasonEffects.spring,
        hungerModifier: -1,
      },
    },
  }
  const zeroWeightTotal = {
    ...DEFAULT_TIME_CONFIG,
    weatherWeights: {
      ...DEFAULT_TIME_CONFIG.weatherWeights,
      spring: DEFAULT_TIME_CONFIG.weatherWeights.spring.map((entry) => ({
        ...entry,
        weight: 0,
      })),
    },
  }
  const unknownRootProperty = {
    ...DEFAULT_TIME_CONFIG,
    unexpected: true,
  }

  expect(() => new WizEngineTimeFactory({ config: negativeModifier })).toThrow()
  expect(() => new WizEngineTimeFactory({ config: zeroWeightTotal })).toThrow()
  expect(() => new WizEngineTimeFactory({ config: unknownRootProperty })).toThrow()
  expect(zWizTimeConfig.safeParse(DEFAULT_TIME_CONFIG).success).toBe(true)
})

test("readonly random callbackだけで天候抽選を差し替えられる", () => {
  const source = {
    random: () => 0,
  }
  const customFactory = new WizEngineTimeFactory(source)
  const { rollWeather } = customFactory
  source.random = () => 0.999

  expect(rollWeather("spring")).toBe("sunny")
  expect(rollWeather("winter")).toBe("snowy")
  expect(Object.isFrozen(customFactory)).toBe(true)

  const verifyReadonlyDefinition = (value: WizEngineTimeFactoryDefinition): void => {
    // @ts-expect-error random callbackはreadonly。
    value.random = () => 0.5
  }
  void verifyReadonlyDefinition
})

test("getSeason は day から季節を計算する", () => {
  expect(factory.getSeason(1)).toBe("spring")
  expect(factory.getSeason(30)).toBe("spring")
  expect(factory.getSeason(91)).toBe("summer")
  expect(factory.getSeason(181)).toBe("autumn")
  expect(factory.getSeason(271)).toBe("winter")
})

test("getSeason は正のsafe integerだけを受理する", () => {
  expect(() => factory.getSeason(0)).toThrow(RangeError)
  expect(() => factory.getSeason(1.5)).toThrow(RangeError)
  expect(() => factory.getSeason(Number.NaN)).toThrow(RangeError)
  expect(() => factory.getSeason(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError)
})

test("getSeasonEffect は季節ごとのエフェクトを返す", () => {
  const spring = factory.getSeasonEffect("spring")
  const summer = factory.getSeasonEffect("summer")
  const autumn = factory.getSeasonEffect("autumn")
  const winter = factory.getSeasonEffect("winter")

  expect(spring.gatheringBonus).toBe(1)
  expect(spring.hungerModifier).toBe(1)

  expect(summer.hungerModifier).toBe(1.1)

  expect(autumn.gatheringBonus).toBe(2)

  expect(winter.gatheringBonus).toBe(-1)
  expect(winter.hungerModifier).toBe(1.3)
})

test("getTimeOfDay は hour から時間帯を計算する", () => {
  expect(factory.getTimeOfDay(6)).toBe("morning")
  expect(factory.getTimeOfDay(11)).toBe("morning")
  expect(factory.getTimeOfDay(12)).toBe("noon")
  expect(factory.getTimeOfDay(17)).toBe("noon")
  expect(factory.getTimeOfDay(18)).toBe("evening")
  expect(factory.getTimeOfDay(21)).toBe("evening")
  expect(factory.getTimeOfDay(22)).toBe("night")
  expect(factory.getTimeOfDay(5)).toBe("night")
})

test("getTimeOfDay は一日の有限なhourだけを受理する", () => {
  expect(() => factory.getTimeOfDay(-1)).toThrow(RangeError)
  expect(() => factory.getTimeOfDay(24)).toThrow(RangeError)
  expect(() => factory.getTimeOfDay(Number.NaN)).toThrow(RangeError)
  expect(() => factory.getTimeOfDay(Number.POSITIVE_INFINITY)).toThrow(RangeError)
})

test("getTimeEffect は時間帯ごとのエフェクトを返す", () => {
  const morning = factory.getTimeEffect("morning")
  const noon = factory.getTimeEffect("noon")
  const evening = factory.getTimeEffect("evening")
  const night = factory.getTimeEffect("night")

  expect(morning.monsterEncounterRate).toBe(0.8)
  expect(noon.monsterEncounterRate).toBe(1.0)
  expect(evening.monsterEncounterRate).toBe(1.2)
  expect(night.monsterEncounterRate).toBe(1.5)
})

test("rollWeather は有効な天気を返す", () => {
  const validWeathers = ["sunny", "cloudy", "rainy", "stormy", "snowy"]

  const springWeather = factory.rollWeather("spring")
  const winterWeather = factory.rollWeather("winter")

  expect(validWeathers).toContain(springWeather)
  expect(validWeathers).toContain(winterWeather)
})

test("getWeatherEffect は天気ごとのエフェクトを返す", () => {
  const sunny = factory.getWeatherEffect("sunny")
  const rainy = factory.getWeatherEffect("rainy")
  const stormy = factory.getWeatherEffect("stormy")
  const snowy = factory.getWeatherEffect("snowy")

  expect(sunny.gatheringBonus).toBe(1)
  expect(sunny.hungerModifier).toBe(1)

  expect(rainy.gatheringBonus).toBe(-1)
  expect(rainy.hungerModifier).toBe(1.2)

  expect(stormy.gatheringBonus).toBe(-2)
  expect(stormy.hungerModifier).toBe(1.5)

  expect(snowy.gatheringBonus).toBe(-1)
  expect(snowy.hungerModifier).toBe(1.3)
})

test("時間effectはruntimeと型の両方でreadonlyな値を返す", () => {
  const seasonEffect = factory.getSeasonEffect("spring")
  const timeEffect = factory.getTimeEffect("morning")
  const weatherEffect = factory.getWeatherEffect("sunny")
  const verifyReadonlyEffects = (
    readonlySeasonEffect: WizSeasonEffect,
    readonlyTimeEffect: WizTimeEffect,
    readonlyWeatherEffect: WizWeatherEffect,
  ): void => {
    // @ts-expect-error season effect output is readonly.
    readonlySeasonEffect.gatheringBonus = 999
    // @ts-expect-error time effect output is readonly.
    readonlyTimeEffect.monsterEncounterRate = 999
    // @ts-expect-error weather effect output is readonly.
    readonlyWeatherEffect.combatBonus = 999
  }

  expect(Object.isFrozen(seasonEffect)).toBe(true)
  expect(Object.isFrozen(timeEffect)).toBe(true)
  expect(Object.isFrozen(weatherEffect)).toBe(true)
  expect(verifyReadonlyEffects).toBeTypeOf("function")
})

test("default time tableは型とruntimeの両方でdeep readonly", () => {
  const verifyReadonlyTable = (config: WizTimeConfig): void => {
    // @ts-expect-error season table entryはreadonly。
    config.seasonEffects.spring = config.seasonEffects.summer
    // @ts-expect-error weather weight tableはreadonly。
    config.weatherWeights.spring.push({ weather: "sunny", weight: 1 })
    // @ts-expect-error weather weight entryもreadonly。
    config.weatherWeights.spring[0].weight = 999
  }

  expect(Object.isFrozen(DEFAULT_TIME_CONFIG)).toBe(true)
  expect(Object.isFrozen(DEFAULT_TIME_CONFIG.seasonEffects)).toBe(true)
  expect(Object.isFrozen(DEFAULT_TIME_CONFIG.seasonEffects.spring)).toBe(true)
  expect(Object.isFrozen(DEFAULT_TIME_CONFIG.weatherWeights)).toBe(true)
  expect(Object.isFrozen(DEFAULT_TIME_CONFIG.weatherWeights.spring)).toBe(true)
  expect(Object.isFrozen(DEFAULT_TIME_CONFIG.weatherWeights.spring[0])).toBe(true)
  expect(verifyReadonlyTable).toBeTypeOf("function")
})
