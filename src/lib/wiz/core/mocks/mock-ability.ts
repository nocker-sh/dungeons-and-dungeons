import { createBattleAbility } from "@/lib/wiz/core/engine/battle/ability"

export const wizMockFireballAbility = () =>
  createBattleAbility({
    id: "ability-fireball",
    name: "Fireball",
    description: "Fire damage to group",
    tags: [],
    costs: { mana: 10 },
    effect: { type: "damage", side: "opponents", target: "group", element: "fire", power: 30 },
    custom: {},
  })

export const wizMockHealAbility = () =>
  createBattleAbility({
    id: "ability-heal",
    name: "Heal",
    description: "Heal single target",
    tags: [],
    costs: { mana: 8 },
    effect: { type: "heal", side: "allies", target: "single", element: "holy", power: 40 },
    custom: {},
  })

export const wizMockIceStormAbility = () =>
  createBattleAbility({
    id: "ability-ice-storm",
    name: "Ice Storm",
    description: "Ice damage to all",
    tags: [],
    costs: { mana: 20 },
    effect: { type: "damage", side: "opponents", target: "all", element: "ice", power: 25 },
    custom: {},
  })

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
