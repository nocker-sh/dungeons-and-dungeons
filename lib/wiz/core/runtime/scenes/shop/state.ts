import type { WizContentDialogueLine } from "@/lib/wiz/core/definition/npc/dialogue"
import type { WizEngineShopPurchaseRejection } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-purchase-service"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

const objectService = new WizObjectService()

export type WizSceneShopConversation = {
  readonly topicId: string
  readonly lines: readonly WizContentDialogueLine[]
  readonly currentIndex: number
  readonly displayedLines: readonly WizContentDialogueLine[]
}

export type WizSceneShopPurchaseConfirmation =
  | { readonly type: "item"; readonly itemId: string; readonly price: number }
  | {
      readonly type: "weapon"
      readonly weaponId: string
      readonly price: number
    }
  | { readonly type: "armor"; readonly armorId: string; readonly price: number }

export type WizSceneShopProductType = WizSceneShopPurchaseConfirmation["type"]

export type WizSceneShopPurchaseRejection =
  | WizEngineShopPurchaseRejection
  | {
      readonly type: "unknown_product"
      readonly productType: WizSceneShopProductType
      readonly productId: string
    }
  | {
      readonly type: "product_not_sold"
      readonly shopId: string
      readonly productType: WizSceneShopProductType
      readonly productId: string
    }
  | {
      readonly type: "no_pending_purchase"
    }

export type WizSceneShopSaleRejection =
  | {
      readonly type: "unknown_item"
      readonly itemId: string
    }
  | {
      readonly type: "item_not_owned"
      readonly itemId: string
    }
  | {
      readonly type: "invalid_price"
      readonly itemId: string
      readonly price: number
    }

export type WizSceneShopConversationRejection =
  | {
      readonly type: "dialogue_not_found"
      readonly shopId: string
    }
  | {
      readonly type: "topic_not_found"
      readonly shopId: string
      readonly topicId: string
    }
  | {
      readonly type: "topic_has_no_lines"
      readonly shopId: string
      readonly topicId: string
    }
  | {
      readonly type: "no_active_conversation"
    }

type PurchaseMessage = {
  readonly productType: WizSceneShopProductType
  readonly productId: string
  readonly price: number
}

export type WizSceneShopMessage =
  | (PurchaseMessage & {
      readonly type: "purchase_prompt"
    })
  | (PurchaseMessage & {
      readonly type: "purchase_completed"
    })
  | {
      readonly type: "purchase_cancelled"
    }
  | {
      readonly type: "purchase_rejected"
      readonly rejection: WizSceneShopPurchaseRejection
    }
  | {
      readonly type: "sale_completed"
      readonly itemId: string
      readonly price: number
    }
  | {
      readonly type: "sale_rejected"
      readonly rejection: WizSceneShopSaleRejection
    }
  | {
      readonly type: "conversation_ended"
    }
  | {
      readonly type: "conversation_rejected"
      readonly rejection: WizSceneShopConversationRejection
    }

export type WizStateShopDefinition = {
  readonly type: "shop"
  readonly shopId: string
  readonly buyPriceModifier: number
  readonly pendingPurchase: WizSceneShopPurchaseConfirmation | null
  readonly message: WizSceneShopMessage | null
  readonly conversation: WizSceneShopConversation | null
  readonly lastConversation: WizSceneShopConversation | null
  readonly vault: WizVaultValue
}

export class WizStateShop {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "shop" as const
  private readonly properties: WizStateShopDefinition

  constructor(properties: WizStateShopDefinition) {
    this.properties = objectService.ownImmutable(properties)
    WizImmutableValue.freeze(this)
  }

  get vault() {
    return this.properties.vault
  }

  get shopId() {
    return this.properties.shopId
  }

  get buyPriceModifier() {
    return this.properties.buyPriceModifier
  }

  get pendingPurchase() {
    return this.properties.pendingPurchase
  }

  get message() {
    return this.properties.message
  }

  get conversation() {
    return this.properties.conversation
  }

  get lastConversation() {
    return this.properties.lastConversation
  }

  withPendingPurchase(purchase: WizSceneShopPurchaseConfirmation | null) {
    return new WizStateShop({
      ...this.properties,
      pendingPurchase: purchase,
    })
  }

  withMessage(message: WizSceneShopMessage | null) {
    return new WizStateShop({
      ...this.properties,
      message,
    })
  }

  withConversation(conversation: WizSceneShopConversation | null) {
    return new WizStateShop({
      ...this.properties,
      conversation,
    })
  }

  withLastConversation(conversation: WizSceneShopConversation | null) {
    return new WizStateShop({
      ...this.properties,
      lastConversation: conversation,
    })
  }

  withVault(vault: WizVaultValue) {
    return new WizStateShop({
      ...this.properties,
      vault,
    })
  }

  updateVault(fn: (v: WizVaultValue) => WizVaultValue) {
    return new WizStateShop({
      ...this.properties,
      vault: fn(this.properties.vault),
    })
  }
}

Object.freeze(WizStateShop.prototype)
Object.freeze(WizStateShop)
