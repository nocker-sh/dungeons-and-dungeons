import { z } from "zod"
import { zWizContentAreaUnlockCondition } from "@/lib/wiz/core/definition/area/area-unlock-condition"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizVaultEventStateSchema } from "@/lib/wiz/core/vault/states/event/schema"
import { WizVaultMonsterStateSchema } from "@/lib/wiz/core/vault/states/monster/schema"
import {
  zWizVaultNonBlankString,
  zWizVaultNonnegativeNumber,
  zWizVaultSemanticId,
} from "@/lib/wiz/core/vault/states/schema-values"

const zWizVaultAreaUnlockCondition = zWizContentAreaUnlockCondition.safeExtend({
  areaId: zWizVaultSemanticId,
  requiredProgress: zWizVaultNonnegativeNumber.max(100),
})

export const WizVaultAreaStateSchema = z.strictObject({
  id: zWizVaultSemanticId,
  name: zWizVaultNonBlankString,
  description: z.string(),
  dangerLevel: zWizVaultNonnegativeNumber,
  apCost: zWizVaultNonnegativeNumber,
  progress: zWizVaultNonnegativeNumber.max(100),
  unlocked: z.boolean(),
  unlockCondition: zWizVaultAreaUnlockCondition.optional(),
  availableGathering: z.array(zWizVaultSemanticId),
  monsters: z.array(WizVaultMonsterStateSchema),
  events: z.array(WizVaultEventStateSchema),
})

export type WizVaultAreaState = WizDeepReadonly<
  z.infer<typeof WizVaultAreaStateSchema>
>
