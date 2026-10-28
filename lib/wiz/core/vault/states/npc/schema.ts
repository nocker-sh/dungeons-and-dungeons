import { z } from "zod"
import {
  zWizContentDialogue,
  zWizContentDialogueEffects,
  zWizContentDialogueOption,
  zWizContentDialogueRequirements,
  zWizContentDialogueTriggers,
} from "@/lib/wiz/core/definition/npc/dialogue"
import { addWizContentNpcGiftPreferenceIssues } from "@/lib/wiz/core/definition/npc/npc"
import { zWizRequirementItem } from "@/lib/wiz/core/types"
import type { WizVaultNpc } from "@/lib/wiz/core/vault/states/npc/type"
import {
  zWizVaultFiniteNumber,
  zWizVaultNonBlankString,
  zWizVaultPositiveInteger,
  zWizVaultSemanticId,
} from "@/lib/wiz/core/vault/states/schema-values"

const zWizVaultRequirementItem = zWizRequirementItem.safeExtend({
  itemId: zWizVaultSemanticId,
  quantity: zWizVaultPositiveInteger,
})

const zWizVaultRequirements = zWizContentDialogueRequirements.safeExtend({
  requiredFlags: z.array(zWizVaultSemanticId).optional(),
  forbiddenFlags: z.array(zWizVaultSemanticId).optional(),
  requiredItems: z.array(zWizVaultRequirementItem).optional(),
  minAffinity: zWizVaultFiniteNumber.optional(),
  maxAffinity: zWizVaultFiniteNumber.optional(),
})

const zWizVaultDialogueEffectItem = z.strictObject({
  itemId: zWizVaultSemanticId,
  quantity: zWizVaultPositiveInteger,
})

const zWizVaultDialogueEffects = zWizContentDialogueEffects.safeExtend({
  affinityChange: zWizVaultFiniteNumber.optional(),
  giveItems: z.array(zWizVaultDialogueEffectItem).optional(),
  takeItems: z.array(zWizVaultDialogueEffectItem).optional(),
  setFlags: z.array(zWizVaultSemanticId).optional(),
  removeFlags: z.array(zWizVaultSemanticId).optional(),
  startQuest: zWizVaultSemanticId.optional(),
  completeQuest: zWizVaultSemanticId.optional(),
  unlockDialogue: zWizVaultSemanticId.optional(),
})

const zWizVaultDialogueTriggers = zWizContentDialogueTriggers.safeExtend({
  afterQuest: zWizVaultSemanticId.optional(),
})

const zWizVaultDialogueOption = zWizContentDialogueOption.safeExtend({
  id: zWizVaultSemanticId,
  responseDialogueId: zWizVaultSemanticId.optional(),
  affinityChange: zWizVaultFiniteNumber.optional(),
  requirements: zWizVaultRequirements.optional(),
  effects: zWizVaultDialogueEffects.optional(),
})

export const WizVaultDialogueSchema = zWizContentDialogue.safeExtend({
  id: zWizVaultSemanticId,
  minAffinity: zWizVaultFiniteNumber,
  maxAffinity: zWizVaultFiniteNumber.optional(),
  options: z.array(zWizVaultDialogueOption).optional(),
  triggers: zWizVaultDialogueTriggers.optional(),
  requirements: zWizVaultRequirements.optional(),
})

/** 現行の Vault が保存する NPC 状態。 */
const zWizVaultGiftPreferences = z
  .strictObject({
    likes: z.array(zWizVaultSemanticId),
    dislikes: z.array(zWizVaultSemanticId),
    likeBonus: zWizVaultFiniteNumber.optional(),
    dislikeBonus: zWizVaultFiniteNumber.optional(),
    neutralBonus: zWizVaultFiniteNumber.optional(),
  })
  .superRefine(addWizContentNpcGiftPreferenceIssues)

export const WizVaultNpcSchema = z.strictObject({
  id: zWizVaultSemanticId,
  name: zWizVaultNonBlankString,
  title: z.string().optional(),
  occupation: z.string().optional(),
  personality: z.string().optional(),
  portrait: z.string().optional(),
  affinity: zWizVaultFiniteNumber,
  dialogues: z.array(WizVaultDialogueSchema),
  giftPreferences: zWizVaultGiftPreferences.optional(),
}) satisfies z.ZodType<WizVaultNpc>
