import { describe, expect, it } from "vite-plus/test"
import { WizStateGift } from "@/lib/wiz/core/domain/values/gift"

const createGift = (itemId = "potion-01") => WizStateGift.create(itemId)

describe("construction", () => {
  it("creates via static create()", () => {
    const gift = WizStateGift.create("sword-01")
    expect(gift.itemId).toBe("sword-01")
  })

  it("creates via fromPlain()", () => {
    const gift = WizStateGift.fromPlain({
      itemId: "herb-01",
    })
    expect(gift.itemId).toBe("herb-01")
  })
})

describe("getters", () => {
  it("returns itemId", () => {
    const gift = createGift("ring-01")
    expect(gift.itemId).toBe("ring-01")
  })
})

describe("semantic events", () => {
  it("returns a presentation event with the item id", () => {
    const event = createGift("flower").presentationEvent

    expect(event).toEqual({ type: "gift_presented", itemId: "flower" })
    expect(Object.isFrozen(event)).toBe(true)
  })
})

describe("toPlain / fromPlain round-trip", () => {
  it("round-trips correctly", () => {
    const original = WizStateGift.create("gem-01")
    const plain = original.toPlain()
    const restored = WizStateGift.fromPlain(plain)
    expect(restored.itemId).toBe(original.itemId)
  })

  it("returns plain object with correct shape", () => {
    const gift = WizStateGift.create("gem-01")
    const plain = gift.toPlain()
    expect(plain).toEqual({ itemId: "gem-01" })
  })
})

describe("immutability", () => {
  it("is frozen", () => {
    const gift = createGift()
    expect(Object.isFrozen(gift)).toBe(true)
  })
})
