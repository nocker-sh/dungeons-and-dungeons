import { z } from "zod"
import type { WizInventoryEntryDefinition } from "@/lib/wiz/core/domain/values/inventory"

export const semanticId = z
  .string()
  .min(1)
  .refine(
    (value) => value === value.trim(),
    "ID must not have surrounding whitespace"
  )

export const positiveQuantity = z.number().int().positive().safe()

export const createWizInventoryEntryStateSchema = <TContentType extends string>(
  contentType: z.ZodType<TContentType>
): z.ZodType<
  WizInventoryEntryDefinition<string, TContentType, string, unknown>
> =>
  z.strictObject({
    entryId: semanticId,
    contentType,
    contentId: semanticId,
    quantity: positiveQuantity,
    custom: z.unknown().optional(),
  })
