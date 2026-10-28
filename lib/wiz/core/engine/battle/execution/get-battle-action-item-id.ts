import { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"

export function getBattleActionItemId(
  action: WizEngineBattleTurnAction
): string | undefined {
  if (action.type !== "item") return undefined
  return action.itemId ?? undefined
}
