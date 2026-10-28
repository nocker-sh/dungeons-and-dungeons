import { z } from "zod"
import { zWizSeason, zWizTimeOfDay, zWizWeather } from "@/lib/wiz/core/types/time"
import { zWizVaultPositiveInteger } from "@/lib/wiz/core/vault/states/schema-values"

// Time state object
export const zWizVaultTimeState = z.strictObject({
  day: zWizVaultPositiveInteger,
  season: zWizSeason,
  timeOfDay: zWizTimeOfDay,
  weather: zWizWeather,
})
export type WizVaultTimeState = z.infer<typeof zWizVaultTimeState>

export const WIZ_VAULT_DEFAULT_TIME: WizVaultTimeState = Object.freeze({
  day: 1,
  season: "spring",
  timeOfDay: "morning",
  weather: "sunny",
})
