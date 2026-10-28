import { WizEffect } from "@/lib/wiz/core/domain/values/effect-set"
import type { WizBattleAttributeModifier } from "@/lib/wiz/core/engine/battle/effects"
import { readModifier } from "@/lib/wiz/core/engine/battle/read-modifier"
import { readOwnDataProperty } from "@/lib/wiz/core/engine/battle/read-own-data-property"

export const getBattleEffectModifier = (
  effect: WizEffect
): WizBattleAttributeModifier =>
  readModifier(readOwnDataProperty(effect.payload, "modifier")) ??
  Object.freeze({})
