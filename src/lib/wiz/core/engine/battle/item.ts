import { zWizContentConsumableEffect } from "@/lib/wiz/core/definition/item/consumable-effect"
import { type WizContentItem, zWizContentItem } from "@/lib/wiz/core/definition/item/item"
import { WizItem, WizItemWithEffect } from "@/lib/wiz/core/domain/values/item"
import type { WizBattleAttributeModifier } from "@/lib/wiz/core/engine/battle/effects"
import type { WizItemEffectDefinition } from "@/lib/wiz/core/types/item-effect"

export type WizBattleItemMetadata = Readonly<{
  itemType: WizContentItem["itemType"]
  price: number
  sellPrice: number
}>

export type WizBattleItemEffect = Extract<
  WizItemEffectDefinition,
  {
    readonly type: "heal" | "restore_mp" | "revive" | "cure" | "buff" | "damage"
  }
>

export type WizBattleItem<TCustom = unknown> = WizItemWithEffect<
  string,
  WizBattleItemEffect,
  TCustom
>

const battleUsableEffectTypes: readonly WizBattleItemEffect["type"][] = Object.freeze([
  "heal",
  "restore_mp",
  "revive",
  "cure",
  "buff",
  "damage",
])

const supportedBuffStats = Object.freeze(["attack", "defense", "speed"] as const)

export const isBattleUsableEffect = (
  effect: WizItemEffectDefinition | undefined,
): effect is WizBattleItemEffect =>
  effect !== undefined &&
  battleUsableEffectTypes.includes(effect.type as WizBattleItemEffect["type"]) &&
  (effect.type !== "buff" ||
    supportedBuffStats.includes(effect.stat as (typeof supportedBuffStats)[number]))

export const isBattleUsableItemDefinition = (
  item: WizContentItem,
): item is WizContentItem & Readonly<{ effect: WizBattleItemEffect }> =>
  isBattleUsableEffect(item.effect)

export const isBattleUsableItem = <TCustom>(
  item: WizItem<string, WizItemEffectDefinition, TCustom>,
): item is WizBattleItem<TCustom> => isBattleUsableEffect(item.effect)

/** 通常Item contentをbattleで共有するためのcompile境界。 */
export const createBattleItem = (input: unknown): WizBattleItem => {
  if (input instanceof WizItem) {
    WizItem.require(input, "Battle item")
    const effect = zWizContentConsumableEffect.parse(input.effect)
    if (!isBattleUsableEffect(effect)) {
      throw new TypeError(`Item "${input.id}" does not define a standard battle effect`)
    }
    return WizItem.define<string, WizBattleItemEffect, unknown>({
      ...input.toProperties(),
      effect,
    })
  }

  const item = zWizContentItem.parse(input)
  if (!isBattleUsableItemDefinition(item)) {
    throw new TypeError(`Item "${item.id}" does not define a standard battle effect`)
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

export const getBattleItemTarget = (
  item: WizBattleItem,
): Readonly<{
  side: "allies" | "opponents"
  target: "single"
  requireDead: boolean
}> => {
  const effect = item.effect
  if (effect.type === "damage") {
    return Object.freeze({ side: "opponents", target: "single", requireDead: false })
  }
  return Object.freeze({
    side: "allies",
    target: "single",
    requireDead: effect.type === "revive",
  })
}

export const getBattleItemBuff = (
  item: WizBattleItem,
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

export const getBattleItemReviveRatio = (item: WizBattleItem): number | undefined =>
  item.effect.type === "revive" ? (item.effect.value ?? 25) / 100 : undefined
