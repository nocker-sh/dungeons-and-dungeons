import { WizConversationAffinitySystem } from "@/lib/wiz/core/engine/conversation/create-wiz-standard-conversation-affinity-system"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"
import type {
  WizSeason,
  WizTimeOfDay,
  WizWeather,
} from "@/lib/wiz/core/types/time"
import type {
  WizPresetValidationInput,
  WizPresetValidationDiagnostic,
  MutableDiagnostic,
} from "@/lib/wiz/core/presets/preset-validation"
import { diagnoseRange } from "@/lib/wiz/core/presets/diagnose-range"
import { diagnoseOrder } from "@/lib/wiz/core/presets/diagnose-order"
import { diagnoseNonNegativeInteger } from "@/lib/wiz/core/presets/diagnose-non-negative-integer"
import { diagnoseFinite } from "@/lib/wiz/core/presets/diagnose-finite"
import { freezeDiagnostics } from "@/lib/wiz/core/presets/freeze-diagnostics"

export const SEASONS = Object.freeze([
  "spring",
  "summer",
  "autumn",
  "winter",
] as const satisfies readonly WizSeason[])

export const TIMES_OF_DAY = Object.freeze([
  "morning",
  "noon",
  "evening",
  "night",
] as const satisfies readonly WizTimeOfDay[])

export const WEATHERS = Object.freeze([
  "sunny",
  "cloudy",
  "rainy",
  "stormy",
  "snowy",
] as const satisfies readonly WizWeather[])

/**
 * プリセットの数値パラメータを、副作用なしで一括診断する。
 *
 * 任意の入力に対して安全に呼べる式の戻り値までは評価しない。式が返す値の
 * 制約は、その式を利用する差し替え可能なserviceの責務として残す。
 */
