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
