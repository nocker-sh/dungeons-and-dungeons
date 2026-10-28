import { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import { wizMockDragonGroup } from "@/lib/wiz/core/mocks/wiz-mock-dragon-group"

export const wizMockBossEnemyParty = () =>
  new WizBattleEnemyParty({
    id: "enemy-party-1",
    groups: [wizMockDragonGroup()],
  })
