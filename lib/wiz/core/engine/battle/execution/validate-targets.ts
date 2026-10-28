import type { WizBattleAbilityTarget } from "@/lib/wiz/core/engine/battle/ability"
import type {
  ValidationInput,
  TargetSide,
} from "@/lib/wiz/core/engine/battle/execution/action-validation"
import { getEligibleTargetIds } from "@/lib/wiz/core/engine/battle/execution/get-eligible-target-ids"
import { sameIdSet } from "@/lib/wiz/core/engine/battle/execution/same-id-set"

export function validateTargets<TStatus, TCustom>(
  input: ValidationInput<TStatus, TCustom>,
  targetType: WizBattleAbilityTarget,
  targetSide: TargetSide,
  requireDead: boolean
): boolean {
  const eligibleIds = getEligibleTargetIds(
    input.party,
    input.enemies,
    targetSide,
    requireDead
  )
  const targetIds = input.action.targetIds

  if (targetIds.length === 0) return false
  if (new Set(targetIds).size !== targetIds.length) return false
  if (!targetIds.every((targetId) => eligibleIds.includes(targetId)))
    return false

  if (targetType === "self") {
    return targetIds.length === 1 && targetIds[0] === input.action.actorId
  }

  if (targetType === "single") {
    return targetIds.length === 1
  }

  if (targetType === "all") {
    return sameIdSet(targetIds, eligibleIds)
  }

  return targetIds.length > 0
}
