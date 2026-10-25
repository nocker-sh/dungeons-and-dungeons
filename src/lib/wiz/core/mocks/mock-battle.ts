import { WizEngineBattleEncounter } from "@/lib/wiz/core/engine/battle/phases/encounter"
import {
  wizMockBossEnemyParty,
  wizMockMixedEnemyParty,
  wizMockWeakEnemyParty,
} from "@/lib/wiz/core/mocks/mock-enemy-party"
import { wizMockFullParty, wizMockSoloParty } from "@/lib/wiz/core/mocks/mock-party"

export const wizMockEasyBattle = () =>
  WizEngineBattleEncounter.create({
    id: "battle-easy",
    party: wizMockSoloParty(),
    enemies: wizMockWeakEnemyParty(),
  })

export const wizMockNormalBattle = () =>
  WizEngineBattleEncounter.create({
    id: "battle-normal",
    party: wizMockFullParty(),
    enemies: wizMockMixedEnemyParty(),
  })

export const wizMockBossBattle = () =>
  WizEngineBattleEncounter.create({
    id: "battle-boss",
    party: wizMockFullParty(),
    enemies: wizMockBossEnemyParty(),
  })
