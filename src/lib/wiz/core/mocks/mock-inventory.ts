import { WizStandardInventoryService } from "@/lib/wiz/core/rpg/standard-inventory"
import type {
  WizStandardInventoryContentType,
  WizStandardInventoryState,
} from "@/lib/wiz/core/vault/types"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export type MockInventoryContent = {
  readonly contentType: WizStandardInventoryContentType
  readonly contentId: string
  readonly quantity?: number
}

export const createMockInventoryService = (
  initial?: Pick<WizStandardInventoryState, "entries">,
  entryIdPrefix = "test-entry",
): WizStandardInventoryService => {
  const occupiedEntryIds = new Set(initial?.entries.map((entry) => entry.entryId) ?? [])
  let sequence = 0
  return new WizStandardInventoryService(() => {
    let entryId: string
    do {
      sequence += 1
      entryId = `${entryIdPrefix}-${sequence}`
    } while (occupiedEntryIds.has(entryId))
    occupiedEntryIds.add(entryId)
    return entryId
  })
}

export const withMockInventory = (
  vault: WizVaultValue,
  contents: readonly MockInventoryContent[],
): WizVaultValue => {
  const inventoryService = createMockInventoryService(vault.toPlain().inventory)
  return contents.reduce(
    (current, content) =>
      current.updateInventory((inventory) =>
        inventoryService.add(
          inventory,
          content.contentType,
          content.contentId,
          content.quantity ?? 1,
        ),
      ),
    vault,
  )
}
