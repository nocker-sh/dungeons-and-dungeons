import { WizStateLevelUp } from "@/lib/wiz/core/runtime/scenes/level-up/state"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export function toLevelUpScene(
  vault: WizVaultValue,
  points: number,
  returnAreaId: string | null = null
): WizStateLevelUp {
  return new WizStateLevelUp({
    type: "level_up",
    availablePoints: points,
    pendingAttributes: {},
    returnAreaId,
    vault,
  })
}
