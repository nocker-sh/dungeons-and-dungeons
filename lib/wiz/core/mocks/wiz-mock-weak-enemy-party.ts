import { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import { wizMockGoblinGroup } from "@/lib/wiz/core/mocks/wiz-mock-goblin-group"

export const wizMockWeakEnemyParty = () =>
  new WizBattleEnemyParty({
    id: "enemy-party-1",
    groups: [wizMockGoblinGroup(2)],
  })
