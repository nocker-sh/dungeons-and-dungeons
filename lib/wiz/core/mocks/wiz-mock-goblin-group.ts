import { WizBattleMonsterGroup } from "@/lib/wiz/core/engine/battle/actors/monster-group"
import { wizMockGoblin } from "@/lib/wiz/core/mocks/wiz-mock-goblin"

export const wizMockGoblinGroup = (count = 3) =>
  new WizBattleMonsterGroup({
    id: "goblin-group",
    name: "Goblin",
    members: Array.from({ length: count }, (_, i) => wizMockGoblin(i + 1)),
  })
