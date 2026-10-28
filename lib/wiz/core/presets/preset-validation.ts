import type { WizPreset } from "@/lib/wiz/core/presets/wiz-preset"

export type WizPresetValidationDiagnostic =
  | Readonly<{
      code: "not_finite"
      path: string
      value: number
      expected: "finite_number"
      message: string
    }>
  | Readonly<{
      code: "out_of_range"
      path: string
      value: number
      minimum: number
      maximum?: number
      expected: "probability" | "percentage" | "non_negative_number"
      message: string
    }>
  | Readonly<{
      code: "not_integer"
      path: string
      value: number
      expected: "non_negative_integer"
      message: string
    }>
  | Readonly<{
      code: "invalid_order"
      path: string
      minimumPath: string
      maximumPath: string
      minimum: number
      maximum: number
      message: string
    }>
  | Readonly<{
      code: "non_positive_weight_total"
      path: string
      total: number
      message: string
    }>
  | Readonly<{
      code: "invalid_affinity_definition"
      path: string
      message: string
    }>

export type MutableDiagnostic = WizPresetValidationDiagnostic

export type WizPresetValidationInput = Readonly<{
  damage: Pick<
    WizPreset["damage"],
    | "criticalChance"
    | "criticalMultiplier"
    | "backAttackMultiplier"
    | "defendMultiplier"
    | "varianceMin"
    | "varianceMax"
    | "minimumDamage"
  >
  flee: WizPreset["flee"]
  effect: WizPreset["effect"]
  statusConversion: Pick<
    WizPreset["statusConversion"],
    | "attackBase"
    | "attackPerStrength"
    | "defenseBase"
    | "defensePerVitality"
    | "speedBase"
    | "speedPerAgility"
    | "maxHpBase"
    | "maxHpPerVitality"
    | "maxMpBase"
    | "maxMpPerWisdom"
  >
  levelUp: WizPreset["levelUp"]
  conversation: WizPreset["conversation"]
  exploration: WizPreset["exploration"]
  time: WizPreset["time"]
}>
