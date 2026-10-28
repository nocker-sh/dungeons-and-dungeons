import { createBattleAbility } from "@/lib/wiz/core/engine/battle/ability"

export const wizMockPoisonAbility = () =>
  createBattleAbility({
    id: "ability-poison",
    name: "Poison",
    description: "Poison single target",
    tags: [],
    costs: { mana: 5 },
    effect: {
      type: "effect",
      side: "opponents",
      target: "single",
      element: "dark",
      power: 0,
      effectId: "poison",
    },
    custom: {},
  })
