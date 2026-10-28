import { zWizContentConsumableEffect } from "@/lib/wiz/core/definition/item/consumable-effect"
import type { WizContentItem } from "@/lib/wiz/core/definition/item/item"
import { zWizContentItem } from "@/lib/wiz/core/definition/item/item"
import { WizItem } from "@/lib/wiz/core/domain/values/item"
import type {
  WizBattleItem,
  WizBattleItemEffect,
} from "@/lib/wiz/core/engine/battle/item"
import { isBattleUsableEffect } from "@/lib/wiz/core/engine/battle/is-battle-usable-effect"
import { isBattleUsableItemDefinition } from "@/lib/wiz/core/engine/battle/is-battle-usable-item-definition"

export type WizBattleItemMetadata = Readonly<{
  itemType: WizContentItem["itemType"]
  price: number
  sellPrice: number
}>

/** 通常Item contentをbattleで共有するためのcompile境界。 */
export const createBattleItem = (input: unknown): WizBattleItem => {
  if (input instanceof WizItem) {
    WizItem.require(input, "Battle item")
    const effect = zWizContentConsumableEffect.parse(input.effect)
    if (!isBattleUsableEffect(effect)) {
      throw new TypeError(
        `Item "${input.id}" does not define a standard battle effect`
      )
    }
    return WizItem.define<string, WizBattleItemEffect, unknown>({
      ...input.toProperties(),
      effect,
    })
  }

  const item = zWizContentItem.parse(input)
  if (!isBattleUsableItemDefinition(item)) {
    throw new TypeError(
      `Item "${item.id}" does not define a standard battle effect`
    )
  }
  return WizItem.define<string, WizBattleItemEffect, WizBattleItemMetadata>({
    id: item.id,
    name: item.name,
    description: item.description,
    tags: [item.itemType],
    effect: item.effect,
    custom: {
      itemType: item.itemType,
      price: item.price,
      sellPrice: item.sellPrice,
    },
  })
}
