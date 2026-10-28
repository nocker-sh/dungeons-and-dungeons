import { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"

export const wizMockGoblinStatus = () =>
  WizBattleActorState.create({
    attributes: { attack: 8, defense: 3, speed: 6 },
    resources: {
      health: { current: 30, maximum: 30 },
      mana: { current: 0, maximum: 0 },
    },
    custom: {},
  })
