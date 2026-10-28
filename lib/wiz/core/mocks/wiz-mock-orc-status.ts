import { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"

export const wizMockOrcStatus = () =>
  WizBattleActorState.create({
    attributes: { attack: 18, defense: 8, speed: 4 },
    resources: {
      health: { current: 80, maximum: 80 },
      mana: { current: 0, maximum: 0 },
    },
    custom: {},
  })
