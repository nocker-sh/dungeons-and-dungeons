import { z } from "zod"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"

const zWizContentShopSemanticToken = z
  .string()
  .refine(
    (value) => value.trim().length > 0 && value === value.trim(),
    "must be a non-blank string without surrounding whitespace"
  )

const zWizContentShopDialogueLine = z.strictObject({
  speaker: z.enum(["shopkeeper", "player"]),
  text: z.string(),
})

const zWizContentShopDialogueCondition = z
  .strictObject({
    minAffinity: z.number().finite().optional(),
    flag: zWizContentShopSemanticToken.optional(),
    hasItem: z.string().optional(),
    minLevel: z.number().finite().int().nonnegative().optional(),
    maxLevel: z.number().finite().int().nonnegative().optional(),
  })
  .superRefine((condition, context) => {
    if (
      condition.minLevel !== undefined &&
      condition.maxLevel !== undefined &&
      condition.minLevel > condition.maxLevel
    ) {
      context.addIssue({
        code: "custom",
        path: ["minLevel"],
        message: "minLevel must be less than or equal to maxLevel",
      })
    }
  })

const zWizContentShopDialogueEffects = z.strictObject({
  setFlag: zWizContentShopSemanticToken.optional(),
  giveHint: zWizContentShopSemanticToken.optional(),
})

export const zWizContentShopProducts = z
  .strictObject({
    itemIds: z.array(z.string()).readonly(),
    weaponIds: z.array(z.string()).readonly(),
    armorIds: z.array(z.string()).readonly(),
  })
  .readonly()

export const zWizContentShopDialogueTopic = z.strictObject({
  id: z.string(),
  label: z.string(),
  condition: zWizContentShopDialogueCondition.optional(),
  lines: z.array(zWizContentShopDialogueLine).min(1),
  effects: zWizContentShopDialogueEffects.optional(),
})

export const zWizContentShopDialogue = z.strictObject({
  shopId: z.string(),
  shopkeeperName: z.string(),
  greeting: z.string(),
  buyPriceModifier: z.number().finite().nonnegative().optional(),
  products: zWizContentShopProducts,
  topics: z.array(zWizContentShopDialogueTopic),
})

export const zWizContentShopDialogues = z.array(zWizContentShopDialogue)

export type WizContentShopProducts = WizDeepReadonly<
  z.infer<typeof zWizContentShopProducts>
>
export type WizContentShopDialogue = WizDeepReadonly<
  z.infer<typeof zWizContentShopDialogue>
>
export type WizContentShopDialogueTopic = WizDeepReadonly<
  z.infer<typeof zWizContentShopDialogueTopic>
>
