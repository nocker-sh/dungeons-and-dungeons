import { z } from "zod"

export const zWizContentFacilityUnlockCondition = z.discriminatedUnion("type", [
  z.strictObject({
    facilityId: z.string(),
    type: z.literal("area_progress"),
    areaId: z.string(),
    requiredProgress: z.number().finite().min(0).max(100),
  }),
  z.strictObject({
    facilityId: z.string(),
    type: z.literal("quest"),
    questId: z.string(),
  }),
])

export type WizContentFacilityUnlockCondition = z.infer<typeof zWizContentFacilityUnlockCondition>

export const zWizContentFacilityTable = z.array(zWizContentFacilityUnlockCondition)
export type WizContentFacilityTable = z.infer<typeof zWizContentFacilityTable>
