import { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"

export const wizMockHealerStatus = () =>
  WizBattleActorState.create({
    attributes: { attack: 6, defense: 8, speed: 9 },
    resources: {
      health: { current: 70, maximum: 70 },
      mana: { current: 60, maximum: 60 },
    },
    custom: {},
  })
