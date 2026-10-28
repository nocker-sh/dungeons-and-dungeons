import { z } from "zod"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"

/**
 * standard/survival preset が使う時間軸の共有型。
 *
 * config と codex の双方から参照するため、どちらにも属さない基盤型として定義する。
 * 独自の時間軸を使う world module はこの enum に依存せず、独自型を選べる。
 */
export const zWizSeason = z.enum(["spring", "summer", "autumn", "winter"])
export type WizSeason = z.infer<typeof zWizSeason>

export const zWizTimeOfDay = z.enum(["morning", "noon", "evening", "night"])
export type WizTimeOfDay = z.infer<typeof zWizTimeOfDay>

export const zWizWeather = z.enum([
  "sunny",
  "cloudy",
  "rainy",
  "stormy",
  "snowy",
])
export type WizWeather = z.infer<typeof zWizWeather>

export const zWizSeasonEffect = z.strictObject({
  gatheringBonus: z.number().finite(),
  hungerModifier: z.number().finite().nonnegative(),
})
export type WizSeasonEffect = WizDeepReadonly<z.infer<typeof zWizSeasonEffect>>

export const zWizTimeEffect = z.strictObject({
  monsterEncounterRate: z.number().finite().nonnegative(),
})
export type WizTimeEffect = WizDeepReadonly<z.infer<typeof zWizTimeEffect>>

export const zWizWeatherEffect = z.strictObject({
  gatheringBonus: z.number().finite(),
  explorationBonus: z.number().finite(),
  combatBonus: z.number().finite(),
  hungerModifier: z.number().finite().nonnegative(),
})
export type WizWeatherEffect = WizDeepReadonly<
  z.infer<typeof zWizWeatherEffect>
>
