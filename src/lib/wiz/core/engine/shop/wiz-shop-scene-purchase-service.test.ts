import { describe, expect, it } from "vite-plus/test"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { WizEnginePurchase } from "@/lib/wiz/core/engine/shop/wiz-purchase"
import { WizEngineShopPurchaseService } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-purchase-service"
import { createMockInventoryService } from "@/lib/wiz/core/mocks/mock-inventory"

const service = new WizEngineShopPurchaseService(createMockInventoryService())

describe("canAfford", () => {
  it("所持金が足りる場合はtrueを返す", () => {
    const vault = MOCK_VAULT.updatePlayer((p) => p.addGold(100))

    expect(service.canAfford(vault, 50)).toBe(true)
  })

  it("所持金が足りない場合はfalseを返す", () => {
    const vault = MOCK_VAULT.updatePlayer((p) => p.spendGold(p.gold))

    expect(service.canAfford(vault, 50)).toBe(false)
  })

  it("所持金がちょうど足りる場合はtrueを返す", () => {
    const vault = MOCK_VAULT.updatePlayer((p) => p.spendGold(p.gold).addGold(50))

    expect(service.canAfford(vault, 50)).toBe(true)
  })
})

describe("execute", () => {
  it("アイテムを購入できる", () => {
    const initialGold = MOCK_VAULT.player.gold
    const vault = MOCK_VAULT
    const purchase = WizEnginePurchase.fromItem("herb", 10)

    const result = service.execute(vault, purchase)

    expect(result.vault.player.gold).toBe(initialGold - 10)
    expect(result.vault.inventory.totalQuantity("item", "herb") > 0).toBe(true)
  })

  it("武器を購入できる", () => {
    const initialGold = MOCK_VAULT.player.gold
    const vault = MOCK_VAULT
    const purchase = WizEnginePurchase.fromWeapon("iron_sword", 100)

    const result = service.execute(vault, purchase)

    expect(result.vault.player.gold).toBe(initialGold - 100)
    expect(result.vault.inventory.totalQuantity("weapon", "iron_sword") > 0).toBe(true)
  })

  it("防具を購入できる", () => {
    const initialGold = MOCK_VAULT.player.gold
    const vault = MOCK_VAULT
    const purchase = WizEnginePurchase.fromArmor("leather_armor", 80)

    const result = service.execute(vault, purchase)

    expect(result.vault.player.gold).toBe(initialGold - 80)
    expect(result.vault.inventory.totalQuantity("armor", "leather_armor") > 0).toBe(true)
  })

  it("購入した対象を意味的IDで返す", () => {
    const vault = MOCK_VAULT
    const purchase = WizEnginePurchase.fromItem("herb", 10)

    const result = service.execute(vault, purchase)

    expect(result.status).toBe("completed")
    expect(result.purchase.id).toBe("herb")
    expect(result.purchase).toBe(purchase)
    expect(Object.isFrozen(result)).toBe(true)
  })

  it("資金不足を理由と必要額付きで拒否する", () => {
    const vault = MOCK_VAULT.updatePlayer((player) => player.spendGold(player.gold))
    const purchase = WizEnginePurchase.fromItem("herb", 10)

    const result = service.execute(vault, purchase)

    expect(result.status).toBe("rejected")
    if (result.status === "rejected") {
      expect(result.rejection).toEqual({
        type: "insufficient_gold",
        required: 10,
        available: 0,
        shortfall: 10,
      })
      expect(result.vault).toBe(vault)
      expect(Object.isFrozen(result.rejection)).toBe(true)
    }
  })

  it("不正な価格を意味的理由付きで拒否しvaultを変更しない", () => {
    const vault = MOCK_VAULT
    const purchase = WizEnginePurchase.fromItem("herb", -1)

    const result = service.execute(vault, purchase)

    expect(result.status).toBe("rejected")
    if (result.status === "rejected") {
      expect(result.rejection).toEqual({
        type: "invalid_price",
        price: -1,
      })
      expect(result.vault).toBe(vault)
    }
  })
})

describe("WizEnginePurchase", () => {
  describe("fromItem", () => {
    it("アイテム購入情報を作成できる", () => {
      const purchase = WizEnginePurchase.fromItem("herb", 10)

      expect(purchase.type).toBe("item")
      expect(purchase.price).toBe(10)
    })

    it("constructor inputを所有して外部alias変更を受けない", () => {
      const input = { type: "item" as const, itemId: "herb", price: 10 }
      const purchase = new WizEnginePurchase(input)

      input.itemId = "ore"
      input.price = 999

      expect(purchase.id).toBe("herb")
      expect(purchase.price).toBe(10)
      expect(Object.isFrozen(purchase.toPlain())).toBe(true)
    })
  })

  describe("fromWeapon", () => {
    it("武器購入情報を作成できる", () => {
      const purchase = WizEnginePurchase.fromWeapon("iron_sword", 100)

      expect(purchase.type).toBe("weapon")
      expect(purchase.price).toBe(100)
    })
  })

  describe("fromArmor", () => {
    it("防具購入情報を作成できる", () => {
      const purchase = WizEnginePurchase.fromArmor("leather_armor", 80)

      expect(purchase.type).toBe("armor")
      expect(purchase.price).toBe(80)
    })
  })

  describe("toPlain", () => {
    it("プレーンオブジェクトに変換できる", () => {
      const purchase = WizEnginePurchase.fromItem("herb", 10)
      const plain = purchase.toPlain()

      expect(plain.type).toBe("item")
      expect(plain.price).toBe(10)
      if (plain.type === "item") {
        expect(plain.itemId).toBe("herb")
      }
      expect(Object.isFrozen(plain)).toBe(true)
    })
  })
})
