import { createBattleItem } from "@/lib/wiz/core/engine/battle/create-battle-item"

export const wizMockEther = () =>
  createBattleItem({
    id: "item-ether",
    name: "Ether",
    description: "Restores mana.",
    itemType: "consumable",
    price: 80,
    sellPrice: 40,
    effect: { type: "restore_mp", value: 30 },
  })
