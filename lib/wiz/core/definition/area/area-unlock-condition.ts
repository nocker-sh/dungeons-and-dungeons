import { z } from "zod"

export const zWizContentAreaUnlockCondition = z.strictObject({
  areaId: z.string(),
  requiredProgress: z.number().finite().min(0).max(100),
})

export type WizContentAreaUnlockCondition = z.infer<typeof zWizContentAreaUnlockCondition>
