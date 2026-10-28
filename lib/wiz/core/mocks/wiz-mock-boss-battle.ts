import { WizEngineBattleEncounter } from "@/lib/wiz/core/engine/battle/phases/encounter"
import { wizMockBossEnemyParty } from "@/lib/wiz/core/mocks/wiz-mock-boss-enemy-party"
import { wizMockFullParty } from "@/lib/wiz/core/mocks/wiz-mock-full-party"

export const wizMockBossBattle = () =>
  WizEngineBattleEncounter.create({
    id: "battle-boss",
    party: wizMockFullParty(),
    enemies: wizMockBossEnemyParty(),
  })
