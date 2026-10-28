import { describe, expect, it } from "vite-plus/test"
import {
  WizInventoryRules,
  WizInventoryTransaction,
  WizInventoryTransactionError,
  WizInventoryTransfer,
} from "@/lib/wiz/core/domain/services/inventory-transaction"
import {
  WizInventory,
  WizInventoryEntry,
  WizInventoryOperationError,
} from "@/lib/wiz/core/domain/values/inventory"

const potionA = WizInventoryEntry.define({
  entryId: "potion-a",
  contentType: "item",
  contentId: "potion",
  quantity: 5,
})
const potionB = WizInventoryEntry.define({
  entryId: "potion-b",
  contentType: "item",
  contentId: "potion",
  quantity: 3,
})
const sword = WizInventoryEntry.define({
  entryId: "sword-a",
  contentType: "weapon",
  contentId: "wood-sword",
  quantity: 1,
  custom: { durability: 10 },
})

const transaction = new WizInventoryTransaction(WizInventoryRules.byContent(10))

describe("WizInventoryTransaction", () => {
  it("追加時にruleが許すentryだけを既存stackへまとめる", () => {
    const inventory = WizInventory.create({
      capacity: 3,
      entries: [potionA],
    })
    const stacked = transaction.add(inventory, potionB)
    const withSword = transaction.add(stacked, sword)

    expect(stacked.entries).toHaveLength(1)
    expect(stacked.find("potion-a")?.quantity).toBe(8)
    expect(withSword.entries).toHaveLength(2)
  })

  it("複数entryを事前検証して一度に消費する", () => {
    const inventory = WizInventory.create({
      capacity: 4,
      entries: [potionA, sword],
    })
    const result = transaction.consumeMany(inventory, [
      { entryId: "potion-a", quantity: 2 },
      { entryId: "potion-a", quantity: 1 },
      { entryId: "sword-a", quantity: 1 },
    ])

    expect(result.toPlain()).toEqual({
      capacity: 4,
      entries: [
        {
          contentId: "potion",
          contentType: "item",
          custom: undefined,
          entryId: "potion-a",
          quantity: 2,
        },
      ],
    })
    expect(inventory.find("potion-a")?.quantity).toBe(5)

    expect(() =>
      transaction.consumeMany(inventory, [
        { entryId: "potion-a", quantity: 6 },
        { entryId: "sword-a", quantity: 1 },
      ]),
    ).toThrow(WizInventoryOperationError)
    expect(inventory.entries).toHaveLength(2)
  })

  it("stackを分割・結合し上限を強制する", () => {
    const inventory = WizInventory.create({
      capacity: 3,
      entries: [potionA],
    })
    const split = transaction.split(inventory, "potion-a", 2, "potion-b")
    const merged = transaction.merge(split, "potion-b", "potion-a")

    expect(split.find("potion-a")?.quantity).toBe(3)
    expect(split.find("potion-b")?.quantity).toBe(2)
    expect(merged.find("potion-a")?.quantity).toBe(5)
    expect(merged.has("potion-b")).toBe(false)

    const overLimit = WizInventory.create({
      capacity: 3,
      entries: [potionA.withQuantity(8), potionB],
    })
    expect(() => transaction.merge(overLimit, "potion-b", "potion-a")).toThrow(
      WizInventoryTransactionError,
    )
  })

  it("二つのinventoryを一つの原子的な結果として更新する", () => {
    const source = WizInventory.create({
      capacity: 3,
      entries: [potionA, sword],
    })
    const destination = WizInventory.create({
      capacity: 3,
      entries: [potionB],
    })
    const result = transaction.transfer(source, destination, "potion-a", 2, "potion-b")

    expect(result).toBeInstanceOf(WizInventoryTransfer)
    expect(result.source.find("potion-a")?.quantity).toBe(3)
    expect(result.destination.find("potion-b")?.quantity).toBe(5)
    expect(source.find("potion-a")?.quantity).toBe(5)
    expect(destination.find("potion-b")?.quantity).toBe(3)
  })

  it("customを持つ固有entryは標準ruleでstackしない", () => {
    const otherSword = WizInventoryEntry.define({
      ...sword.toProperties(),
      entryId: "sword-b",
    })
    const inventory = WizInventory.create({
      capacity: 3,
      entries: [sword, otherSword],
    })

    expect(() => transaction.merge(inventory, "sword-b", "sword-a")).toThrow(
      WizInventoryTransactionError,
    )
  })
})
