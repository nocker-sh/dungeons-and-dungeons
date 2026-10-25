import { describe, expect, it } from "vite-plus/test"
import { WizInventory } from "@/lib/wiz/core/domain/values/inventory"
import {
  type WizStandardInventoryEntry,
  WizStandardInventoryService,
} from "@/lib/wiz/core/rpg/standard-inventory"

const createService = () => {
  let sequence = 0
  return new WizStandardInventoryService(() => `entry-${(sequence += 1)}`)
}

describe("WizStandardInventoryService", () => {
  it("itemはstackしequipmentは固有entryとして追加する", () => {
    const service = createService()
    const initial = WizInventory.create({
      capacity: 5,
      entries: [] as readonly WizStandardInventoryEntry[],
    })
    const result = service.add(initial, "item", "herb", 2)
    const withMoreItems = service.add(result, "item", "herb", 3)
    const withWeapons = service.add(withMoreItems, "weapon", "blade", 2)

    expect(withWeapons.totalQuantity("item", "herb")).toBe(5)
    expect(withWeapons.entriesFor("item", "herb")).toHaveLength(1)
    expect(withWeapons.entriesFor("weapon", "blade")).toHaveLength(2)
  })

  it("複数entryをまたいでcontent数量を原子的に消費する", () => {
    const service = createService()
    const inventory = service.add(
      service.add(
        WizInventory.create({
          capacity: 4,
          entries: [] as readonly WizStandardInventoryEntry[],
        }),
        "weapon",
        "blade",
        2,
      ),
      "item",
      "herb",
      3,
    )
    const result = service.consume(
      service.consume(inventory, "weapon", "blade", 2),
      "item",
      "herb",
      2,
    )

    expect(result.totalQuantity("weapon", "blade")).toBe(0)
    expect(result.totalQuantity("item", "herb")).toBe(1)
    expect(() => service.consume(result, "item", "herb", 2)).toThrow(RangeError)
    expect(result.totalQuantity("item", "herb")).toBe(1)
  })
})
