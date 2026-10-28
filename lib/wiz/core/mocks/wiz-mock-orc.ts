import { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import { WizEffectSet } from "@/lib/wiz/core/domain/values/effect-set"
import { wizMockOrcStatus } from "@/lib/wiz/core/mocks/wiz-mock-orc-status"

export const wizMockOrc = (index = 1) =>
  new WizBattleMonster({
    id: `orc-${index}`,
    name: `Orc ${index}`,
    custom: {},
    status: wizMockOrcStatus(),
    effects: WizEffectSet.create(),
    groupId: "orc-group",
  })
