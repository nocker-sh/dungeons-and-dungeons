import { z } from "zod"

export const zWizContentInnResourceRecovery = z
  .strictObject({
    fixed: z.number().finite().nonnegative().optional(),
    percent: z.number().finite().min(0).max(100).optional(),
  })
  .refine((recovery) => recovery.fixed !== undefined || recovery.percent !== undefined, {
    message: "resource recovery requires fixed or percent",
  })

export type WizContentInnResourceRecovery = z.infer<typeof zWizContentInnResourceRecovery>

/**
 * 宿泊によるlocal state変換の静的definition。
 *
 * 表示名や説明文はpresentation層が所有し、計算に必要な値だけを保持する。
 */
export const zWizContentInnPlan = z.strictObject({
  id: z.string(),
  price: z.number().finite().nonnegative(),
  hpRecovery: zWizContentInnResourceRecovery.optional(),
  mpRecovery: zWizContentInnResourceRecovery.optional(),
  hungerRecovery: z.number().finite().nonnegative().optional(),
  apRecovery: z.union([z.number().finite().nonnegative(), z.literal("full")]).optional(),
})

export type WizContentInnPlan = z.infer<typeof zWizContentInnPlan>
