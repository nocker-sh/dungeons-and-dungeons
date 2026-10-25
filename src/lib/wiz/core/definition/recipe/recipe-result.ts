import { z } from "zod"

export const zWizContentRecipeResult = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("item"), itemId: z.string() }),
  z.strictObject({ type: z.literal("weapon"), weaponId: z.string() }),
  z.strictObject({ type: z.literal("armor"), armorId: z.string() }),
])

export type WizContentRecipeResult = z.infer<typeof zWizContentRecipeResult>
