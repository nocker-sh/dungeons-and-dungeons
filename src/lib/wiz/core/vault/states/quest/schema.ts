import { z } from "zod"
import {
  type WizContentQuestRewardEntry,
  zWizContentQuestReward,
} from "@/lib/wiz/core/definition/quest/quest"
import type { WizId } from "@/lib/wiz/core/types"
import {
  zWizVaultNonBlankString,
  zWizVaultNonnegativeInteger,
  zWizVaultNonnegativeNumber,
  zWizVaultPositiveInteger,
  zWizVaultSemanticId,
} from "@/lib/wiz/core/vault/states/schema-values"

// クエスト目標の状態
export type WizVaultQuestObjectiveState =
  | {
      readonly type: "defeat"
      readonly monsterId: WizId
      readonly count: number
      readonly current: number
    }
  | {
      readonly type: "gather"
      readonly itemId: WizId
      readonly count: number
      readonly current: number
    }
  | {
      readonly type: "explore"
      readonly areaId: WizId
      readonly requiredProgress: number
    }
  | {
      readonly type: "deliver"
      readonly itemId: WizId
      readonly npcId: WizId
    }

// クエスト報酬の状態
export type WizVaultQuestRewardState = {
  readonly gold: number
  readonly exp: number
  readonly affinityBonus: number
  readonly items?: readonly WizContentQuestRewardEntry[]
}

// クエストの状態 (Vault に保存)
export type WizVaultQuestState = {
  readonly id: WizId
  readonly name: string
  readonly description: string
  readonly giverNpcId: WizId
  readonly objective: WizVaultQuestObjectiveState
  readonly reward: WizVaultQuestRewardState
  readonly completed: boolean
  readonly accepted: boolean
  readonly nextQuestId?: WizId
}

export const WizVaultQuestObjectiveStateSchema: z.ZodType<WizVaultQuestObjectiveState> = z
  .discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("defeat"),
      monsterId: zWizVaultSemanticId,
      count: zWizVaultPositiveInteger,
      current: zWizVaultNonnegativeInteger,
    }),
    z.strictObject({
      type: z.literal("gather"),
      itemId: zWizVaultSemanticId,
      count: zWizVaultPositiveInteger,
      current: zWizVaultNonnegativeInteger,
    }),
    z.strictObject({
      type: z.literal("explore"),
      areaId: zWizVaultSemanticId,
      requiredProgress: zWizVaultNonnegativeNumber.max(100),
    }),
    z.strictObject({
      type: z.literal("deliver"),
      itemId: zWizVaultSemanticId,
      npcId: zWizVaultSemanticId,
    }),
  ])
  .superRefine((objective, context) => {
    if ("current" in objective && objective.current > objective.count) {
      context.addIssue({
        code: "custom",
        path: ["current"],
        message: "objective.current must be less than or equal to objective.count",
      })
    }
  })

const zWizVaultQuestRewardEntry = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("item"),
    itemId: zWizVaultSemanticId,
    quantity: zWizVaultPositiveInteger,
  }),
  z.strictObject({
    type: z.literal("weapon"),
    weaponId: zWizVaultSemanticId,
    quantity: zWizVaultPositiveInteger,
  }),
  z.strictObject({
    type: z.literal("armor"),
    armorId: zWizVaultSemanticId,
    quantity: zWizVaultPositiveInteger,
  }),
]) satisfies z.ZodType<WizContentQuestRewardEntry>

export const WizVaultQuestRewardStateSchema: z.ZodType<WizVaultQuestRewardState> =
  zWizContentQuestReward.safeExtend({
    gold: zWizVaultNonnegativeNumber,
    exp: zWizVaultNonnegativeNumber,
    affinityBonus: zWizVaultNonnegativeNumber,
    items: z.array(zWizVaultQuestRewardEntry).optional(),
  })

export const WizVaultQuestStateSchema: z.ZodType<WizVaultQuestState> = z.strictObject({
  id: zWizVaultSemanticId,
  name: zWizVaultNonBlankString,
  description: z.string(),
  giverNpcId: zWizVaultSemanticId,
  objective: WizVaultQuestObjectiveStateSchema,
  reward: WizVaultQuestRewardStateSchema,
  completed: z.boolean(),
  accepted: z.boolean(),
  nextQuestId: zWizVaultSemanticId.optional(),
})
