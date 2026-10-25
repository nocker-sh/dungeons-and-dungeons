import { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import { WizEffectSet } from "@/lib/wiz/core/domain/values/effect-set"
import {
  wizMockDragonStatus,
  wizMockGoblinStatus,
  wizMockOrcStatus,
} from "@/lib/wiz/core/mocks/mock-status"

export const wizMockGoblin = (index = 1) =>
  new WizBattleMonster({
    id: `goblin-${index}`,
    name: `Goblin ${index}`,
    custom: {},
    status: wizMockGoblinStatus(),
    effects: WizEffectSet.create(),
    groupId: "goblin-group",
  })

export const wizMockOrc = (index = 1) =>
  new WizBattleMonster({
    id: `orc-${index}`,
    name: `Orc ${index}`,
    custom: {},
    status: wizMockOrcStatus(),
    effects: WizEffectSet.create(),
    groupId: "orc-group",
  })

export const wizMockDragon = () =>
  new WizBattleMonster({
    id: "dragon-1",
    name: "Dragon",
    custom: {},
    status: wizMockDragonStatus(),
    effects: WizEffectSet.create(),
    groupId: "dragon-group",
  })
