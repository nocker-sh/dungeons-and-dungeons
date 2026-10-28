import { describe, expect, it } from "vite-plus/test"
import {
  MOCK_CONTENT,
  MOCK_VAULT,
  MOCK_SHOP_DIALOGUE_SERVICE,
} from "@/lib/wiz/core/mocks/mock-vault"
import { createMockInventoryService } from "@/lib/wiz/core/mocks/create-mock-inventory-service"
import { withMockInventory } from "@/lib/wiz/core/mocks/with-mock-inventory"
import { WizEngineShopPurchaseService } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-purchase-service"
import { WizSceneTransitionService } from "@/lib/wiz/core/runtime/scene-transition-service"
import { MOCK_BATTLE_AUTHORITIES } from "@/lib/wiz/core/mocks/mock-battle-authorities"
import { toShopScene } from "@/lib/wiz/core/runtime/to-shop-scene"
import { WizSceneShopReducer } from "@/lib/wiz/core/runtime/scenes/shop/reducer"
import type { WizState } from "@/lib/wiz/core/runtime/state"

const reducer = new WizSceneShopReducer({
  content: MOCK_CONTENT,
  dialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
  purchaseService: new WizEngineShopPurchaseService(
    createMockInventoryService(undefined, "shop-entry")
  ),
})
const transitionService = new WizSceneTransitionService({
  ...MOCK_BATTLE_AUTHORITIES,
  content: MOCK_CONTENT,
  shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
})
const reduce = (...args: Parameters<WizSceneShopReducer["reduce"]>) =>
  transitionService.applyResult(reducer.reduce(...args)).state

describe("SELECT_ITEM_TO_BUY", () => {
  it("アイテム購入の確認状態になる", () => {
    const state = toShopScene(MOCK_VAULT, "item_shop")

    const result = reduce(state, {
      type: "SELECT_ITEM_TO_BUY",
      shopId: "item_shop",
      itemId: "herb",
    })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.pendingPurchase).toEqual({
        type: "item",
        itemId: "herb",
        price: MOCK_CONTENT.items.herb.price,
      })
      expect(result.message).toEqual({
        type: "purchase_prompt",
        productType: "item",
        productId: "herb",
        price: MOCK_CONTENT.items.herb.price,
      })
    }
  })

  it("存在しないアイテムIDの場合は状態が変わらない", () => {
    const state = toShopScene(MOCK_VAULT, "item_shop")

    const result = reduce(state, {
      type: "SELECT_ITEM_TO_BUY",
      shopId: "item_shop",
      itemId: "nonexistent_item",
    })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.pendingPurchase).toBeNull()
      expect(result.message).toEqual({
        type: "purchase_rejected",
        rejection: {
          type: "unknown_product",
          productType: "item",
          productId: "nonexistent_item",
        },
      })
    }
  })

  it("shop以外のフェーズでは状態が変わらない", () => {
    const villageState = MOCK_VAULT
    const shopState = toShopScene(villageState, "item_shop")
    const result = reduce(shopState, {
      type: "SELECT_ITEM_TO_BUY",
      shopId: "item_shop",
      itemId: "herb",
    })

    expect(result.type).toBe("shop")
  })
})

describe("SELECT_WEAPON_TO_BUY", () => {
  it("武器購入の確認状態になる", () => {
    const state = toShopScene(MOCK_VAULT, "weapon_shop")

    const result = reduce(state, {
      type: "SELECT_WEAPON_TO_BUY",
      shopId: "weapon_shop",
      weaponId: "iron_sword",
    })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.pendingPurchase).toEqual({
        type: "weapon",
        weaponId: "iron_sword",
        price: MOCK_CONTENT.weapons.iron_sword.price,
      })
      expect(result.message).toEqual({
        type: "purchase_prompt",
        productType: "weapon",
        productId: "iron_sword",
        price: MOCK_CONTENT.weapons.iron_sword.price,
      })
    }
  })

  it("存在しない武器IDの場合は状態が変わらない", () => {
    const state = toShopScene(MOCK_VAULT, "weapon_shop")

    const result = reduce(state, {
      type: "SELECT_WEAPON_TO_BUY",
      shopId: "weapon_shop",
      weaponId: "nonexistent_weapon",
    })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.pendingPurchase).toBeNull()
      expect(result.message).toEqual({
        type: "purchase_rejected",
        rejection: {
          type: "unknown_product",
          productType: "weapon",
          productId: "nonexistent_weapon",
        },
      })
    }
  })

  it("別のshopの商品は既知IDでも購入確認へ進めない", () => {
    const state = toShopScene(MOCK_VAULT, "item_shop")

    const result = reduce(state, {
      type: "SELECT_WEAPON_TO_BUY",
      shopId: "item_shop",
      weaponId: "iron_sword",
    })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.pendingPurchase).toBeNull()
      expect(result.message).toEqual({
        type: "purchase_rejected",
        rejection: {
          type: "product_not_sold",
          shopId: "item_shop",
          productType: "weapon",
          productId: "iron_sword",
        },
      })
    }
  })
})

