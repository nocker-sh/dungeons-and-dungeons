import { createBattleItem } from "@/lib/wiz/core/engine/battle/item"

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
