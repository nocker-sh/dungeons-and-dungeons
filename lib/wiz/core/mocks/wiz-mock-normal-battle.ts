import { WizEngineBattleEncounter } from "@/lib/wiz/core/engine/battle/phases/encounter"
import { wizMockMixedEnemyParty } from "@/lib/wiz/core/mocks/wiz-mock-mixed-enemy-party"
import { wizMockFullParty } from "@/lib/wiz/core/mocks/wiz-mock-full-party"

export const wizMockNormalBattle = () =>
  WizEngineBattleEncounter.create({
    id: "battle-normal",
    party: wizMockFullParty(),
    enemies: wizMockMixedEnemyParty(),
  })
