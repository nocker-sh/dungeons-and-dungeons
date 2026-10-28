import { z } from "zod"
import { zWizContentConsumableEffect } from "@/lib/wiz/core/definition/item/consumable-effect"
import { zWizContentItemType } from "@/lib/wiz/core/definition/item/item-type"

export const zWizContentItem = z.strictObject({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  itemType: zWizContentItemType,
  price: z.number().finite().nonnegative(),
  sellPrice: z.number().finite().nonnegative(),
  effect: zWizContentConsumableEffect.optional(),
})

export type WizContentItem = z.infer<typeof zWizContentItem>
