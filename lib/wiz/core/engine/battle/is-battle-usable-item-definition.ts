import type { WizContentItem } from "@/lib/wiz/core/definition/item/item"
import type { WizBattleItemEffect } from "@/lib/wiz/core/engine/battle/item"
import { isBattleUsableEffect } from "@/lib/wiz/core/engine/battle/is-battle-usable-effect"

export const isBattleUsableItemDefinition = (
  item: WizContentItem
): item is WizContentItem & Readonly<{ effect: WizBattleItemEffect }> =>
  isBattleUsableEffect(item.effect)
