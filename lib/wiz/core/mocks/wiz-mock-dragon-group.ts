import { WizBattleMonsterGroup } from "@/lib/wiz/core/engine/battle/actors/monster-group"
import { wizMockDragon } from "@/lib/wiz/core/mocks/wiz-mock-dragon"

export const wizMockDragonGroup = () =>
  new WizBattleMonsterGroup({
    id: "dragon-group",
    name: "Dragon",
    members: [wizMockDragon()],
  })
