import { WizStateShop } from "@/lib/wiz/core/runtime/scenes/shop/state"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export function toShopScene(
  vault: WizVaultValue,
  shopId: string,
  options?: { buyPriceModifier?: number }
): WizStateShop {
  return new WizStateShop({
    type: "shop",
    shopId,
    buyPriceModifier: options?.buyPriceModifier ?? 1.0,
    pendingPurchase: null,
    message: null,
    conversation: null,
    lastConversation: null,
    vault,
  })
}
