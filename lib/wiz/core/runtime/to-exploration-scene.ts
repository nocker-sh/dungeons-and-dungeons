import { WizStateExploration } from "@/lib/wiz/core/runtime/scenes/exploration/states/state"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export function toExplorationScene(
  vault: WizVaultValue,
  areaId: string
): WizStateExploration {
  return new WizStateExploration({
    type: "exploration",
    areaId,
    eventProgress: { status: "none" },
    message: null,
    vault,
  })
}
