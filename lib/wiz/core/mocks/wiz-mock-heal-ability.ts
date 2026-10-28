import { createBattleAbility } from "@/lib/wiz/core/engine/battle/ability"

export const wizMockHealAbility = () =>
  createBattleAbility({
    id: "ability-heal",
    name: "Heal",
    description: "Heal single target",
    tags: [],
    costs: { mana: 8 },
    effect: {
      type: "heal",
      side: "allies",
      target: "single",
      element: "holy",
      power: 40,
    },
    custom: {},
  })
