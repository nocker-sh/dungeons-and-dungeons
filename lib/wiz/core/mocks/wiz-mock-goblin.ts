import { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import { WizEffectSet } from "@/lib/wiz/core/domain/values/effect-set"
import { wizMockGoblinStatus } from "@/lib/wiz/core/mocks/wiz-mock-goblin-status"

export const wizMockGoblin = (index = 1) =>
  new WizBattleMonster({
    id: `goblin-${index}`,
    name: `Goblin ${index}`,
    custom: {},
    status: wizMockGoblinStatus(),
    effects: WizEffectSet.create(),
    groupId: "goblin-group",
  })
