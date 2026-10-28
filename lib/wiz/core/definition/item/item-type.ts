import { z } from "zod"

export const zWizContentItemType = z.enum(["consumable", "material", "key", "gift"])

export type WizContentItemType = z.infer<typeof zWizContentItemType>
