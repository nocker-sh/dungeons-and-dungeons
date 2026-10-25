import type { WizEngineShopDialogueService } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-dialogue-service"
import { WizEngineShopPurchaseService } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-purchase-service"
import type { WizAction } from "@/lib/wiz/core/runtime/action"
import {
  getWizRuntimeContentEntry,
  type WizRuntimeContentView,
} from "@/lib/wiz/core/runtime/content-view"
import { WizSceneResultFactory, type WizSceneResult } from "@/lib/wiz/core/runtime/scene-result"
import type { WizSceneShopAction } from "@/lib/wiz/core/runtime/scenes/shop/action"
import { createPurchaseFromConfirmation } from "@/lib/wiz/core/runtime/scenes/shop/helpers"
import type {
  WizSceneShopProductType,
  WizSceneShopPurchaseConfirmation,
  WizStateShop,
} from "@/lib/wiz/core/runtime/scenes/shop/state"
import type { WizState } from "@/lib/wiz/core/runtime/state"

type PurchaseMessageFields = {
  readonly productType: WizSceneShopProductType
  readonly productId: string
  readonly price: number
}

type ProductAvailability =
  | {
      readonly status: "available"
      readonly price: number
    }
  | {
      readonly status: "rejected"
      readonly result: WizSceneResult<WizState>
    }

const toPurchaseMessageFields = (
  purchase: WizSceneShopPurchaseConfirmation,
): PurchaseMessageFields => {
  if (purchase.type === "item") {
    return { productType: "item", productId: purchase.itemId, price: purchase.price }
  }
  if (purchase.type === "weapon") {
    return { productType: "weapon", productId: purchase.weaponId, price: purchase.price }
  }
  return { productType: "armor", productId: purchase.armorId, price: purchase.price }
}

type Dependencies = {
  readonly content: Pick<WizRuntimeContentView, "items" | "weapons" | "armors">
  readonly dialogueService: WizEngineShopDialogueService
  readonly purchaseService: WizEngineShopPurchaseService
}

export class WizSceneShopReducer {
  private readonly content: Pick<WizRuntimeContentView, "items" | "weapons" | "armors">
  private readonly dialogueService: WizEngineShopDialogueService
  private readonly purchaseService: WizEngineShopPurchaseService

  constructor(dependencies: Dependencies) {
    this.content = dependencies.content
    this.dialogueService = dependencies.dialogueService
    this.purchaseService = dependencies.purchaseService
    Object.freeze(this)
  }

  reduce(state: WizState, action: WizAction | WizSceneShopAction): WizSceneResult<WizState> {
    if (state.type !== "shop") return WizSceneResultFactory.accept(state)
    if (
      (action.type === "SELECT_ITEM_TO_BUY" ||
        action.type === "SELECT_WEAPON_TO_BUY" ||
        action.type === "SELECT_ARMOR_TO_BUY" ||
        action.type === "START_SHOP_CONVERSATION") &&
      action.shopId !== state.shopId
    ) {
      return WizSceneResultFactory.reject(state, "SHOP_SCOPE_MISMATCH")
    }

    if (action.type === "SELECT_ITEM_TO_BUY") {
      return this.handleSelectItemToBuy(state, action)
    }

    if (action.type === "SELECT_WEAPON_TO_BUY") {
      return this.handleSelectWeaponToBuy(state, action)
    }

    if (action.type === "SELECT_ARMOR_TO_BUY") {
      return this.handleSelectArmorToBuy(state, action)
    }

    if (action.type === "CONFIRM_PURCHASE") {
      return this.handleConfirmPurchase(state)
    }

    if (action.type === "SELL_ITEM") {
      return this.handleSellItem(state, action)
    }

    if (action.type === "CANCEL_PURCHASE") {
      return WizSceneResultFactory.accept(
        state.withPendingPurchase(null).withMessage({
          type: "purchase_cancelled",
        }),
      )
    }

    if (action.type === "LEAVE_SHOP") {
      const newVault = state.vault.addLog({ key: "LEFT_SHOP" })
      return WizSceneResultFactory.accept(state.withVault(newVault), { type: "GO_TO_VILLAGE" })
    }

    if (action.type === "START_SHOP_CONVERSATION") {
      return this.handleStartShopConversation(state, action)
    }

    if (action.type === "ADVANCE_SHOP_CONVERSATION") {
      return this.handleAdvanceShopConversation(state)
    }

    if (action.type === "END_SHOP_CONVERSATION") {
      if (!state.conversation) {
        return WizSceneResultFactory.reject(
          state.withMessage({
            type: "conversation_rejected",
            rejection: { type: "no_active_conversation" },
          }),
          "SHOP_CONVERSATION_REJECTED",
        )
      }
      return WizSceneResultFactory.accept(
        state.withConversation(null).withMessage({
          type: "conversation_ended",
        }),
      )
    }

    return WizSceneResultFactory.accept(state)
  }

