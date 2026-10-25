import { z } from "zod"
import { zWizContentEventPenalty } from "@/lib/wiz/core/definition/event/event-penalty"
import { zWizContentEventReward } from "@/lib/wiz/core/definition/event/event-reward"
import { zWizAttributeKey } from "@/lib/wiz/core/types"

export const zWizContentEventChoice = z
  .strictObject({
    label: z.string(),
    stat: zWizAttributeKey.optional(),
    difficulty: z.number().finite().positive().optional(),
    successText: z.string(),
    failText: z.string(),
    successReward: zWizContentEventReward.optional(),
    failPenalty: zWizContentEventPenalty.optional(),
  })
  .superRefine((choice, context) => {
    if ((choice.stat === undefined) === (choice.difficulty === undefined)) return

    context.addIssue({
      code: "custom",
      path: [choice.stat === undefined ? "stat" : "difficulty"],
      message: "stat and difficulty must be specified together",
    })
  })

export type WizContentEventChoice = z.infer<typeof zWizContentEventChoice>
