import { WizBattleCharacter } from "@/lib/wiz/core/engine/battle/actors/character"
import { WizEffectSet } from "@/lib/wiz/core/domain/values/effect-set"
import { wizMockMageStatus } from "@/lib/wiz/core/mocks/wiz-mock-mage-status"

export const wizMockMage = () =>
  new WizBattleCharacter({
    id: "mage-1",
    name: "Mage",
    custom: {},
    status: wizMockMageStatus(),
    effects: WizEffectSet.create(),
  })
