import { z } from "zod"

export const zWizContentEventReward = z
  .strictObject({
    gold: z.number().finite().nonnegative().optional(),
    exp: z.number().finite().nonnegative().optional(),
    items: z
      .array(
        z.strictObject({
          itemId: z.string(),
          quantity: z.number().finite().int().positive(),
        }),
      )
      .optional(),
  })
  .superRefine((reward, context) => {
    const firstIndexByItemId = new Map<string, number>()
    reward.items?.forEach((item, index) => {
      const firstIndex = firstIndexByItemId.get(item.itemId)
      if (firstIndex === undefined) {
        firstIndexByItemId.set(item.itemId, index)
        return
      }
      context.addIssue({
        code: "custom",
        path: ["items", index, "itemId"],
        message: `duplicate reward item; first declared at index ${firstIndex}`,
      })
    })
  })

export type WizContentEventReward = z.infer<typeof zWizContentEventReward>
