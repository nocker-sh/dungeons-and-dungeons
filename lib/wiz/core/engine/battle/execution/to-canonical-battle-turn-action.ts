import { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"
import type { WizEngineBattleResolvedAction } from "@/lib/wiz/core/engine/battle/execution/action-validation"

export function toCanonicalBattleTurnAction(
  action: WizEngineBattleResolvedAction
): WizEngineBattleTurnAction {
  return WizEngineBattleTurnAction.fromUnknown({
    id: action.id,
    type: action.type,
    actorId: action.actorId,
    targetIds: action.targetIds,
    abilityId: action.type === "ability" ? action.abilityId : null,
    itemId: action.type === "item" ? action.itemId : null,
  })
}
