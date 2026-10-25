import { z } from "zod"

/**
 * 能力値キーの配列 (単一ソース)
 *
 * 新しい能力値を追加する場合はここに追加する
 */
export const WIZ_ATTRIBUTE_KEYS = Object.freeze([
  "strength",
  "dexterity",
  "agility",
  "vitality",
  "wisdom",
  "charisma",
] as const)

export type WizAttributeKey = (typeof WIZ_ATTRIBUTE_KEYS)[number]

export const zWizAttributeKey = z.enum(WIZ_ATTRIBUTE_KEYS)

export type WizAttributes = {
  readonly [K in WizAttributeKey]: number
}

export type WizId = string
export const zWizId = z.string()

export type WizFlags = readonly string[]
export const zWizFlags = z.array(z.string())

export type WizRequirements<TCustom = object> = {
  readonly minLevel?: number
  readonly maxLevel?: number
  readonly requiredFlags?: WizFlags
  readonly forbiddenFlags?: WizFlags
  readonly requiredItems?: readonly { itemId: WizId; quantity: number }[]
  readonly minAffinity?: number
  readonly maxAffinity?: number
} & TCustom

export const zWizRequirementItem = z.strictObject({
  itemId: zWizId,
  quantity: z.number().finite().int().positive(),
})

export const zWizRequirements = z.strictObject({
  minLevel: z.number().finite().int().nonnegative().optional(),
  maxLevel: z.number().finite().int().nonnegative().optional(),
  requiredFlags: zWizFlags.optional(),
  forbiddenFlags: zWizFlags.optional(),
  requiredItems: z.array(zWizRequirementItem).optional(),
  minAffinity: z.number().finite().optional(),
  maxAffinity: z.number().finite().optional(),
})

export type WizRequirementContext = {
  readonly level?: number
  readonly flags?: WizFlags
  readonly inventory?: Readonly<{
    totalQuantity: (contentType: "item", contentId: string) => number
  }>
  readonly affinity?: number
}

export type WizSkillCheckResult = {
  readonly dice: readonly [number, number]
  readonly total: number
  readonly modifier: number
  readonly targetNumber: number
  readonly success: boolean
  readonly critical: boolean
  readonly fumble: boolean
}
