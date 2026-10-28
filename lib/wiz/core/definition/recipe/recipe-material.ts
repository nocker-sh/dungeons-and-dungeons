import { z } from "zod"

/** Type-safe reference to a material consumed by a recipe. */
export const zWizContentRecipeMaterial = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("item"),
    itemId: z.string(),
    quantity: z.number().finite().int().positive(),
  }),
  z.strictObject({
    type: z.literal("weapon"),
    weaponId: z.string(),
    quantity: z.number().finite().int().positive(),
  }),
  z.strictObject({
    type: z.literal("armor"),
    armorId: z.string(),
    quantity: z.number().finite().int().positive(),
  }),
])

export type WizContentRecipeMaterial = z.infer<typeof zWizContentRecipeMaterial>
