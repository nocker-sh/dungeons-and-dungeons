import { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"

export const wizMockHeroStatus = () =>
  WizBattleActorState.create({
    attributes: { attack: 15, defense: 10, speed: 12 },
    resources: {
      health: { current: 100, maximum: 100 },
      mana: { current: 30, maximum: 30 },
    },
    custom: {},
  })

export const wizMockMageStatus = () =>
  WizBattleActorState.create({
    attributes: { attack: 8, defense: 5, speed: 10 },
    resources: {
      health: { current: 60, maximum: 60 },
      mana: { current: 80, maximum: 80 },
    },
    custom: {},
  })

export const wizMockHealerStatus = () =>
  WizBattleActorState.create({
    attributes: { attack: 6, defense: 8, speed: 9 },
    resources: {
      health: { current: 70, maximum: 70 },
      mana: { current: 60, maximum: 60 },
    },
    custom: {},
  })

export const wizMockGoblinStatus = () =>
  WizBattleActorState.create({
    attributes: { attack: 8, defense: 3, speed: 6 },
    resources: {
      health: { current: 30, maximum: 30 },
      mana: { current: 0, maximum: 0 },
    },
    custom: {},
  })

export const wizMockOrcStatus = () =>
  WizBattleActorState.create({
    attributes: { attack: 18, defense: 8, speed: 4 },
    resources: {
      health: { current: 80, maximum: 80 },
      mana: { current: 0, maximum: 0 },
    },
    custom: {},
  })

export const wizMockDragonStatus = () =>
  WizBattleActorState.create({
    attributes: { attack: 50, defense: 30, speed: 15 },
    resources: {
      health: { current: 500, maximum: 500 },
      mana: { current: 100, maximum: 100 },
    },
    custom: {},
  })
