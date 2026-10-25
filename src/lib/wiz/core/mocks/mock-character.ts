import { WizBattleCharacter } from "@/lib/wiz/core/engine/battle/actors/character"
import { WizEffectSet } from "@/lib/wiz/core/domain/values/effect-set"
import {
  wizMockHealerStatus,
  wizMockHeroStatus,
  wizMockMageStatus,
} from "@/lib/wiz/core/mocks/mock-status"

export const wizMockHero = () =>
  new WizBattleCharacter({
    id: "hero-1",
    name: "Hero",
    custom: {},
    status: wizMockHeroStatus(),
    effects: WizEffectSet.create(),
  })

export const wizMockMage = () =>
  new WizBattleCharacter({
    id: "mage-1",
    name: "Mage",
    custom: {},
    status: wizMockMageStatus(),
    effects: WizEffectSet.create(),
  })

export const wizMockHealer = () =>
  new WizBattleCharacter({
    id: "healer-1",
    name: "Healer",
    custom: {},
    status: wizMockHealerStatus(),
    effects: WizEffectSet.create(),
  })
