import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"

export type WizFleeConfig = {
  readonly baseChance: number
  readonly speedBonusMultiplier: number
  readonly maxSpeedBonus: number
  readonly attemptBonusPerTry: number
  readonly maxChance: number
}

export const DEFAULT_FLEE_CONFIG: WizFleeConfig = immutableConfig({
  baseChance: 0.3,
  speedBonusMultiplier: 0.2,
  maxSpeedBonus: 0.4,
  attemptBonusPerTry: 0.1,
  maxChance: 0.95,
})
