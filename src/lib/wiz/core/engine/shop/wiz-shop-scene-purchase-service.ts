import type { WizEnginePurchase } from "@/lib/wiz/core/engine/shop/wiz-purchase"
import type { WizStandardInventoryService } from "@/lib/wiz/core/rpg/standard-inventory"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export type WizEngineShopPurchaseRejection =
  | {
      readonly type: "invalid_price"
      readonly price: number
    }
  | {
      readonly type: "insufficient_gold"
      readonly required: number
      readonly available: number
      readonly shortfall: number
    }

export type WizEngineShopPurchaseResult =
  | {
      readonly status: "completed"
      readonly vault: WizVaultValue
      readonly purchase: WizEnginePurchase
    }
  | {
      readonly status: "rejected"
      readonly vault: WizVaultValue
      readonly purchase: WizEnginePurchase
      readonly rejection: WizEngineShopPurchaseRejection
    }

export class WizEngineShopPurchaseService {
  private readonly inventoryService: WizStandardInventoryService

  constructor(inventoryService: WizStandardInventoryService) {
    this.inventoryService = inventoryService
    Object.freeze(this)
  }

  canAfford(vault: WizVaultValue, price: number): boolean {
    return vault.player.canAfford(price)
  }

  execute(vault: WizVaultValue, purchase: WizEnginePurchase): WizEngineShopPurchaseResult {
    if (!Number.isFinite(purchase.price) || purchase.price < 0) {
      return Object.freeze({
        status: "rejected",
        vault,
        purchase,
        rejection: Object.freeze({
          type: "invalid_price",
          price: purchase.price,
        }),
      })
    }

    if (!this.canAfford(vault, purchase.price)) {
      const available = vault.player.gold
      return Object.freeze({
        status: "rejected",
        vault,
        purchase,
        rejection: Object.freeze({
          type: "insufficient_gold",
          required: purchase.price,
          available,
          shortfall: purchase.price - available,
        }),
      })
    }

    const newVault = vault
      .updatePlayer((p) => p.spendGold(purchase.price))
      .updateInventory((inventory) =>
        this.inventoryService.add(inventory, purchase.type, purchase.id),
      )

    return Object.freeze({
      status: "completed",
      vault: newVault,
      purchase,
    })
  }
}
