import type { WizBattleAttributeModifier } from "@/lib/wiz/core/engine/battle/effects"
import type { WizBattleItem } from "@/lib/wiz/core/engine/battle/item"

export const getBattleItemBuff = (
  item: WizBattleItem
):
  | Readonly<{
      effectId: string
      duration: number
      power: number
      modifier: WizBattleAttributeModifier
    }>
  | undefined => {
  const effect = item.effect
  if (effect.type !== "buff") return undefined
  return Object.freeze({
    effectId: `${effect.stat}Up`,
    duration: effect.duration,
    power: effect.value,
    modifier: Object.freeze({ [effect.stat]: effect.value }),
  })
}
