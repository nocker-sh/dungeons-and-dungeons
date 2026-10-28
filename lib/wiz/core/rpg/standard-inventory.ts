import {
  WizInventoryRules,
  WizInventoryTransaction,
} from "@/lib/wiz/core/domain/services/inventory-transaction"
import {
  WizInventory,
  WizInventoryEntry,
} from "@/lib/wiz/core/domain/values/inventory"
import { assertFiniteNumberValue } from "@/lib/wiz/core/assert-finite-number-value"
import type { WizStandardInventoryContentType } from "@/lib/wiz/core/vault/types"

export type WizStandardInventoryEntry = WizInventoryEntry<
  string,
  WizStandardInventoryContentType,
  string,
  unknown
>

const standardInventoryRules =
  WizInventoryRules.create<WizStandardInventoryEntry>({
    canStack: (left, right) =>
      left.contentType === "item" &&
      right.contentType === "item" &&
      left.contentId === right.contentId &&
      left.custom === undefined &&
      right.custom === undefined,
    maximumQuantity: (entry) =>
      entry.contentType === "item" ? Number.MAX_SAFE_INTEGER : 1,
  })
const standardInventoryTransaction = new WizInventoryTransaction(
  standardInventoryRules
)

/**
 * 標準RPGのitem stackと固有equipment entryを正規inventory上で操作するservice。
 */
export class WizStandardInventoryService {
  private readonly nextEntryId: () => string

  constructor(nextEntryId: () => string) {
    if (typeof nextEntryId !== "function") {
      throw new TypeError("Standard inventory service requires nextEntryId")
    }
    this.nextEntryId = nextEntryId
    Object.freeze(this)
  }

  add(
    inventory: WizInventory<WizStandardInventoryEntry>,
    contentType: WizStandardInventoryContentType,
    contentId: string,
    quantity = 1
  ): WizInventory<WizStandardInventoryEntry> {
    this.assertQuantity(quantity)
    const existingItemStack =
      contentType === "item" &&
      inventory.entriesFor(contentType, contentId).length > 0
    const requiredEntries = existingItemStack
      ? 0
      : contentType === "item"
        ? 1
        : quantity
    if (inventory.entries.length + requiredEntries > inventory.capacity) {
      throw new RangeError("Standard inventory capacity is insufficient")
    }
    let result = inventory
    if (contentType === "item") {
      return standardInventoryTransaction.add(
        result,
        WizInventoryEntry.define({
          entryId: this.nextEntryId(),
          contentType,
          contentId,
          quantity,
        })
      )
    }
    for (let index = 0; index < quantity; index += 1) {
      result = standardInventoryTransaction.add(
        result,
        WizInventoryEntry.define({
          entryId: this.nextEntryId(),
          contentType,
          contentId,
          quantity: 1,
        })
      )
    }
    return result
  }

  consume(
    inventory: WizInventory<WizStandardInventoryEntry>,
    contentType: WizStandardInventoryContentType,
    contentId: string,
    quantity = 1
  ): WizInventory<WizStandardInventoryEntry> {
    this.assertQuantity(quantity)
    const entries = inventory.entriesFor(contentType, contentId)
    if (
      entries.reduce((total, entry) => total + entry.quantity, 0) < quantity
    ) {
      throw new RangeError(
        `Standard inventory requires ${quantity} of "${contentType}:${contentId}"`
      )
    }
    let remaining = quantity
    const costs = entries.flatMap((entry) => {
      if (remaining === 0) return []
      const consumed = Math.min(remaining, entry.quantity)
      remaining -= consumed
      return [{ entryId: entry.entryId, quantity: consumed }]
    })
    return standardInventoryTransaction.consumeMany(inventory, costs)
  }

  quantity(
    inventory: WizInventory<WizStandardInventoryEntry>,
    contentType: WizStandardInventoryContentType,
    contentId: string
  ): number {
    return inventory.totalQuantity(contentType, contentId)
  }

  private assertQuantity(quantity: number): void {
    assertFiniteNumberValue("inventory", "standard.quantity", quantity, {
      minimum: 1,
      safeInteger: true,
    })
  }
}

Object.freeze(WizStandardInventoryService.prototype)
Object.freeze(WizStandardInventoryService)
