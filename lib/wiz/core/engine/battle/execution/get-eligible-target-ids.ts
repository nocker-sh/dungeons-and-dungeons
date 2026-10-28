import type { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import type { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import type { TargetSide } from "@/lib/wiz/core/engine/battle/execution/action-validation"

export function getEligibleTargetIds<TStatus, TCustom>(
  party: WizBattleParty<TStatus>,
  enemies: WizBattleEnemyParty<TStatus, TCustom>,
  targetSide: TargetSide,
  requireDead: boolean
): readonly string[] {
  if (targetSide === "party") {
    const members = requireDead
      ? party.getDeadMembers()
      : party.getInBattleMembers()
    return members.map((member) => member.id)
  }

  const monsters = requireDead
    ? enemies.getDeadMonsters()
    : enemies.getAllAliveMonsters()
  return monsters.map((monster) => monster.id)
}