  private handleSellItem(
    state: WizStateShop,
    action: { itemId: string },
  ): WizSceneResult<WizState> {
    const item = getWizRuntimeContentEntry(this.content.items, action.itemId)
    if (!item) {
      return WizSceneResultFactory.reject(
        state.withPendingPurchase(null).withMessage({
          type: "sale_rejected",
          rejection: { type: "unknown_item", itemId: action.itemId },
        }),
        "SALE_REJECTED",
      )
    }
    const entry = state.vault.inventory.entriesFor("item", action.itemId)[0]
    if (entry === undefined) {
      return WizSceneResultFactory.reject(
        state.withPendingPurchase(null).withMessage({
          type: "sale_rejected",
          rejection: { type: "item_not_owned", itemId: action.itemId },
        }),
        "SALE_REJECTED",
      )
    }

    const sellPrice = item.sellPrice
    if (!Number.isFinite(sellPrice) || sellPrice < 0) {
      return WizSceneResultFactory.reject(
        state.withPendingPurchase(null).withMessage({
          type: "sale_rejected",
          rejection: {
            type: "invalid_price",
            itemId: action.itemId,
            price: sellPrice,
          },
        }),
        "SALE_REJECTED",
      )
    }
    const newVault = state.vault
      .updateInventory((inventory) => inventory.consume(entry.entryId))
      .updatePlayer((p) => p.addGold(sellPrice))
      .addLog({
        key: "SOLD_ITEM",
        itemId: action.itemId,
        price: sellPrice,
      })

    return WizSceneResultFactory.accept(
      state.withVault(newVault).withPendingPurchase(null).withMessage({
        type: "sale_completed",
        itemId: action.itemId,
        price: sellPrice,
      }),
    )
  }

  private handleSelectItemToBuy(
    state: WizStateShop,
    action: { itemId: string },
  ): WizSceneResult<WizState> {
    const availability = this.resolveProductAvailability(state, "item", action.itemId)
    if (availability.status === "rejected") return availability.result
    const adjustedPrice = Math.floor(availability.price * state.buyPriceModifier)
    const pendingPurchase = {
      type: "item" as const,
      itemId: action.itemId,
      price: adjustedPrice,
    }
    return WizSceneResultFactory.accept(
      state
        .withPendingPurchase(pendingPurchase)
        .withMessage({ type: "purchase_prompt", ...toPurchaseMessageFields(pendingPurchase) }),
    )
  }

  private handleSelectWeaponToBuy(
    state: WizStateShop,
    action: { weaponId: string },
  ): WizSceneResult<WizState> {
    const availability = this.resolveProductAvailability(state, "weapon", action.weaponId)
    if (availability.status === "rejected") return availability.result
    const adjustedPrice = Math.floor(availability.price * state.buyPriceModifier)
    const pendingPurchase = {
      type: "weapon" as const,
      weaponId: action.weaponId,
      price: adjustedPrice,
    }
    return WizSceneResultFactory.accept(
      state
        .withPendingPurchase(pendingPurchase)
        .withMessage({ type: "purchase_prompt", ...toPurchaseMessageFields(pendingPurchase) }),
    )
  }

