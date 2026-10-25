import { z } from "zod"
import { zWizId, zWizRequirements } from "@/lib/wiz/core/types"
import { zWizSeason, zWizTimeOfDay, zWizWeather } from "@/lib/wiz/core/types/time"

const zWizContentDialogueSemanticToken = z
  .string()
  .refine(
    (value) => value.trim().length > 0 && value === value.trim(),
    "must be a non-blank string without surrounding whitespace",
  )

const addDuplicateStringIssues = (
  values: readonly string[] | undefined,
  path: string,
  context: z.RefinementCtx,
): void => {
  const firstIndexByValue = new Map<string, number>()
  values?.forEach((value, index) => {
    const firstIndex = firstIndexByValue.get(value)
    if (firstIndex === undefined) {
      firstIndexByValue.set(value, index)
      return
    }
    context.addIssue({
      code: "custom",
      path: [path, index],
      message: `duplicate value; first declared at index ${firstIndex}`,
    })
  })
}

const addDuplicateItemIssues = (
  values: readonly Readonly<{ itemId: string }>[] | undefined,
  path: string,
  context: z.RefinementCtx,
): void => {
  const firstIndexByItemId = new Map<string, number>()
  values?.forEach((value, index) => {
    const firstIndex = firstIndexByItemId.get(value.itemId)
    if (firstIndex === undefined) {
      firstIndexByItemId.set(value.itemId, index)
      return
    }
    context.addIssue({
      code: "custom",
      path: [path, index, "itemId"],
      message: `duplicate item ID; first declared at index ${firstIndex}`,
    })
  })
}

export const zWizContentDialogueRequirements = zWizRequirements
  .safeExtend({
    requiredFlags: z.array(zWizContentDialogueSemanticToken).optional(),
    forbiddenFlags: z.array(zWizContentDialogueSemanticToken).optional(),
    requiredItems: z
      .array(
        z.strictObject({
          itemId: zWizId,
          quantity: z.number().finite().int().positive(),
        }),
      )
      .optional(),
  })
  .superRefine((requirements, context) => {
    if (
      requirements.minLevel !== undefined &&
      requirements.maxLevel !== undefined &&
      requirements.minLevel > requirements.maxLevel
    ) {
      context.addIssue({
        code: "custom",
        path: ["minLevel"],
        message: "minLevel must be less than or equal to maxLevel",
      })
    }
    if (
      requirements.minAffinity !== undefined &&
      requirements.maxAffinity !== undefined &&
      requirements.minAffinity > requirements.maxAffinity
    ) {
      context.addIssue({
        code: "custom",
        path: ["minAffinity"],
        message: "minAffinity must be less than or equal to maxAffinity",
      })
    }

    addDuplicateStringIssues(requirements.requiredFlags, "requiredFlags", context)
    addDuplicateStringIssues(requirements.forbiddenFlags, "forbiddenFlags", context)
    addDuplicateItemIssues(requirements.requiredItems, "requiredItems", context)

    const forbiddenFlags = new Set(requirements.forbiddenFlags ?? [])
    requirements.requiredFlags?.forEach((flag, index) => {
      if (!forbiddenFlags.has(flag)) return
      context.addIssue({
        code: "custom",
        path: ["requiredFlags", index],
        message: "a flag cannot be both required and forbidden",
      })
    })
  })

export const zWizContentDialogueLine = z.strictObject({
  speaker: z.string(),
  text: z.string(),
  emotion: z.string().optional(),
  portrait: z.string().optional(),
})

export type WizContentDialogueLine = z.infer<typeof zWizContentDialogueLine>