export function diagnoseWizPreset(
  preset: WizPresetValidationInput
): readonly WizPresetValidationDiagnostic[] {
  const diagnostics: MutableDiagnostic[] = []

  diagnoseRange(
    diagnostics,
    "damage.criticalChance",
    preset.damage.criticalChance,
    0,
    1,
    "probability"
  )
  diagnoseRange(
    diagnostics,
    "damage.criticalMultiplier",
    preset.damage.criticalMultiplier,
    0,
    undefined,
    "non_negative_number"
  )
  diagnoseRange(
    diagnostics,
    "damage.backAttackMultiplier",
    preset.damage.backAttackMultiplier,
    0,
    undefined,
    "non_negative_number"
  )
  diagnoseRange(
    diagnostics,
    "damage.defendMultiplier",
    preset.damage.defendMultiplier,
    0,
    undefined,
    "non_negative_number"
  )
  diagnoseRange(
    diagnostics,
    "damage.varianceMin",
    preset.damage.varianceMin,
    0,
    undefined,
    "non_negative_number"
  )
  diagnoseRange(
    diagnostics,
    "damage.varianceMax",
    preset.damage.varianceMax,
    0,
    undefined,
    "non_negative_number"
  )
  diagnoseOrder(
    diagnostics,
    "damage.variance",
    "damage.varianceMin",
    preset.damage.varianceMin,
    "damage.varianceMax",
    preset.damage.varianceMax
  )
  diagnoseRange(
    diagnostics,
    "damage.minimumDamage",
    preset.damage.minimumDamage,
    0,
    undefined,
    "non_negative_number"
  )

  diagnoseRange(
    diagnostics,
    "flee.baseChance",
    preset.flee.baseChance,
    0,
    1,
    "probability"
  )
  diagnoseRange(
    diagnostics,
    "flee.speedBonusMultiplier",
    preset.flee.speedBonusMultiplier,
    0,
    undefined,
    "non_negative_number"
  )
  diagnoseRange(
    diagnostics,
    "flee.maxSpeedBonus",
    preset.flee.maxSpeedBonus,
    0,
    1,
    "probability"
  )
  diagnoseRange(
    diagnostics,
    "flee.attemptBonusPerTry",
    preset.flee.attemptBonusPerTry,
    0,
    1,
    "probability"
  )
  diagnoseRange(
    diagnostics,
    "flee.maxChance",
    preset.flee.maxChance,
    0,
    1,
    "probability"
  )
  diagnoseOrder(
    diagnostics,
    "flee.chance",
    "flee.baseChance",
    preset.flee.baseChance,
    "flee.maxChance",
    preset.flee.maxChance
  )

  diagnoseNonNegativeInteger(
    diagnostics,
    "effect.defaultBuffTurns",
    preset.effect.defaultBuffTurns
  )
  diagnoseNonNegativeInteger(
    diagnostics,
    "effect.defaultDebuffTurns",
    preset.effect.defaultDebuffTurns
  )
  diagnoseNonNegativeInteger(
    diagnostics,
    "effect.defaultEffectTurns",
    preset.effect.defaultEffectTurns
  )

  const conversionNumbers = {
    attackBase: preset.statusConversion.attackBase,
    attackPerStrength: preset.statusConversion.attackPerStrength,
    defenseBase: preset.statusConversion.defenseBase,
    defensePerVitality: preset.statusConversion.defensePerVitality,
    speedBase: preset.statusConversion.speedBase,
    speedPerAgility: preset.statusConversion.speedPerAgility,
    maxHpBase: preset.statusConversion.maxHpBase,
    maxHpPerVitality: preset.statusConversion.maxHpPerVitality,
    maxMpBase: preset.statusConversion.maxMpBase,
    maxMpPerWisdom: preset.statusConversion.maxMpPerWisdom,
  } as const
  for (const [key, value] of Object.entries(conversionNumbers)) {
    diagnoseFinite(diagnostics, `statusConversion.${key}`, value)
  }

  diagnoseNonNegativeInteger(
    diagnostics,
    "levelUp.pointsPerLevelUp",
    preset.levelUp.pointsPerLevelUp
  )

  diagnoseFinite(
    diagnostics,
    "conversation.affinity.minimum",
    preset.conversation.affinity.minimum
  )
  diagnoseFinite(
    diagnostics,
    "conversation.affinity.maximum",
    preset.conversation.affinity.maximum
  )
  diagnoseFinite(
    diagnostics,
    "conversation.dialogueAffinityBonus",
    preset.conversation.dialogueAffinityBonus
  )
  diagnoseOrder(
    diagnostics,
    "conversation.affinity",
    "conversation.affinity.minimum",
    preset.conversation.affinity.minimum,
    "conversation.affinity.maximum",
    preset.conversation.affinity.maximum
  )
  if (
    Number.isFinite(preset.conversation.affinity.minimum) &&
    Number.isFinite(preset.conversation.affinity.maximum) &&
    preset.conversation.affinity.minimum <= preset.conversation.affinity.maximum
  ) {
    try {
      new WizConversationAffinitySystem(preset.conversation.affinity)
    } catch (error) {
      if (!(error instanceof WizValueValidationError)) throw error
      diagnostics.push({
        code: "invalid_affinity_definition",
        path: `conversation.affinity.${error.path}`,
        message: error.message,
      })
    }
  }

  diagnoseRange(
    diagnostics,
    "exploration.monsterEncounterBase",
    preset.exploration.monsterEncounterBase,
    0,
    100,
    "percentage"
  )
  diagnoseRange(
    diagnostics,
    "exploration.eventBase",
    preset.exploration.eventBase,
    0,
    100,
    "percentage"
  )
  diagnoseRange(
    diagnostics,
    "exploration.eventMin",
    preset.exploration.eventMin,
    0,
    100,
    "percentage"
  )
  diagnoseRange(
    diagnostics,
    "exploration.eventMax",
    preset.exploration.eventMax,
    0,
    100,
    "percentage"
  )
  diagnoseFinite(
    diagnostics,
    "exploration.eventWeatherCoefficient",
    preset.exploration.eventWeatherCoefficient
  )
  diagnoseOrder(
    diagnostics,
    "exploration.event",
    "exploration.eventMin",
    preset.exploration.eventMin,
    "exploration.eventMax",
    preset.exploration.eventMax
  )

  for (const season of SEASONS) {
    const effect = preset.time.seasonEffects[season]
    diagnoseFinite(
      diagnostics,
      `time.seasonEffects.${season}.gatheringBonus`,
      effect.gatheringBonus
    )
    diagnoseRange(
      diagnostics,
      `time.seasonEffects.${season}.hungerModifier`,
      effect.hungerModifier,
      0,
      undefined,
      "non_negative_number"
    )
  }

  for (const timeOfDay of TIMES_OF_DAY) {
    diagnoseRange(
      diagnostics,
      `time.timeEffects.${timeOfDay}.monsterEncounterRate`,
      preset.time.timeEffects[timeOfDay].monsterEncounterRate,
      0,
      undefined,
      "non_negative_number"
    )
  }

  for (const weather of WEATHERS) {
    const effect = preset.time.weatherEffects[weather]
    diagnoseFinite(
      diagnostics,
      `time.weatherEffects.${weather}.gatheringBonus`,
      effect.gatheringBonus
    )
    diagnoseFinite(
      diagnostics,
      `time.weatherEffects.${weather}.explorationBonus`,
      effect.explorationBonus
    )
    diagnoseFinite(
      diagnostics,
      `time.weatherEffects.${weather}.combatBonus`,
      effect.combatBonus
    )
    diagnoseRange(
      diagnostics,
      `time.weatherEffects.${weather}.hungerModifier`,
      effect.hungerModifier,
      0,
      undefined,
      "non_negative_number"
    )
  }

  for (const season of SEASONS) {
    const weights = preset.time.weatherWeights[season]
    let hasInvalidWeight = false
    for (const [index, entry] of weights.entries()) {
      const previousCount = diagnostics.length
      diagnoseRange(
        diagnostics,
        `time.weatherWeights.${season}[${index}].weight`,
        entry.weight,
        0,
        undefined,
        "non_negative_number"
      )
      hasInvalidWeight ||= diagnostics.length !== previousCount
    }
    if (!hasInvalidWeight) {
      const total = weights.reduce((sum, entry) => sum + entry.weight, 0)
      if (total <= 0) {
        diagnostics.push({
          code: "non_positive_weight_total",
          path: `time.weatherWeights.${season}`,
          total,
          message: `time.weatherWeights.${season} must contain a positive total weight; received ${total}`,
        })
      }
    }
  }

  return freezeDiagnostics(diagnostics)
}