  private handleSelectArmorToBuy(
    state: WizStateShop,
    action: { armorId: string },
  ): WizSceneResult<WizState> {
    const availability = this.resolveProductAvailability(state, "armor", action.armorId)
    if (availability.status === "rejected") return availability.result
    const adjustedPrice = Math.floor(availability.price * state.buyPriceModifier)
    const pendingPurchase = {
      type: "armor" as const,
      armorId: action.armorId,
      price: adjustedPrice,
    }
    return WizSceneResultFactory.accept(
      state
        .withPendingPurchase(pendingPurchase)
        .withMessage({ type: "purchase_prompt", ...toPurchaseMessageFields(pendingPurchase) }),
    )
  }

  private handleConfirmPurchase(state: WizStateShop): WizSceneResult<WizState> {
    if (!state.pendingPurchase) {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "purchase_rejected",
          rejection: { type: "no_pending_purchase" },
        }),
        "PURCHASE_REJECTED",
      )
    }

    const pendingProductId =
      state.pendingPurchase.type === "item"
        ? state.pendingPurchase.itemId
        : state.pendingPurchase.type === "weapon"
          ? state.pendingPurchase.weaponId
          : state.pendingPurchase.armorId
    const availability = this.resolveProductAvailability(
      state,
      state.pendingPurchase.type,
      pendingProductId,
    )
    if (availability.status === "rejected") return availability.result

    const purchase = createPurchaseFromConfirmation(state.pendingPurchase)
    const result = this.purchaseService.execute(state.vault, purchase)
    if (result.status === "rejected") {
      return WizSceneResultFactory.reject(
        state.withPendingPurchase(null).withMessage({
          type: "purchase_rejected",
          rejection: result.rejection,
        }),
        "PURCHASE_REJECTED",
      )
    }

    const pending = state.pendingPurchase
    let loggedVault = result.vault
    if (pending.type === "item") {
      loggedVault = result.vault.addLog({
        key: "PURCHASED_ITEM",
        itemId: pending.itemId,
        price: pending.price,
      })
    }
    if (pending.type === "weapon") {
      loggedVault = result.vault.addLog({
        key: "PURCHASED_WEAPON",
        weaponId: pending.weaponId,
        price: pending.price,
      })
    }
    if (pending.type === "armor") {
      loggedVault = result.vault.addLog({
        key: "PURCHASED_ARMOR",
        armorId: pending.armorId,
        price: pending.price,
      })
    }
    return WizSceneResultFactory.accept(
      state
        .withVault(loggedVault)
        .withPendingPurchase(null)
        .withMessage({
          type: "purchase_completed",
          ...toPurchaseMessageFields(pending),
        }),
    )
  }

  private handleStartShopConversation(
    state: WizStateShop,
    action: { topicId: string },
  ): WizSceneResult<WizState> {
    const dialogues = this.dialogueService.getDialogue(state.shopId)
    if (!dialogues) {
      return WizSceneResultFactory.reject(
        state.withPendingPurchase(null).withMessage({
          type: "conversation_rejected",
          rejection: { type: "dialogue_not_found", shopId: state.shopId },
        }),
        "SHOP_CONVERSATION_REJECTED",
      )
    }
    const topic = dialogues.topics.find((t) => t.id === action.topicId)
    if (!topic) {
      return WizSceneResultFactory.reject(
        state.withPendingPurchase(null).withMessage({
          type: "conversation_rejected",
          rejection: {
            type: "topic_not_found",
            shopId: state.shopId,
            topicId: action.topicId,
          },
        }),
        "SHOP_CONVERSATION_REJECTED",
      )
    }
    const firstLine = topic.lines[0]
    if (!firstLine) {
      return WizSceneResultFactory.reject(
        state.withPendingPurchase(null).withMessage({
          type: "conversation_rejected",
          rejection: {
            type: "topic_has_no_lines",
            shopId: state.shopId,
            topicId: topic.id,
          },
        }),
        "SHOP_CONVERSATION_REJECTED",
      )
    }
    return WizSceneResultFactory.accept(
      state
        .withPendingPurchase(null)
        .withMessage(null)
        .withConversation({
          topicId: topic.id,
          lines: topic.lines,
          currentIndex: 0,
          displayedLines: [firstLine],
        })
        .withLastConversation(null),
    )
  }

  private handleAdvanceShopConversation(state: WizStateShop): WizSceneResult<WizState> {
    const conv = state.conversation
    if (!conv) {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "conversation_rejected",
          rejection: { type: "no_active_conversation" },
        }),
        "SHOP_CONVERSATION_REJECTED",
      )
    }
    const nextIndex = conv.currentIndex + 1
    if (nextIndex >= conv.lines.length) {
      const dialogues = this.dialogueService.getDialogue(state.shopId)
      const topic = dialogues?.topics.find((t) => t.id === conv.topicId)
      const completedConversation = {
        ...conv,
        currentIndex: conv.lines.length - 1,
        displayedLines: conv.lines,
      }
      let result = state
        .withConversation(null)
        .withLastConversation(completedConversation)
        .withMessage(null)
      if (topic?.effects?.setFlag) {
        const flag = topic.effects.setFlag
        result = result.updateVault((v) => v.addFlag(flag))
      }
      const hint = topic?.effects?.giveHint
      if (hint) {
        result = result.updateVault((v) =>
          v.addLog({
            key: "HINT_DISCOVERED",
            shopId: state.shopId,
            topicId: conv.topicId,
          }),
        )
      }
      return WizSceneResultFactory.accept(result)
    }
    return WizSceneResultFactory.accept(
      state.withConversation({
        ...conv,
        currentIndex: nextIndex,
        displayedLines: [...conv.displayedLines, conv.lines[nextIndex]],
      }),
    )
  }

  private rejectUnknownProduct(
    state: WizStateShop,
    productType: WizSceneShopProductType,
    productId: string,
  ): WizSceneResult<WizState> {
    return WizSceneResultFactory.reject(
      state.withPendingPurchase(null).withMessage({
        type: "purchase_rejected",
        rejection: {
          type: "unknown_product",
          productType,
          productId,
        },
      }),
      "PURCHASE_REJECTED",
    )
  }

  private rejectProductNotSold(
    state: WizStateShop,
    productType: WizSceneShopProductType,
    productId: string,
  ): WizSceneResult<WizState> {
    return WizSceneResultFactory.reject(
      state.withPendingPurchase(null).withMessage({
        type: "purchase_rejected",
        rejection: {
          type: "product_not_sold",
          shopId: state.shopId,
          productType,
          productId,
        },
      }),
      "PURCHASE_REJECTED",
    )
  }

  private resolveProductAvailability(
    state: WizStateShop,
    productType: WizSceneShopProductType,
    productId: string,
  ): ProductAvailability {
    const product =
      productType === "item"
        ? getWizRuntimeContentEntry(this.content.items, productId)
        : productType === "weapon"
          ? getWizRuntimeContentEntry(this.content.weapons, productId)
          : getWizRuntimeContentEntry(this.content.armors, productId)
    if (!product) {
      return {
        status: "rejected",
        result: this.rejectUnknownProduct(state, productType, productId),
      }
    }

    const products = this.dialogueService.getDialogue(state.shopId)?.products
    const isSold =
      productType === "item"
        ? products?.itemIds.includes(productId)
        : productType === "weapon"
          ? products?.weaponIds.includes(productId)
          : products?.armorIds.includes(productId)
    return isSold
      ? { status: "available", price: product.price }
      : {
          status: "rejected",
          result: this.rejectProductNotSold(state, productType, productId),
        }
  }
}