describe("SELECT_ARMOR_TO_BUY", () => {
  it("防具購入の確認状態になる", () => {
    const state = toShopScene(MOCK_VAULT, "armor_shop")

    const result = reduce(state, {
      type: "SELECT_ARMOR_TO_BUY",
      shopId: "armor_shop",
      armorId: "leather_armor",
    })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.pendingPurchase).toEqual({
        type: "armor",
        armorId: "leather_armor",
        price: MOCK_CONTENT.armors.leather_armor.price,
      })
      expect(result.message).toEqual({
        type: "purchase_prompt",
        productType: "armor",
        productId: "leather_armor",
        price: MOCK_CONTENT.armors.leather_armor.price,
      })
    }
  })

  it("存在しない防具IDの場合は状態が変わらない", () => {
    const state = toShopScene(MOCK_VAULT, "armor_shop")

    const result = reduce(state, {
      type: "SELECT_ARMOR_TO_BUY",
      shopId: "armor_shop",
      armorId: "nonexistent_armor",
    })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.pendingPurchase).toBeNull()
      expect(result.message).toEqual({
        type: "purchase_rejected",
        rejection: {
          type: "unknown_product",
          productType: "armor",
          productId: "nonexistent_armor",
        },
      })
    }
  })
})

describe("CONFIRM_PURCHASE", () => {
  describe("成功", () => {
    it("アイテムを購入できる", () => {
      const vaultWithGold = MOCK_VAULT.updatePlayer((p) => p.addGold(1000))
      const state = toShopScene(vaultWithGold, "item_shop")
      const stateWithPending = reduce(state, {
        type: "SELECT_ITEM_TO_BUY",
        shopId: "item_shop",
        itemId: "herb",
      })

      const result = reduce(stateWithPending, {
        type: "CONFIRM_PURCHASE",
      })

      expect(result.type).toBe("shop")
      if (result.type === "shop") {
        expect(result.pendingPurchase).toBeNull()
        expect(result.message).toEqual({
          type: "purchase_completed",
          productType: "item",
          productId: "herb",
          price: MOCK_CONTENT.items.herb.price,
        })
        expect(result.vault.inventory.totalQuantity("item", "herb") > 0).toBe(
          true
        )
        expect(result.vault.player.gold).toBe(
          vaultWithGold.player.gold - MOCK_CONTENT.items.herb.price
        )
      }
    })

    it("武器を購入できる", () => {
      const vaultWithGold = MOCK_VAULT.updatePlayer((p) => p.addGold(1000))
      const state = toShopScene(vaultWithGold, "weapon_shop")
      const stateWithPending = reduce(state, {
        type: "SELECT_WEAPON_TO_BUY",
        shopId: "weapon_shop",
        weaponId: "iron_sword",
      })

      const result = reduce(stateWithPending, {
        type: "CONFIRM_PURCHASE",
      })

      expect(result.type).toBe("shop")
      if (result.type === "shop") {
        expect(result.pendingPurchase).toBeNull()
        expect(result.message).toEqual({
          type: "purchase_completed",
          productType: "weapon",
          productId: "iron_sword",
          price: MOCK_CONTENT.weapons.iron_sword.price,
        })
        expect(
          result.vault.inventory.totalQuantity("weapon", "iron_sword") > 0
        ).toBe(true)
      }
    })

    it("防具を購入できる", () => {
      const vaultWithGold = MOCK_VAULT.updatePlayer((p) => p.addGold(1000))
      const state = toShopScene(vaultWithGold, "armor_shop")
      const stateWithPending = reduce(state, {
        type: "SELECT_ARMOR_TO_BUY",
        shopId: "armor_shop",
        armorId: "leather_armor",
      })

      const result = reduce(stateWithPending, {
        type: "CONFIRM_PURCHASE",
      })

      expect(result.type).toBe("shop")
      if (result.type === "shop") {
        expect(result.pendingPurchase).toBeNull()
        expect(result.message).toEqual({
          type: "purchase_completed",
          productType: "armor",
          productId: "leather_armor",
          price: MOCK_CONTENT.armors.leather_armor.price,
        })
        expect(
          result.vault.inventory.totalQuantity("armor", "leather_armor") > 0
        ).toBe(true)
      }
    })

    it("購入ログが記録される", () => {
      const vaultWithGold = MOCK_VAULT.updatePlayer((p) => p.addGold(1000))
      const state = toShopScene(vaultWithGold, "item_shop")
      const stateWithPending = reduce(state, {
        type: "SELECT_ITEM_TO_BUY",
        shopId: "item_shop",
        itemId: "herb",
      })

      const result = reduce(stateWithPending, {
        type: "CONFIRM_PURCHASE",
      })

      expect(result.type).toBe("shop")
      if (result.type === "shop") {
        const log = result.vault.log
        const lastLog = log[log.length - 1]
        expect(lastLog.key).toBe("PURCHASED_ITEM")
      }
    })
  })

  describe("ゴールド不足", () => {
    it("所持金が足りない場合は購入できない", () => {
      const vaultWithNoGold = MOCK_VAULT.updatePlayer((p) =>
        p.spendGold(p.gold)
      )
      const state = toShopScene(vaultWithNoGold, "item_shop")
      const stateWithPending = reduce(state, {
        type: "SELECT_ITEM_TO_BUY",
        shopId: "item_shop",
        itemId: "herb",
      })

      const result = reduce(stateWithPending, {
        type: "CONFIRM_PURCHASE",
      })

      expect(result.type).toBe("shop")
      if (result.type === "shop") {
        expect(result.pendingPurchase).toBeNull()
        expect(result.message).toEqual({
          type: "purchase_rejected",
          rejection: {
            type: "insufficient_gold",
            required: MOCK_CONTENT.items.herb.price,
            available: 0,
            shortfall: MOCK_CONTENT.items.herb.price,
          },
        })
        expect(result.vault.inventory.totalQuantity("item", "herb") > 0).toBe(
          false
        )
      }
    })
  })

  it("pendingPurchaseがない場合は意味的な拒否理由を返す", () => {
    const state = toShopScene(MOCK_VAULT, "item_shop")

    const result = reduce(state, { type: "CONFIRM_PURCHASE" })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.message).toEqual({
        type: "purchase_rejected",
        rejection: { type: "no_pending_purchase" },
      })
    }
  })

  it("外部生成された別shopのpendingPurchaseも確定時に拒否する", () => {
    const vaultWithGold = MOCK_VAULT.updatePlayer((player) =>
      player.addGold(1000)
    )
    const state = toShopScene(vaultWithGold, "item_shop").withPendingPurchase({
      type: "weapon",
      weaponId: "iron_sword",
      price: MOCK_CONTENT.weapons.iron_sword.price,
    })

    const result = reduce(state, { type: "CONFIRM_PURCHASE" })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.pendingPurchase).toBeNull()
      expect(result.vault).toBe(vaultWithGold)
      expect(result.message).toEqual({
        type: "purchase_rejected",
        rejection: {
          type: "product_not_sold",
          shopId: "item_shop",
          productType: "weapon",
          productId: "iron_sword",
        },
      })
    }
  })
})

