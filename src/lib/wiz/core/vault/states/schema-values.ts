import { z } from "zod"

/** 保存状態で参照に使う、正規化済みの意味 ID。 */
export const zWizVaultSemanticId = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value, "semantic ID must not contain surrounding whitespace")

/** 表示用文字列のうち、空白だけの値を許可しないもの。 */
export const zWizVaultNonBlankString = z
  .string()
  .refine((value) => value.trim().length > 0, "value must not be blank")

export const zWizVaultFiniteNumber = z.number().finite()
export const zWizVaultNonnegativeNumber = z.number().finite().nonnegative()
export const zWizVaultPositiveNumber = z.number().finite().positive()
export const zWizVaultNonnegativeInteger = z.number().finite().int().nonnegative()
export const zWizVaultPositiveInteger = z.number().finite().int().positive()

export const addWizVaultUpperBoundIssue = (
  context: z.RefinementCtx,
  path: readonly PropertyKey[],
  currentName: string,
  current: number,
  maximumName: string,
  maximum: number,
): void => {
  if (current <= maximum) {
    return
  }
  context.addIssue({
    code: "custom",
    path: [...path],
    message: `${currentName} must be less than or equal to ${maximumName}`,
  })
}
