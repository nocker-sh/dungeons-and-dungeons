import { createBattleItem } from "@/lib/wiz/core/engine/battle/create-battle-item"

export const wizMockHighPotion = () =>
  createBattleItem({
    id: "item-high-potion",
    name: "High Potion",
    description: "Restores more health.",
    itemType: "consumable",
    price: 150,
    sellPrice: 75,
    effect: { type: "heal", value: 150 },
  })