describe("SELL_ITEM", () => {
  it("売却結果をitem IDと価格で返す", () => {
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "herb" },
    ])
    const state = toShopScene(vault, "item_shop")

    const result = reduce(state, { type: "SELL_ITEM", itemId: "herb" })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.message).toEqual({
        type: "sale_completed",
        itemId: "herb",
        price: MOCK_CONTENT.items.herb.sellPrice,
      })
      expect(result.vault.player.gold).toBe(
        vault.player.gold + MOCK_CONTENT.items.herb.sellPrice
      )
    }
  })

  it("未所持itemを意味的理由付きで拒否する", () => {
    const state = toShopScene(MOCK_VAULT, "item_shop")

    const result = reduce(state, { type: "SELL_ITEM", itemId: "herb" })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.message).toEqual({
        type: "sale_rejected",
        rejection: { type: "item_not_owned", itemId: "herb" },
      })
    }
  })

  it("未知itemを意味的理由付きで拒否する", () => {
    const state = toShopScene(MOCK_VAULT, "item_shop")

    const result = reduce(state, { type: "SELL_ITEM", itemId: "missing" })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.message).toEqual({
        type: "sale_rejected",
        rejection: { type: "unknown_item", itemId: "missing" },
      })
    }
  })
})

describe("CANCEL_PURCHASE", () => {
  it("購入確認をキャンセルできる", () => {
    const state = toShopScene(MOCK_VAULT, "item_shop")
    const stateWithPending = reduce(state, {
      type: "SELECT_ITEM_TO_BUY",
      shopId: "item_shop",
      itemId: "herb",
    })

    const result = reduce(stateWithPending, { type: "CANCEL_PURCHASE" })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.pendingPurchase).toBeNull()
      expect(result.message).toEqual({ type: "purchase_cancelled" })
    }
  })
})

