import { getBattleItemTarget } from "@/lib/wiz/core/engine/battle/get-battle-item-target"
import type { ValidationInput } from "@/lib/wiz/core/engine/battle/execution/action-validation"
import { getOpposingSide } from "@/lib/wiz/core/engine/battle/execution/get-opposing-side"
import { validateTargets } from "@/lib/wiz/core/engine/battle/execution/validate-targets"
import { getAbilityTargetSide } from "@/lib/wiz/core/engine/battle/execution/get-ability-target-side"

export function validateBattleAction<TStatus = unknown, TCustom = unknown>(
  input: ValidationInput<TStatus, TCustom>
): boolean {
  const actor =
    input.party.getMemberById(input.action.actorId) ??
    input.enemies.getMonsterById(input.action.actorId)
  if (!actor?.canAct()) return false

  if (input.action.type === "attack") {
    const targetSide = getOpposingSide(input.action.actorId, input.party)
    return validateTargets(input, input.action.targetType, targetSide, false)
  }

  if (input.action.type === "defend") {
    return (
      input.action.targetIds.length === 1 &&
      input.action.targetIds[0] === input.action.actorId
    )
  }

  if (input.action.type === "flee") {
    return (
      input.party.getMemberById(input.action.actorId) !== undefined &&
      input.action.targetIds.length === 0
    )
  }

  if (input.action.type === "ability") {
    const ability = input.action.ability
    const manaCost = ability.costs.mana ?? 0
    if (!actor.hasMp(manaCost) || actor.isSilenced()) return false
    if (!input.authority.actorAbilityIds.includes(input.action.abilityId))
      return false

    const targetSide = getAbilityTargetSide(
      input.action.actorId,
      input.party,
      ability
    )
    return validateTargets(input, ability.effect.target, targetSide, false)
  }

  if (input.action.type === "item") {
    const item = input.action.item
    if (input.party.getMemberById(input.action.actorId) === undefined)
      return false
    if (!input.authority.availableItemIds.includes(input.action.itemId))
      return false

    const target = getBattleItemTarget(item)
    return validateTargets(
      input,
      target.target,
      target.side === "allies" ? "party" : "enemies",
      target.requireDead
    )
  }

  return false
}
