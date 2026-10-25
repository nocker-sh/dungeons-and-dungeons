import { z } from "zod"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"

export const zWizHungerImpact = z.strictObject({
  actionPointReduction: z.number().finite().nonnegative(),
  abilityPowerMultiplier: z.number().finite().nonnegative(),
  hpLoss: z.number().finite().nonnegative(),
})

export type WizHungerImpact = WizDeepReadonly<z.infer<typeof zWizHungerImpact>>
