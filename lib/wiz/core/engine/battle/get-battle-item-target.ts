import type { WizBattleItem } from "@/lib/wiz/core/engine/battle/item"

export const getBattleItemTarget = (
  item: WizBattleItem
): Readonly<{
  side: "allies" | "opponents"
  target: "single"
  requireDead: boolean
}> => {
  const effect = item.effect
  if (effect.type === "damage") {
    return Object.freeze({
      side: "opponents",
      target: "single",
      requireDead: false,
    })
  }
  return Object.freeze({
    side: "allies",
    target: "single",
    requireDead: effect.type === "revive",
  })
}
