import { z } from "zod"
import { zWizContentEventChoice } from "@/lib/wiz/core/definition/event/event-choice"
import { zWizContentEventPenalty } from "@/lib/wiz/core/definition/event/event-penalty"
import { zWizContentEventReward } from "@/lib/wiz/core/definition/event/event-reward"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import {
  zWizVaultNonnegativeNumber,
  zWizVaultPositiveNumber,
  zWizVaultPositiveInteger,
  zWizVaultSemanticId,
} from "@/lib/wiz/core/vault/states/schema-values"

const zWizVaultEventReward = zWizContentEventReward.safeExtend({
  gold: zWizVaultNonnegativeNumber.optional(),
  exp: zWizVaultNonnegativeNumber.optional(),
  items: z
    .array(
      z.strictObject({
        itemId: zWizVaultSemanticId,
        quantity: zWizVaultPositiveInteger,
      })
    )
    .optional(),
})

const zWizVaultEventPenalty = zWizContentEventPenalty.safeExtend({
  hpLoss: zWizVaultNonnegativeNumber.optional(),
  goldLoss: zWizVaultNonnegativeNumber.optional(),
  hungerLoss: zWizVaultNonnegativeNumber.optional(),
})

const zWizVaultEventChoice = zWizContentEventChoice.safeExtend({
  difficulty: zWizVaultPositiveNumber.optional(),
  successReward: zWizVaultEventReward.optional(),
  failPenalty: zWizVaultEventPenalty.optional(),
})

export const WizVaultEventStateSchema = z.strictObject({
  id: zWizVaultSemanticId,
  description: z.string(),
  choices: z.array(zWizVaultEventChoice),
})

export type WizVaultEventState = WizDeepReadonly<
  z.infer<typeof WizVaultEventStateSchema>
>
