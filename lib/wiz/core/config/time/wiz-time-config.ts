import { z } from "zod"
import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import {
  zWizSeason,
  zWizSeasonEffect,
  zWizTimeEffect,
  zWizTimeOfDay,
  zWizWeather,
  zWizWeatherEffect,
} from "@/lib/wiz/core/types/time"

const zWizWeatherWeightTable = z
  .array(
    z.strictObject({
      weather: zWizWeather,
      weight: z.number().finite().nonnegative(),
    })
  )
  .min(1)
  .superRefine((entries, context) => {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0)
    if (total <= 0) {
      context.addIssue({
        code: "custom",
        message: "weather weight table must have a positive total weight",
      })
    }
  })

export const zWizTimeConfig = z.strictObject({
  seasonEffects: z.record(zWizSeason, zWizSeasonEffect),
  timeEffects: z.record(zWizTimeOfDay, zWizTimeEffect),
  weatherEffects: z.record(zWizWeather, zWizWeatherEffect),
  weatherWeights: z.record(zWizSeason, zWizWeatherWeightTable),
})

export type WizTimeConfig = WizDeepReadonly<z.infer<typeof zWizTimeConfig>>

export const parseWizTimeConfig = (input: unknown): WizTimeConfig =>
  immutableConfig(zWizTimeConfig.parse(input))

/**
 * 時間・季節・天候の効果テーブル設定。
 *
 * 各エフェクトをカスタマイズしたい場合は `WizPresetValue.create` の `time` で上書きする:
 *
 * ```ts
 * WizPresetValue.create({
 *   time: {
 *     seasonEffects: { summer: { ... } },
 *   },
 * })
 * ```
 */
export const DEFAULT_TIME_CONFIG: WizTimeConfig = parseWizTimeConfig({
  seasonEffects: {
    spring: {
      gatheringBonus: 1,
      hungerModifier: 1,
    },
    summer: {
      gatheringBonus: 0,
      hungerModifier: 1.1,
    },
    autumn: {
      gatheringBonus: 2,
      hungerModifier: 1,
    },
    winter: {
      gatheringBonus: -1,
      hungerModifier: 1.3,
    },
  },
  timeEffects: {
    morning: { monsterEncounterRate: 0.8 },
    noon: { monsterEncounterRate: 1.0 },
    evening: { monsterEncounterRate: 1.2 },
    night: { monsterEncounterRate: 1.5 },
  },
  weatherEffects: {
    sunny: {
      gatheringBonus: 1,
      explorationBonus: 1,
      combatBonus: 0,
      hungerModifier: 1,
    },
    cloudy: {
      gatheringBonus: 0,
      explorationBonus: 0,
      combatBonus: 0,
      hungerModifier: 1,
    },
    rainy: {
      gatheringBonus: -1,
      explorationBonus: -1,
      combatBonus: -1,
      hungerModifier: 1.2,
    },
    stormy: {
      gatheringBonus: -2,
      explorationBonus: -2,
      combatBonus: -2,
      hungerModifier: 1.5,
    },
    snowy: {
      gatheringBonus: -1,
      explorationBonus: -1,
      combatBonus: 0,
      hungerModifier: 1.3,
    },
  },
  weatherWeights: {
    spring: [
      { weather: "sunny", weight: 50 },
      { weather: "cloudy", weight: 25 },
      { weather: "rainy", weight: 15 },
      { weather: "stormy", weight: 10 },
    ],
    summer: [
      { weather: "sunny", weight: 50 },
      { weather: "cloudy", weight: 25 },
      { weather: "rainy", weight: 15 },
      { weather: "stormy", weight: 10 },
    ],
    autumn: [
      { weather: "sunny", weight: 50 },
      { weather: "cloudy", weight: 25 },
      { weather: "rainy", weight: 15 },
      { weather: "stormy", weight: 10 },
    ],
    winter: [
      { weather: "snowy", weight: 30 },
      { weather: "cloudy", weight: 40 },
      { weather: "sunny", weight: 20 },
      { weather: "rainy", weight: 10 },
    ],
  },
})
