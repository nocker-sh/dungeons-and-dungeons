import type { WizBattleItem } from "@/lib/wiz/core/engine/battle/item"

export const getBattleItemReviveRatio = (
  item: WizBattleItem
): number | undefined =>
  item.effect.type === "revive" ? (item.effect.value ?? 25) / 100 : undefined
