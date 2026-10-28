import { createBattleAbility } from "@/lib/wiz/core/engine/battle/ability"

export const wizMockFireballAbility = () =>
  createBattleAbility({
    id: "ability-fireball",
    name: "Fireball",
    description: "Fire damage to group",
    tags: [],
    costs: { mana: 10 },
    effect: {
      type: "damage",
      side: "opponents",
      target: "group",
      element: "fire",
      power: 30,
    },
    custom: {},
  })
