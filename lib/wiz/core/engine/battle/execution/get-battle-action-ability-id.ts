import { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"

export function getBattleActionAbilityId(
  action: WizEngineBattleTurnAction
): string | undefined {
  if (action.type !== "ability") return undefined
  return action.abilityId ?? undefined
}
