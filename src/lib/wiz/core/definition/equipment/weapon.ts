import { z } from "zod"

export const zWizContentWeapon = z.strictObject({
  id: z.string(),
  slotId: z.string().trim().min(1),
  name: z.string(),
  description: z.string(),
  attack: z.number().finite().nonnegative(),
  dexterityBonus: z.number().finite(),
  price: z.number().finite().nonnegative(),
  sellPrice: z.number().finite().nonnegative(),
})

export type WizContentWeapon = z.infer<typeof zWizContentWeapon>
