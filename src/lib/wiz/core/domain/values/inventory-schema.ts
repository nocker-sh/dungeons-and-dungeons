import { z } from "zod"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type {
  WizEquipmentLoadoutState,
  WizInventoryEntryDefinition,
  WizInventoryState,
} from "@/lib/wiz/core/domain/values/inventory"

const semanticId = z
  .string()
  .min(1)
  .refine((value) => value === value.trim(), "ID must not have surrounding whitespace")
const positiveQuantity = z.number().int().positive().safe()
const nonnegativeCapacity = z.number().int().nonnegative().safe()

export const createWizInventoryEntryStateSchema = <TContentType extends string>(
  contentType: z.ZodType<TContentType>,
): z.ZodType<WizInventoryEntryDefinition<string, TContentType, string, unknown>> =>
  z.strictObject({
    entryId: semanticId,
    contentType,
    contentId: semanticId,
    quantity: positiveQuantity,
    custom: z.unknown().optional(),
  })

export const createWizInventoryStateSchema = <TContentType extends string>(
  contentType: z.ZodType<TContentType>,
): z.ZodType<
  WizInventoryState<WizInventoryEntryDefinition<string, TContentType, string, unknown>>
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

export const WizInventoryEntryStateSchema = createWizInventoryEntryStateSchema(semanticId)
export const WizInventoryStateSchema = createWizInventoryStateSchema(semanticId)

export const WizEquipmentLoadoutStateSchema = z.record(
  semanticId,
  semanticId.nullable(),
) satisfies z.ZodType<WizEquipmentLoadoutState>

export type WizInventoryEntryState = WizDeepReadonly<z.infer<typeof WizInventoryEntryStateSchema>>
