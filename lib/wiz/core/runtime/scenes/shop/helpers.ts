import { WizEnginePurchase } from "@/lib/wiz/core/engine/shop/wiz-purchase"
import type { WizSceneShopPurchaseConfirmation } from "@/lib/wiz/core/runtime/scenes/shop/state"

export function createPurchaseFromConfirmation(
  confirmation: WizSceneShopPurchaseConfirmation,
): WizEnginePurchase {
  if (confirmation.type === "item") {
    return WizEnginePurchase.fromItem(confirmation.itemId, confirmation.price)
  }

  if (confirmation.type === "weapon") {
    return WizEnginePurchase.fromWeapon(confirmation.weaponId, confirmation.price)
  }

  return WizEnginePurchase.fromArmor(confirmation.armorId, confirmation.price)
}
