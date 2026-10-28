import type { WizStandardInventoryContentType } from "@/lib/wiz/core/vault/types"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"
import { createMockInventoryService } from "@/lib/wiz/core/mocks/create-mock-inventory-service"

export type MockInventoryContent = {
  readonly contentType: WizStandardInventoryContentType
  readonly contentId: string
  readonly quantity?: number
}

export const withMockInventory = (
  vault: WizVaultValue,
  contents: readonly MockInventoryContent[]
): WizVaultValue => {
  const inventoryService = createMockInventoryService(vault.toPlain().inventory)
  return contents.reduce(
    (current, content) =>
      current.updateInventory((inventory) =>
        inventoryService.add(
          inventory,
          content.contentType,
          content.contentId,
          content.quantity ?? 1
        )
      ),
    vault
  )
}
