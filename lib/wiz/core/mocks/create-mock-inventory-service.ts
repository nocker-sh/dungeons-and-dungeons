import { WizStandardInventoryService } from "@/lib/wiz/core/rpg/standard-inventory"
import type { WizStandardInventoryState } from "@/lib/wiz/core/vault/types"

export const createMockInventoryService = (
  initial?: Pick<WizStandardInventoryState, "entries">,
  entryIdPrefix = "test-entry"
): WizStandardInventoryService => {
  const occupiedEntryIds = new Set(
    initial?.entries.map((entry) => entry.entryId) ?? []
  )
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
