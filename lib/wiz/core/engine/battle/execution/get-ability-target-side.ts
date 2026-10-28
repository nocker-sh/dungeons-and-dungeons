import type { WizBattleAbility } from "@/lib/wiz/core/engine/battle/ability"
import type { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import type { TargetSide } from "@/lib/wiz/core/engine/battle/execution/action-validation"
import { getOpposingSide } from "@/lib/wiz/core/engine/battle/execution/get-opposing-side"

export function getAbilityTargetSide<TStatus>(
  actorId: string,
  party: WizBattleParty<TStatus>,
  ability: WizBattleAbility
): TargetSide {
  if (ability.effect.side === "allies") {
    return party.getMemberById(actorId) ? "party" : "enemies"
  }
  return getOpposingSide(actorId, party)
}
