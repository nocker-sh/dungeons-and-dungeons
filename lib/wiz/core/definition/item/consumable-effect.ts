import { z } from "zod"
import {
  WIZ_ITEM_EFFECT_TYPE,
  type WizItemEffectDefinition,
} from "@/lib/wiz/core/types/item-effect"

const zWizContentEffectAmount = z.number().finite().nonnegative()
const zWizContentPositiveEffectAmount = z.number().finite().positive()
const zWizContentEffectDuration = z.number().finite().int().positive()
const zWizContentEffectName = z
  .string()
  .refine(
    (value) => value.trim().length > 0 && value === value.trim(),
    "must be a non-blank string without surrounding whitespace",
  )

export const zWizContentConsumableEffect: z.ZodType<WizItemEffectDefinition> = z.discriminatedUnion(
  "type",
  [
    // Recovery
    z.strictObject({
      type: z.literal(WIZ_ITEM_EFFECT_TYPE.heal),
      value: zWizContentEffectAmount,
    }),
    z.strictObject({
      type: z.literal(WIZ_ITEM_EFFECT_TYPE.restoreMp),
      value: zWizContentEffectAmount,
    }),
    z.strictObject({
      type: z.literal(WIZ_ITEM_EFFECT_TYPE.food),
      hungerRestore: zWizContentEffectAmount,
      healValue: zWizContentEffectAmount.optional(),
    }),
    z.strictObject({
      type: z.literal(WIZ_ITEM_EFFECT_TYPE.revive),
      value: zWizContentPositiveEffectAmount.optional(),
    }),

    // Status cure
    z.strictObject({
      type: z.literal(WIZ_ITEM_EFFECT_TYPE.cure),
      effectId: zWizContentEffectName.optional(),
    }),

    // Buffs
    z.strictObject({
      type: z.literal(WIZ_ITEM_EFFECT_TYPE.buff),
      stat: zWizContentEffectName,
      value: zWizContentPositiveEffectAmount,
      duration: zWizContentEffectDuration,
    }),
    // Combat
    z.strictObject({
      type: z.literal(WIZ_ITEM_EFFECT_TYPE.damage),
      value: zWizContentPositiveEffectAmount,
      element: zWizContentEffectName.optional(),
    }),
    z.strictObject({
      type: z.literal(WIZ_ITEM_EFFECT_TYPE.poison),
      value: zWizContentEffectAmount.optional(),
    }),
    z.strictObject({
      type: z.literal(WIZ_ITEM_EFFECT_TYPE.trap),
      value: zWizContentEffectAmount.optional(),
    }),

    // Utility
    z.strictObject({ type: z.literal(WIZ_ITEM_EFFECT_TYPE.torch) }),
    z.strictObject({
      type: z.literal(WIZ_ITEM_EFFECT_TYPE.fuel),
      value: zWizContentEffectAmount.optional(),
    }),
    z.strictObject({ type: z.literal(WIZ_ITEM_EFFECT_TYPE.escape) }),
    z.strictObject({
      type: z.literal(WIZ_ITEM_EFFECT_TYPE.teleport),
      targetId: zWizContentEffectName.optional(),
      destination: zWizContentEffectName.optional(),
    }),
    z.strictObject({
      type: z.literal(WIZ_ITEM_EFFECT_TYPE.unlock),
      targetId: zWizContentEffectName.optional(),
    }),
  ],
)

export const zWizContentConsumableEffectType = z.enum(WIZ_ITEM_EFFECT_TYPE)
