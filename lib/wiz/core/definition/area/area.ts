import { z } from "zod"
import { zWizContentAreaUnlockCondition } from "@/lib/wiz/core/definition/area/area-unlock-condition"

export const zWizContentArea = z.strictObject({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  dangerLevel: z.number().finite().nonnegative(),
  apCost: z.number().finite().nonnegative(),
  unlocked: z.boolean(),
  unlockCondition: zWizContentAreaUnlockCondition.optional(),
  availableGathering: z.array(z.string()),
  monsterIds: z.array(z.string()),
  eventIds: z.array(z.string()),
})

export type WizContentArea = z.infer<typeof zWizContentArea>
