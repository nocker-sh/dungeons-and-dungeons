import { createBattleAbility } from "@/lib/wiz/core/engine/battle/ability"

export const wizMockIceStormAbility = () =>
  createBattleAbility({
    id: "ability-ice-storm",
    name: "Ice Storm",
    description: "Ice damage to all",
    tags: [],
    costs: { mana: 20 },
    effect: {
      type: "damage",
      side: "opponents",
      target: "all",
      element: "ice",
      power: 25,
    },
    custom: {},
  })
