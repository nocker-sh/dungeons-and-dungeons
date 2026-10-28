import { describe, expect, it } from "vite-plus/test"
import { WizItem, WizItemCatalog, WizItemWithEffect } from "@/lib/wiz/core/domain/values/item"

describe("WizItem", () => {
  it("effectとcustomをdeep immutableに所有する", () => {
    const effect = { type: "heal", value: 10 }
    const item = WizItem.define({
      id: "potion",
      name: "Potion",
      effect,
      custom: { price: 20 },
    })
    effect.value = 99

    expect(item.effect).toEqual({ type: "heal", value: 10 })
    expect(Object.isFrozen(item.effect)).toBe(true)
    expect(item).toBeInstanceOf(WizItemWithEffect)
    expect(item.withCustom({ price: 30 }).effect.value).toBe(10)
  })

  it("catalogは重複IDを拒否してID解決する", () => {
    const item = WizItem.define({ id: "potion", name: "Potion" })
    expect(WizItemCatalog.create([item]).require("potion")).toBe(item)
    expect(() => WizItemCatalog.create([item, item])).toThrow('Duplicate item id "potion"')
  })

  it("effectなしItemとeffect付きItemを入力だけで型付けする", () => {
    const material = WizItem.define({ id: "ore", name: "Ore" })
    const consumable = WizItem.define({
      id: "potion",
      name: "Potion",
      effect: { type: "heal", value: 10 } as const,
    })

    expect(material.effect).toBeUndefined()
    expect(consumable.effect.type).toBe("heal")
    expect(consumable.withEffect({ type: "damage", value: 3 } as const).effect.type).toBe("damage")
  })
})
