import type { WizEngineBattleContentResolver } from "@/lib/wiz/core/engine/battle/content"
import { getBattleItemTarget } from "@/lib/wiz/core/engine/battle/get-battle-item-target"
import { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"
import type { WizEngineBattleResolvedAction } from "@/lib/wiz/core/engine/battle/execution/action-validation"
import { getBattleActionAbilityId } from "@/lib/wiz/core/engine/battle/execution/get-battle-action-ability-id"
import { getBattleActionItemId } from "@/lib/wiz/core/engine/battle/execution/get-battle-action-item-id"

/**
 * ID command を content の canonical 定義へ解決する純粋関数。
 *
 * 効果定義は action に保持せず、content resolver から取得する。
 */
export function resolveCanonicalBattleAction(
  action: WizEngineBattleTurnAction,
  content?: WizEngineBattleContentResolver
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
