import { z } from "zod"

export const zWizContentEventPenalty = z.strictObject({
  hpLoss: z.number().finite().nonnegative().optional(),
  goldLoss: z.number().finite().nonnegative().optional(),
  hungerLoss: z.number().finite().nonnegative().optional(),
})

export type WizContentEventPenalty = z.infer<typeof zWizContentEventPenalty>
