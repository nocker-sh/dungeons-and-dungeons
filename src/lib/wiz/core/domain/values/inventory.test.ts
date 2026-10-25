import { describe, expect, it } from "vite-plus/test"
import { z } from "zod"
import {
  WizEquipmentLoadout,
  WizInventory,
  WizInventoryEntry,
  WizInventoryOperationError,
} from "@/lib/wiz/core/domain/values/inventory"

const potion = WizInventoryEntry.define({
  entryId: "potion-stack",
  contentType: "item",
  contentId: "potion",
  quantity: 3,
})

const firstSword = WizInventoryEntry.define({
  entryId: "sword-a",
  contentType: "weapon",
  contentId: "iron-sword",
  quantity: 1,
  custom: {
    affixes: ["sharp"],
    durability: 80,
  },
})

const secondSword = WizInventoryEntry.define({
  entryId: "sword-b",
  contentType: "weapon",
  contentId: "iron-sword",
  quantity: 1,
  custom: {
    affixes: ["light"],
    durability: 35,
  },
})

describe("WizInventoryEntry", () => {
  it("contentと所有instanceを分離してcustom状態を防御所有する", () => {
    const custom = {
      affixes: ["fire"],
      durability: 50,
    }
    const entry = WizInventoryEntry.define({
      entryId: "sword-c",
      contentType: "weapon",
      contentId: "iron-sword",
      quantity: 1,
      custom,
    })

    custom.affixes.push("forged")
    custom.durability = 0

    expect(entry.entryId).toBe("sword-c")
    expect(entry.contentType).toBe("weapon")
    expect(entry.contentId).toBe("iron-sword")
    expect(entry.custom).toEqual({
      affixes: ["fire"],
      durability: 50,
    })
    expect(Object.isFrozen(entry)).toBe(true)
    expect(Object.isFrozen(entry.custom?.affixes)).toBe(true)
  })

  it("Standard Schemaでunknown入力を検証する", () => {
    const schema = z.strictObject({
      entryId: z.literal("potion-stack"),
      contentType: z.literal("item"),
      contentId: z.literal("potion"),
      quantity: z.number().int().positive(),
    })
    const entry = WizInventoryEntry.fromUnknown(
      {
        contentId: "potion",
        contentType: "item",
        entryId: "potion-stack",
        quantity: 5,
      },
      schema,
    )

    expect(entry.quantity).toBe(5)
  })
})

describe("WizInventory", () => {
  it("stackと同一contentの固有装備を同時に管理する", () => {
    const inventory = WizInventory.create({
      capacity: 4,
      entries: [potion, firstSword, secondSword] as const,
    })

    expect(inventory.totalQuantity("item", "potion")).toBe(3)
    expect(inventory.totalQuantity("weapon", "iron-sword")).toBe(2)
    expect(inventory.entriesFor("weapon", "iron-sword")).toHaveLength(2)
    expect(inventory.find("sword-a")?.custom?.durability).toBe(80)
    expect(inventory.find("sword-b")?.custom?.durability).toBe(35)
  })

  it("明示的なinsert、increase、consumeを不変更新する", () => {
    const initial = WizInventory.create({
      capacity: 2,
      entries: [potion] as const,
    })
    const inserted = initial.insert(firstSword)
    const increased = inserted.increase("potion-stack", 2)
    const consumed = increased.consume("potion-stack", 4)
    const removed = consumed.consume("potion-stack")

    expect(initial.entries).toHaveLength(1)
    expect(inserted.entries).toHaveLength(2)
    expect(increased.find("potion-stack")?.quantity).toBe(5)
    expect(consumed.find("potion-stack")?.quantity).toBe(1)
    expect(removed.find("potion-stack")).toBeUndefined()
  })

  it("容量超過、重複、在庫不足を安定したerrorで拒否する", () => {
    const inventory = WizInventory.create({
      capacity: 1,
      entries: [potion] as const,
    })

    expect(() => inventory.insert(firstSword)).toThrow(
      expect.objectContaining({ code: "INVENTORY_FULL" }),
    )
    expect(() => inventory.insert(potion)).toThrow(
      expect.objectContaining({ code: "INVENTORY_ENTRY_ALREADY_EXISTS" }),
    )
    expect(() => inventory.consume("potion-stack", 4)).toThrow(
      expect.objectContaining({ code: "INVENTORY_QUANTITY_INSUFFICIENT" }),
    )
    expect(() => inventory.remove("missing" as "potion-stack")).toThrow(WizInventoryOperationError)
  })

  it("plain stateを検証して復元する", () => {
    const schema = z.strictObject({
      capacity: z.number().int().nonnegative(),
      entries: z.array(
        z.strictObject({
          entryId: z.string(),
          contentType: z.literal("weapon"),
          contentId: z.string(),
          quantity: z.number().int().positive(),
          custom: z.strictObject({
            durability: z.number().int().nonnegative(),
          }),
        }),
      ),
    })
    const inventory = WizInventory.fromUnknown(
      {
        capacity: 2,
        entries: [
          {
            contentId: "iron-sword",
            contentType: "weapon",
            custom: { durability: 40 },
            entryId: "sword-a",
            quantity: 1,
          },
        ],
      },
      schema,
    )

    expect(inventory.find("sword-a")?.custom?.durability).toBe(40)
    expect(inventory.toPlain()).toEqual({
      capacity: 2,
      entries: [
        {
          contentId: "iron-sword",
          contentType: "weapon",
          custom: { durability: 40 },
          entryId: "sword-a",
          quantity: 1,
        },
      ],
    })
  })
})

describe("WizEquipmentLoadout", () => {
  it("content IDではなく固有entry IDをslotへ装備する", () => {
    const inventory = WizInventory.create({
      capacity: 3,
      entries: [firstSword, secondSword] as const,
    })
    const loadout = WizEquipmentLoadout.create(inventory, ["mainHand", "offHand"] as const)
      .equip("mainHand", "sword-a", inventory)
      .equip("offHand", "sword-b", inventory)

    expect(loadout.entryAt("mainHand")).toBe("sword-a")
    expect(loadout.entryAt("offHand")).toBe("sword-b")

    const verifyLiteralIds = (): void => {
      // @ts-expect-error 宣言していないslotは利用できない。
      loadout.equip("head", "sword-a", inventory)
      // @ts-expect-error inventoryに存在しないentry IDは利用できない。
      loadout.equip("mainHand", "missing", inventory)
    }
    void verifyLiteralIds
  })

  it("失われたentryをreconcileでslotから外す", () => {
    const inventory = WizInventory.create({
      capacity: 2,
      entries: [firstSword, secondSword] as const,
    })
    const loadout = WizEquipmentLoadout.create(inventory, ["mainHand"] as const).equip(
      "mainHand",
      "sword-a",
      inventory,
    )
    const reconciled = loadout.reconcile(inventory.remove("sword-a"))

    expect(reconciled.entryAt("mainHand")).toBeNull()
  })

  it("復元時にinventory参照を検証する", () => {
    const inventory = WizInventory.create({
      capacity: 1,
      entries: [firstSword] as const,
    })

    expect(() =>
      WizEquipmentLoadout.fromUnknown(inventory, ["mainHand"] as const, {
        mainHand: "missing",
      }),
    ).toThrow()
  })

  it("公開factoryを通らないInventoryを拒否する", () => {
    const forgedInventory = Object.create(WizInventory.prototype) as WizInventory<typeof firstSword>

    expect(() => WizEquipmentLoadout.create(forgedInventory, ["mainHand"] as const)).toThrow(
      TypeError,
    )
  })
})
