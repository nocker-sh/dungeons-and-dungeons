import { z } from "zod"

export const zWizContentMonsterDrop = z.strictObject({
  itemId: z.string(),
  chance: z.number().finite().min(0).max(100),
})

export type WizContentMonsterDrop = z.infer<typeof zWizContentMonsterDrop>
