import { WizBattleCharacter } from "@/lib/wiz/core/engine/battle/actors/character"
import { WizEffectSet } from "@/lib/wiz/core/domain/values/effect-set"
import { wizMockHealerStatus } from "@/lib/wiz/core/mocks/wiz-mock-healer-status"

export const wizMockHealer = () =>
  new WizBattleCharacter({
    id: "healer-1",
    name: "Healer",
    custom: {},
    status: wizMockHealerStatus(),
    effects: WizEffectSet.create(),
  })
