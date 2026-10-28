import { WizEffectSet } from "@/lib/wiz/core/domain/values/effect-set"
import type { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"
import { getBattleEffectModifier } from "@/lib/wiz/core/engine/battle/get-battle-effect-modifier"

/**
 * 基礎stateを変更せず、有効effectだけを汎用attribute setへ畳み込む。
 */
export const deriveEffectiveBattleState = <TCustom>(
  base: WizBattleActorState<TCustom>,
  effects: WizEffectSet
): WizBattleActorState<TCustom> => {
  const modifier = effects.effects.reduce(
    (total, effect) => {
      const current = getBattleEffectModifier(effect)
      return {
        attack: total.attack + (current.attack ?? 0),
        defense: total.defense + (current.defense ?? 0),
        speed: total.speed + (current.speed ?? 0),
      }
    },
    { attack: 0, defense: 0, speed: 0 }
  )

  return base.withAttributes(
    base.attributes
      .withValue(
        "attack",
        Math.max(0, base.attributes.value("attack") + modifier.attack)
      )
      .withValue(
        "defense",
        Math.max(0, base.attributes.value("defense") + modifier.defense)
      )
      .withValue(
        "speed",
        Math.max(0, base.attributes.value("speed") + modifier.speed)
      )
  )
}
