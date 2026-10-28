import { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"

export const wizMockMageStatus = () =>
  WizBattleActorState.create({
    attributes: { attack: 8, defense: 5, speed: 10 },
    resources: {
      health: { current: 60, maximum: 60 },
      mana: { current: 80, maximum: 80 },
    },
    custom: {},
  })
