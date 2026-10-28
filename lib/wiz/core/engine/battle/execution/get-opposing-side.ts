import type { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import type { TargetSide } from "@/lib/wiz/core/engine/battle/execution/action-validation"

export function getOpposingSide<TStatus>(
  actorId: string,
  party: WizBattleParty<TStatus>
): TargetSide {
  return party.getMemberById(actorId) ? "enemies" : "party"
}
