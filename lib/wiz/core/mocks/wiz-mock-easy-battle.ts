import { WizEngineBattleEncounter } from "@/lib/wiz/core/engine/battle/phases/encounter"
import { wizMockWeakEnemyParty } from "@/lib/wiz/core/mocks/wiz-mock-weak-enemy-party"
import { wizMockSoloParty } from "@/lib/wiz/core/mocks/wiz-mock-solo-party"

export const wizMockEasyBattle = () =>
  WizEngineBattleEncounter.create({
    id: "battle-easy",
    party: wizMockSoloParty(),
    enemies: wizMockWeakEnemyParty(),
  })
