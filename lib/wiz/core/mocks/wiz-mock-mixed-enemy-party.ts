import { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import { wizMockGoblinGroup } from "@/lib/wiz/core/mocks/wiz-mock-goblin-group"
import { wizMockOrcGroup } from "@/lib/wiz/core/mocks/wiz-mock-orc-group"

export const wizMockMixedEnemyParty = () =>
  new WizBattleEnemyParty({
    id: "enemy-party-1",
    groups: [wizMockGoblinGroup(3), wizMockOrcGroup(1)],
  })
