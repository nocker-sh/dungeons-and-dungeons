import { createBattleItem } from "@/lib/wiz/core/engine/battle/create-battle-item"

export const wizMockAntidote = () =>
  createBattleItem({
    id: "item-antidote",
    name: "Antidote",
    description: "Cures poison.",
    itemType: "consumable",
    price: 25,
    sellPrice: 12,
    effect: { type: "cure", effectId: "poison" },
  })
