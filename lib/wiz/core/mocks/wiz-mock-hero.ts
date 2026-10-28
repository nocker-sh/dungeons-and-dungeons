import { WizBattleCharacter } from "@/lib/wiz/core/engine/battle/actors/character"
import { WizEffectSet } from "@/lib/wiz/core/domain/values/effect-set"
import { wizMockHeroStatus } from "@/lib/wiz/core/mocks/wiz-mock-hero-status"

export const wizMockHero = () =>
  new WizBattleCharacter({
    id: "hero-1",
    name: "Hero",
    custom: {},
    status: wizMockHeroStatus(),
    effects: WizEffectSet.create(),
  })
