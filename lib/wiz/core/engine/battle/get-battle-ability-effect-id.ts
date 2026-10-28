import type { WizBattleAbility } from "@/lib/wiz/core/engine/battle/ability"

export const getBattleAbilityEffectId = (ability: WizBattleAbility): string => {
  if (ability.effect.type !== "effect") {
    throw new TypeError(
      `Battle ability "${ability.id}" does not apply an effect`
    )
  }
  return ability.effect.effectId
}
