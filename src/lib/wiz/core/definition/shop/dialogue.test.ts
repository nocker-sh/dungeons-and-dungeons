import { describe, expect, it } from "vite-plus/test"
import { zWizContentShopDialogue } from "@/lib/wiz/core/definition/shop/dialogue"

const DIALOGUE_INPUT = {
  shopId: "general_store",
  shopkeeperName: "Keeper",
  greeting: "Welcome",
  products: {
    itemIds: ["potion"],
    weaponIds: ["sword"],
    armorIds: ["mail"],
  },
  topics: [],
}

describe("zWizContentShopDialogue", () => {
  it("商品categoryをすべて必須にし、parse結果のcatalogをdeep immutableにする", () => {
    const dialogue = zWizContentShopDialogue.parse(DIALOGUE_INPUT)

    expect(dialogue.products).toEqual({
      itemIds: ["potion"],
      weaponIds: ["sword"],
      armorIds: ["mail"],
    })
    expect(Object.isFrozen(dialogue.products)).toBe(true)
    expect(Object.isFrozen(dialogue.products.itemIds)).toBe(true)
    expect(Object.isFrozen(dialogue.products.weaponIds)).toBe(true)
    expect(Object.isFrozen(dialogue.products.armorIds)).toBe(true)
    expect(Object.isFrozen(DIALOGUE_INPUT.products)).toBe(false)
  })

  it("productsと各categoryの欠落をschema path付きで拒否する", () => {
    const missingProducts = zWizContentShopDialogue.safeParse({
      ...DIALOGUE_INPUT,
      products: undefined,
    })
    const missingCategory = zWizContentShopDialogue.safeParse({
      ...DIALOGUE_INPUT,
      products: {
        itemIds: [],
        weaponIds: [],
      },
    })

    expect(missingProducts.success).toBe(false)
    if (!missingProducts.success) {
      expect(missingProducts.error.issues.map((issue) => issue.path)).toContainEqual(["products"])
    }
    expect(missingCategory.success).toBe(false)
    if (!missingCategory.success) {
      expect(missingCategory.error.issues.map((issue) => issue.path)).toContainEqual([
        "products",
        "armorIds",
      ])
    }
  })
})