describe("LEAVE_SHOP", () => {
  it("ショップを離れてvillageフェーズになる", () => {
    const state = toShopScene(MOCK_VAULT, "item_shop")

    const result = reduce(state, { type: "LEAVE_SHOP" })

    expect(result.type).toBe("village")
  })

  it("ショップ離脱ログが記録される", () => {
    const state = toShopScene(MOCK_VAULT, "item_shop")

    const result = reduce(state, { type: "LEAVE_SHOP" })

    const log = result.vault.log
    const lastLog = log[log.length - 1]
    expect(lastLog.key).toBe("LEFT_SHOP")
  })
})

describe("START_SHOP_CONVERSATION", () => {
  it("会話を開始できる", () => {
    const state = toShopScene(MOCK_VAULT, "item_shop")

    const result = reduce(state, {
      type: "START_SHOP_CONVERSATION",
      shopId: "item_shop",
      topicId: "about_shop",
    })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.conversation).not.toBeNull()
      expect(result.conversation?.topicId).toBe("about_shop")
      expect(result.conversation?.currentIndex).toBe(0)
      expect(result.conversation?.displayedLines.length).toBe(1)
      expect(result.pendingPurchase).toBeNull()
      expect(result.message).toBeNull()
    }
  })

  it("存在しないトピックの場合は状態が変わらない", () => {
    const state = toShopScene(MOCK_VAULT, "item_shop")

    const result = reduce(state, {
      type: "START_SHOP_CONVERSATION",
      shopId: "item_shop",
      topicId: "nonexistent_topic",
    })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.conversation).toBeNull()
      expect(result.message).toEqual({
        type: "conversation_rejected",
        rejection: {
          type: "topic_not_found",
          shopId: "item_shop",
          topicId: "nonexistent_topic",
        },
      })
    }
  })
})

