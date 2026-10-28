import { WizBattleMonsterGroup } from "@/lib/wiz/core/engine/battle/actors/monster-group"
import { wizMockOrc } from "@/lib/wiz/core/mocks/wiz-mock-orc"

export const wizMockOrcGroup = (count = 2) =>
  new WizBattleMonsterGroup({
    id: "orc-group",
    name: "Orc",
    members: Array.from({ length: count }, (_, i) => wizMockOrc(i + 1)),
  })
