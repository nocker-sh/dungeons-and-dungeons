import { z } from "zod"

export const zWizContentArmor = z.strictObject({
  id: z.string(),
  slotId: z.string().trim().min(1),
  name: z.string(),
  description: z.string(),
  defense: z.number().finite().nonnegative(),
  agilityPenalty: z.number().finite(),
  price: z.number().finite().nonnegative(),
  sellPrice: z.number().finite().nonnegative(),
})

export type WizContentArmor = z.infer<typeof zWizContentArmor>
