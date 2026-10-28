import { WizStateVillage } from "@/lib/wiz/core/runtime/scenes/village/state"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export function toVillageScene(vault: WizVaultValue): WizStateVillage {
  return new WizStateVillage({
    type: "village",
    selectedAction: null,
    vault,
  })
}
