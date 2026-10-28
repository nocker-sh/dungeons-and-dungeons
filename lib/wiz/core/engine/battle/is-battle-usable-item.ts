import { WizItem } from "@/lib/wiz/core/domain/values/item"
import type { WizItemEffectDefinition } from "@/lib/wiz/core/types/item-effect"
import type { WizBattleItem } from "@/lib/wiz/core/engine/battle/item"
import { isBattleUsableEffect } from "@/lib/wiz/core/engine/battle/is-battle-usable-effect"

export const isBattleUsableItem = <TCustom>(
  item: WizItem<string, WizItemEffectDefinition, TCustom>
): item is WizBattleItem<TCustom> => isBattleUsableEffect(item.effect)
