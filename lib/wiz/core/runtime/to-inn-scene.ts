import { WizStateInn } from "@/lib/wiz/core/runtime/scenes/inn/state"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export function toInnScene(vault: WizVaultValue): WizStateInn {
  return new WizStateInn({
    type: "inn",
    selectedPlan: null,
    confirmingStay: false,
    message: null,
    vault,
  })
}
