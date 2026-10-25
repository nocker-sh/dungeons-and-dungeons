import { z } from "zod"
import { zWizContentMonsterDrop } from "@/lib/wiz/core/definition/monster/monster-drop"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import {
  addWizVaultUpperBoundIssue,
  zWizVaultNonBlankString,
  zWizVaultNonnegativeNumber,
  zWizVaultSemanticId,
} from "@/lib/wiz/core/vault/states/schema-values"

const zWizVaultMonsterDrop = zWizContentMonsterDrop.safeExtend({
  itemId: zWizVaultSemanticId,
  chance: zWizVaultNonnegativeNumber.max(100),
})

export const WizVaultMonsterStateSchema = z
  .strictObject({
    id: zWizVaultSemanticId,
    name: zWizVaultNonBlankString,
    hp: zWizVaultNonnegativeNumber,
    maxHp: zWizVaultNonnegativeNumber,
    attack: zWizVaultNonnegativeNumber,
    defense: zWizVaultNonnegativeNumber,
    agility: zWizVaultNonnegativeNumber,
    expReward: zWizVaultNonnegativeNumber,
    goldReward: zWizVaultNonnegativeNumber,
    drops: z.array(zWizVaultMonsterDrop),
  })
  .superRefine((monster, context) => {
    addWizVaultUpperBoundIssue(context, ["hp"], "hp", monster.hp, "maxHp", monster.maxHp)
  })

export type WizVaultMonsterState = WizDeepReadonly<z.infer<typeof WizVaultMonsterStateSchema>>
