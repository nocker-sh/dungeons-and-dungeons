import { createBattleItem } from "@/lib/wiz/core/engine/battle/create-battle-item"

export const wizMockRevive = () =>
  createBattleItem({
    id: "item-revive",
    name: "Phoenix Down",
    description: "Revives an ally.",
    itemType: "consumable",
    price: 300,
    sellPrice: 150,
    effect: { type: "revive", value: 50 },
  })
