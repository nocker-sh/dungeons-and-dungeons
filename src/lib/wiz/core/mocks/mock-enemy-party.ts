import { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import { WizBattleMonsterGroup } from "@/lib/wiz/core/engine/battle/actors/monster-group"
import { wizMockDragon, wizMockGoblin, wizMockOrc } from "@/lib/wiz/core/mocks/mock-monster"

export const wizMockGoblinGroup = (count = 3) =>
  new WizBattleMonsterGroup({
    id: "goblin-group",
    name: "Goblin",
    members: Array.from({ length: count }, (_, i) => wizMockGoblin(i + 1)),
  })

export const wizMockOrcGroup = (count = 2) =>
  new WizBattleMonsterGroup({
    id: "orc-group",
    name: "Orc",
    members: Array.from({ length: count }, (_, i) => wizMockOrc(i + 1)),
  })

export const wizMockDragonGroup = () =>
  new WizBattleMonsterGroup({
    id: "dragon-group",
    name: "Dragon",
    members: [wizMockDragon()],
  })

export const wizMockWeakEnemyParty = () =>
  new WizBattleEnemyParty({
    id: "enemy-party-1",
    groups: [wizMockGoblinGroup(2)],
  })

export const wizMockMixedEnemyParty = () =>
  new WizBattleEnemyParty({
    id: "enemy-party-1",
    groups: [wizMockGoblinGroup(3), wizMockOrcGroup(1)],
  })

export const wizMockBossEnemyParty = () =>
  new WizBattleEnemyParty({
    id: "enemy-party-1",
    groups: [wizMockDragonGroup()],
  })
