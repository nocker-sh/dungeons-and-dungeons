import { createBattleAbility } from "@/lib/wiz/core/engine/battle/ability"

export const wizMockBuffAbility = () =>
  createBattleAbility({
    id: "ability-buff",
    name: "Power Up",
    description: "Buff self",
    tags: [],
    costs: { mana: 6 },
    effect: {
      type: "effect",
      side: "allies",
      target: "self",
      element: "physical",
      power: 10,
      effectId: "attackUp",
      modifier: { attack: 10 },
    },
    custom: {},
  })
