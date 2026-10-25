import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"

export type WizExpFormula = (level: number) => number

export type WizHpGainFormula = (vitalityBonus: number) => number

export type WizLevelUpConfig = {
  readonly pointsPerLevelUp: number
  readonly expFormula: WizExpFormula
  readonly hpGainFormula: WizHpGainFormula
}

export const DEFAULT_LEVEL_UP_CONFIG: WizLevelUpConfig = immutableConfig({
  pointsPerLevelUp: 3,
  expFormula: (level) => level * 50,
  hpGainFormula: (vitalityBonus) => 5 + vitalityBonus * 2,
})