describe("ADVANCE_SHOP_CONVERSATION", () => {
  it("会話を進められる", () => {
    const state = toShopScene(MOCK_VAULT, "item_shop")
    const stateWithConv = reduce(state, {
      type: "START_SHOP_CONVERSATION",
      shopId: "item_shop",
      topicId: "about_shop",
    })

    const result = reduce(stateWithConv, {
      type: "ADVANCE_SHOP_CONVERSATION",
    })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.conversation?.currentIndex).toBe(1)
      expect(result.conversation?.displayedLines.length).toBe(2)
    }
  })

  it("会話の最後まで進めると会話が終了する", () => {
    let state: WizState = toShopScene(MOCK_VAULT, "item_shop")
    state = reduce(state, {
      type: "START_SHOP_CONVERSATION",
      shopId: "item_shop",
      topicId: "about_shop",
    })

    // 会話を最後まで進める
    while (state.type === "shop" && state.conversation !== null) {
      state = reduce(state, { type: "ADVANCE_SHOP_CONVERSATION" })
    }

    expect(state.type).toBe("shop")
    if (state.type === "shop") {
      expect(state.conversation).toBeNull()
      expect(state.lastConversation).not.toBeNull()
      expect(state.lastConversation?.topicId).toBe("about_shop")
    }
  })

  it("フラグ効果のあるトピックはフラグがセットされる", () => {
    let state: WizState = toShopScene(MOCK_VAULT, "item_shop")
    state = reduce(state, {
      type: "START_SHOP_CONVERSATION",
      shopId: "item_shop",
      topicId: "village_news",
    })

    // 会話を最後まで進める
    while (state.type === "shop" && state.conversation !== null) {
      state = reduce(state, { type: "ADVANCE_SHOP_CONVERSATION" })
    }

    expect(state.type).toBe("shop")
    if (state.type === "shop") {
      expect(state.vault.hasFlag("heard_forest_rumor")).toBe(true)
    }
  })

  it("ヒント効果のあるトピックはログが記録される", () => {
    let state: WizState = toShopScene(MOCK_VAULT, "item_shop")
    state = reduce(state, {
      type: "START_SHOP_CONVERSATION",
      shopId: "item_shop",
      topicId: "herb_gathering",
    })

    // 会話を最後まで進める
    while (state.type === "shop" && state.conversation !== null) {
      state = reduce(state, { type: "ADVANCE_SHOP_CONVERSATION" })
    }

    expect(state.type).toBe("shop")
    if (state.type === "shop") {
      const log = state.vault.log
      const hintLog = log.find((entry) => entry.key === "HINT_DISCOVERED")
      expect(hintLog).toEqual({
        key: "HINT_DISCOVERED",
        shopId: "item_shop",
        topicId: "herb_gathering",
      })
    }
  })

  it("会話がない場合は意味的な拒否理由を返す", () => {
    const state = toShopScene(MOCK_VAULT, "item_shop")

    const result = reduce(state, { type: "ADVANCE_SHOP_CONVERSATION" })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.message).toEqual({
        type: "conversation_rejected",
        rejection: { type: "no_active_conversation" },
      })
    }
  })
})

describe("END_SHOP_CONVERSATION", () => {
  it("会話を終了できる", () => {
    const state = toShopScene(MOCK_VAULT, "item_shop")
    const stateWithConv = reduce(state, {
      type: "START_SHOP_CONVERSATION",
      shopId: "item_shop",
      topicId: "about_shop",
    })

    const result = reduce(stateWithConv, {
      type: "END_SHOP_CONVERSATION",
    })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.conversation).toBeNull()
      expect(result.message).toEqual({ type: "conversation_ended" })
    }
  })

  it("会話がない場合は意味的な拒否理由を返す", () => {
    const state = toShopScene(MOCK_VAULT, "item_shop")

    const result = reduce(state, { type: "END_SHOP_CONVERSATION" })

    expect(result.type).toBe("shop")
    if (result.type === "shop") {
      expect(result.message).toEqual({
        type: "conversation_rejected",
        rejection: { type: "no_active_conversation" },
      })
    }
  })
})

describe("WizStateShop message ownership", () => {
  it("semantic rejection inputを所有する", () => {
    const message: {
      type: "purchase_rejected"
      rejection: {
        type: "insufficient_gold"
        required: number
        available: number
        shortfall: number
      }
    } = {
      type: "purchase_rejected",
      rejection: {
        type: "insufficient_gold",
        required: 10,
        available: 2,
        shortfall: 8,
      },
    }
    const state = toShopScene(MOCK_VAULT, "item_shop").withMessage(message)

    message.rejection.shortfall = 0

    expect(state.message).toMatchObject({
      rejection: { shortfall: 8 },
    })
    expect(Object.isFrozen(state.message)).toBe(true)
    if (state.message?.type === "purchase_rejected") {
      expect(Object.isFrozen(state.message.rejection)).toBe(true)
    }
  })
})
