import { z } from "zod"
import type {
  WizInventoryEntryDefinition,
  WizInventoryState,
} from "@/lib/wiz/core/domain/values/inventory"
import { createWizInventoryEntryStateSchema } from "@/lib/wiz/core/domain/values/create-wiz-inventory-entry-state-schema"

export const nonnegativeCapacity = z.number().int().nonnegative().safe()

export const createWizInventoryStateSchema = <TContentType extends string>(
  contentType: z.ZodType<TContentType>
): z.ZodType<
  WizInventoryState<
    WizInventoryEntryDefinition<string, TContentType, string, unknown>
  >
> =>
  z
    .strictObject({
      capacity: nonnegativeCapacity,
      entries: z.array(createWizInventoryEntryStateSchema(contentType)),
    })
    .superRefine((inventory, context) => {
      if (inventory.entries.length > inventory.capacity) {
        context.addIssue({
          code: "custom",
          path: ["entries"],
          message: `inventory.entries length must not exceed inventory.capacity; received ${inventory.entries.length} > ${inventory.capacity}`,
        })
      }
      const firstIndexByEntryId = new Map<string, number>()
      for (const [index, entry] of inventory.entries.entries()) {
        const firstIndex = firstIndexByEntryId.get(entry.entryId)
        if (firstIndex === undefined) {
          firstIndexByEntryId.set(entry.entryId, index)
          continue
        }
        context.addIssue({
          code: "custom",
          path: ["entries", index, "entryId"],
          message: `duplicate inventory entry ID; first declared at entries[${firstIndex}].entryId`,
        })
      }
    })
