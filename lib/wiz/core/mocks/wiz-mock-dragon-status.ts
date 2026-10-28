import { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"

export const wizMockDragonStatus = () =>
  WizBattleActorState.create({
    attributes: { attack: 50, defense: 30, speed: 15 },
    resources: {
      health: { current: 500, maximum: 500 },
      mana: { current: 100, maximum: 100 },
    },
    custom: {},
  })
