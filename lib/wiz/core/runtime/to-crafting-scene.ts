import { WizStateCrafting } from "@/lib/wiz/core/runtime/scenes/crafting/state"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export function toCraftingScene(vault: WizVaultValue): WizStateCrafting {
  return new WizStateCrafting({
    type: "crafting",
    selectedRecipe: null,
    confirmingCraft: false,
    result: { status: "pending" },
    message: null,
    vault,
    availableFacilities: vault.unlockedFacilities,
  })
}
