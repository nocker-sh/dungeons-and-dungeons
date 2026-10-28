import { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import { WizEffectSet } from "@/lib/wiz/core/domain/values/effect-set"
import { wizMockDragonStatus } from "@/lib/wiz/core/mocks/wiz-mock-dragon-status"

export const wizMockDragon = () =>
  new WizBattleMonster({
    id: "dragon-1",
    name: "Dragon",
    custom: {},
    status: wizMockDragonStatus(),
    effects: WizEffectSet.create(),
    groupId: "dragon-group",
  })