export const zWizContentDialogueEffects = z
  .strictObject({
    affinityChange: z.number().finite().optional(),
    giveItems: z
      .array(
        z.strictObject({
          itemId: zWizId,
          quantity: z.number().finite().int().positive(),
        }),
      )
      .optional(),
    takeItems: z
      .array(
        z.strictObject({
          itemId: zWizId,
          quantity: z.number().finite().int().positive(),
        }),
      )
      .optional(),
    setFlags: z.array(zWizContentDialogueSemanticToken).optional(),
    removeFlags: z.array(zWizContentDialogueSemanticToken).optional(),
    startQuest: zWizId.optional(),
    completeQuest: zWizId.optional(),
    unlockDialogue: zWizId.optional(),
  })
  .superRefine((effects, context) => {
    addDuplicateItemIssues(effects.giveItems, "giveItems", context)
    addDuplicateItemIssues(effects.takeItems, "takeItems", context)
    addDuplicateStringIssues(effects.setFlags, "setFlags", context)
    addDuplicateStringIssues(effects.removeFlags, "removeFlags", context)

    const removedFlags = new Set(effects.removeFlags ?? [])
    effects.setFlags?.forEach((flag, index) => {
      if (!removedFlags.has(flag)) return
      context.addIssue({
        code: "custom",
        path: ["setFlags", index],
        message: "a flag cannot be both set and removed",
      })
    })
  })

export type WizContentDialogueEffects = z.infer<typeof zWizContentDialogueEffects>

export const zWizContentDialogueTriggers = z
  .strictObject({
    afterQuest: zWizId.optional(),
    timeOfDay: z.array(zWizTimeOfDay).optional(),
    weather: z.array(zWizWeather).optional(),
    season: z.array(zWizSeason).optional(),
  })
  .superRefine((triggers, context) => {
    addDuplicateStringIssues(triggers.timeOfDay, "timeOfDay", context)
    addDuplicateStringIssues(triggers.weather, "weather", context)
    addDuplicateStringIssues(triggers.season, "season", context)
  })

export type WizContentDialogueTriggers = z.infer<typeof zWizContentDialogueTriggers>

export const zWizContentDialogueOption = z.strictObject({
  id: zWizId,
  text: z.string(),
  responseDialogueId: zWizId.optional(),
  affinityChange: z.number().finite().optional(),
  requirements: zWizContentDialogueRequirements.optional(),
  effects: zWizContentDialogueEffects.optional(),
})

export type WizContentDialogueOption = z.infer<typeof zWizContentDialogueOption>

export const zWizContentDialogue = z
  .strictObject({
    id: zWizId,
    minAffinity: z.number().finite().default(0),
    maxAffinity: z.number().finite().optional(),
    lines: z.array(zWizContentDialogueLine),
    options: z.array(zWizContentDialogueOption).optional(),
    triggers: zWizContentDialogueTriggers.optional(),
    requirements: zWizContentDialogueRequirements.optional(),
  })
  .superRefine((dialogue, context) => {
    if (dialogue.maxAffinity !== undefined && dialogue.minAffinity > dialogue.maxAffinity) {
      context.addIssue({
        code: "custom",
        path: ["minAffinity"],
        message: "minAffinity must be less than or equal to maxAffinity",
      })
    }
  })

export type WizContentDialogue = z.infer<typeof zWizContentDialogue>

// JSON 入力用スキーマ (lines が文字列配列の簡易形式)
export const zWizContentDialogueInput = z
  .strictObject({
    id: zWizId,
    minAffinity: z.number().finite(),
    maxAffinity: z.number().finite().optional(),
    lines: z.array(z.string()),
    timeOfDay: z.array(zWizTimeOfDay).optional(),
    weather: z.array(zWizWeather).optional(),
    season: z.array(zWizSeason).optional(),
    afterQuest: zWizId.optional(),
  })
  .superRefine((dialogue, context) => {
    if (dialogue.maxAffinity !== undefined && dialogue.minAffinity > dialogue.maxAffinity) {
      context.addIssue({
        code: "custom",
        path: ["minAffinity"],
        message: "minAffinity must be less than or equal to maxAffinity",
      })
    }
    addDuplicateStringIssues(dialogue.timeOfDay, "timeOfDay", context)
    addDuplicateStringIssues(dialogue.weather, "weather", context)
    addDuplicateStringIssues(dialogue.season, "season", context)
  })

export type WizContentDialogueInput = z.infer<typeof zWizContentDialogueInput>

/**
 * NPC content が受け付ける会話定義。
 *
 * 文字列 lines の簡易形式と runtime の完全形式を共存させる。どちらも strict schema
 * なので、形式を混在させた入力や未宣言 field は受理しない。
 */
export const zWizContentDialogueDefinition = z.union([
  zWizContentDialogue,
  zWizContentDialogueInput,
])

export type WizContentDialogueDefinition = z.infer<typeof zWizContentDialogueDefinition>
