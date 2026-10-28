import type { WizItemEffectDefinition } from "@/lib/wiz/core/types/item-effect"
import type { WizBattleItemEffect } from "@/lib/wiz/core/engine/battle/item"

export const battleUsableEffectTypes: readonly WizBattleItemEffect["type"][] =
  Object.freeze(["heal", "restore_mp", "revive", "cure", "buff", "damage"])

export const supportedBuffStats = Object.freeze([
  "attack",
  "defense",
  "speed",
] as const)

export const isBattleUsableEffect = (
  effect: WizItemEffectDefinition | undefined
): effect is WizBattleItemEffect =>
  effect !== undefined &&
  battleUsableEffectTypes.includes(
    effect.type as WizBattleItemEffect["type"]
  ) &&
  (effect.type !== "buff" ||
    supportedBuffStats.includes(
      effect.stat as (typeof supportedBuffStats)[number]
    ))
