import { z } from "zod"
import { zWizContentEventChoice } from "@/lib/wiz/core/definition/event/event-choice"

export const zWizContentEvent = z.strictObject({
  id: z.string(),
  description: z.string(),
  choices: z.array(zWizContentEventChoice),
})

export type WizContentEvent = z.infer<typeof zWizContentEvent>
