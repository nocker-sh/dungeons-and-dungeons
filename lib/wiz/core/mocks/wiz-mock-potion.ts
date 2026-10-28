import { createBattleItem } from "@/lib/wiz/core/engine/battle/create-battle-item"

export const wizMockPotion = () =>
  createBattleItem({
    id: "item-potion",
    name: "Potion",
    description: "Restores health.",
    itemType: "consumable",
    price: 50,
    sellPrice: 25,
    effect: { type: "heal", value: 50 },
  })
