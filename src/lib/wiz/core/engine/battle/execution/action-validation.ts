import type { WizBattleAbility, WizBattleAbilityTarget } from "@/lib/wiz/core/engine/battle/ability"
import type { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import type { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import type { WizEngineBattleContentResolver } from "@/lib/wiz/core/engine/battle/content"
import { getBattleItemTarget, type WizBattleItem } from "@/lib/wiz/core/engine/battle/item"
import { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"

export type WizEngineBattleActionAuthority = {
  readonly actorAbilityIds: readonly string[]
  readonly availableItemIds: readonly string[]
}

type TargetSide = "party" | "enemies"

type ResolvedActionBase = {
  readonly id: string
  readonly actorId: string
  readonly targetIds: readonly string[]
  readonly targetType: WizBattleAbilityTarget
}

export type WizEngineBattleResolvedAction =
  | (ResolvedActionBase & {
      readonly type: "attack"
    })
  | (ResolvedActionBase & {
      readonly type: "defend"
    })
  | (ResolvedActionBase & {
      readonly type: "flee"
    })
  | (ResolvedActionBase & {
      readonly type: "ability"
      readonly abilityId: string
      readonly ability: WizBattleAbility
    })
  | (ResolvedActionBase & {
      readonly type: "item"
      readonly itemId: string
      readonly item: WizBattleItem
    })

type ValidationInput<TStatus = unknown, TCustom = unknown> = {
  readonly action: WizEngineBattleResolvedAction
  readonly party: WizBattleParty<TStatus>
  readonly enemies: WizBattleEnemyParty<TStatus, TCustom>
  readonly authority: WizEngineBattleActionAuthority
}

export function getBattleActionAbilityId(action: WizEngineBattleTurnAction): string | undefined {
  if (action.type !== "ability") return undefined
  return action.abilityId ?? undefined
}

export function getBattleActionItemId(action: WizEngineBattleTurnAction): string | undefined {
  if (action.type !== "item") return undefined
  return action.itemId ?? undefined
}

/**
 * ID command を content の canonical 定義へ解決する純粋関数。
 *
 * 効果定義は action に保持せず、content resolver から取得する。
 */
export function resolveCanonicalBattleAction(
  action: WizEngineBattleTurnAction,
  content?: WizEngineBattleContentResolver,
): WizEngineBattleResolvedAction | undefined {
  if (!Array.isArray(action.targetIds)) return undefined
  const targetIds = Object.freeze([...action.targetIds])

  if (action.type === "attack") {
    return Object.freeze({
      id: action.id,
      type: action.type,
      actorId: action.actorId,
      targetIds,
      targetType: targetIds.length === 1 ? "single" : "group",
    })
  }

  if (action.type === "defend" || action.type === "flee") {
    return Object.freeze({
      id: action.id,
      type: action.type,
      actorId: action.actorId,
      targetIds,
      targetType: "self",
    })
  }

  if (action.type === "ability") {
    const abilityId = getBattleActionAbilityId(action)
    if (!abilityId) return undefined
    const ability = content?.resolveAbility(abilityId)
    if (!ability || ability.id !== abilityId) return undefined
    return Object.freeze({
      id: action.id,
      type: action.type,
      actorId: action.actorId,
      targetIds,
      targetType: ability.effect.target,
      abilityId,
      ability,
    })
  }

  if (action.type === "item") {
    const itemId = getBattleActionItemId(action)
    if (!itemId) return undefined
    const item = content?.resolveItem(itemId)
    if (!item || item.id !== itemId) return undefined
    const target = getBattleItemTarget(item)
    return Object.freeze({
      id: action.id,
      type: action.type,
      actorId: action.actorId,
      targetIds,
      targetType: target.target,
      itemId,
      item,
    })
  }

  return undefined
}

export function toCanonicalBattleTurnAction(
  action: WizEngineBattleResolvedAction,
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

export function validateBattleAction<TStatus = unknown, TCustom = unknown>(
  input: ValidationInput<TStatus, TCustom>,
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
    return input.action.targetIds.length === 1 && input.action.targetIds[0] === input.action.actorId
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
    if (!input.authority.actorAbilityIds.includes(input.action.abilityId)) return false

    const targetSide = getAbilityTargetSide(input.action.actorId, input.party, ability)
    return validateTargets(input, ability.effect.target, targetSide, false)
  }

  if (input.action.type === "item") {
    const item = input.action.item
    if (input.party.getMemberById(input.action.actorId) === undefined) return false
    if (!input.authority.availableItemIds.includes(input.action.itemId)) return false

    const target = getBattleItemTarget(item)
    return validateTargets(
      input,
      target.target,
      target.side === "allies" ? "party" : "enemies",
      target.requireDead,
    )
  }

  return false
}

function getOpposingSide<TStatus>(actorId: string, party: WizBattleParty<TStatus>): TargetSide {
  return party.getMemberById(actorId) ? "enemies" : "party"
}

function getAbilityTargetSide<TStatus>(
  actorId: string,
  party: WizBattleParty<TStatus>,
  ability: WizBattleAbility,
): TargetSide {
  if (ability.effect.side === "allies") {
    return party.getMemberById(actorId) ? "party" : "enemies"
  }
  return getOpposingSide(actorId, party)
}

function validateTargets<TStatus, TCustom>(
  input: ValidationInput<TStatus, TCustom>,
  targetType: WizBattleAbilityTarget,
  targetSide: TargetSide,
  requireDead: boolean,
): boolean {
  const eligibleIds = getEligibleTargetIds(input.party, input.enemies, targetSide, requireDead)
  const targetIds = input.action.targetIds

  if (targetIds.length === 0) return false
  if (new Set(targetIds).size !== targetIds.length) return false
  if (!targetIds.every((targetId) => eligibleIds.includes(targetId))) return false

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

function getEligibleTargetIds<TStatus, TCustom>(
  party: WizBattleParty<TStatus>,
  enemies: WizBattleEnemyParty<TStatus, TCustom>,
  targetSide: TargetSide,
  requireDead: boolean,
): readonly string[] {
  if (targetSide === "party") {
    const members = requireDead ? party.getDeadMembers() : party.getInBattleMembers()
    return members.map((member) => member.id)
  }

  const monsters = requireDead ? enemies.getDeadMonsters() : enemies.getAllAliveMonsters()
  return monsters.map((monster) => monster.id)
}

function sameIdSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((id) => right.includes(id))
}
