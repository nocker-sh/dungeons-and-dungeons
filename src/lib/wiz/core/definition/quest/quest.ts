import { z } from "zod"

// JSON からロードするクエスト定義用の Zod スキーマ
export const zWizContentQuestObjective = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("defeat"),
    monsterId: z.string(),
    count: z.number().finite().int().positive(),
  }),
  z.strictObject({
    type: z.literal("gather"),
    itemId: z.string(),
    count: z.number().finite().int().positive(),
  }),
  z.strictObject({
    type: z.literal("explore"),
    areaId: z.string(),
    requiredProgress: z.number().finite().min(0).max(100),
  }),
  z.strictObject({
    type: z.literal("deliver"),
    itemId: z.string(),
    npcId: z.string(),
  }),
])

export const zWizContentQuestRewardEntry = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("item"),
    itemId: z.string(),
    quantity: z.number().finite().int().positive(),
  }),
  z.strictObject({
    type: z.literal("weapon"),
    weaponId: z.string(),
    quantity: z.number().finite().int().positive(),
  }),
  z.strictObject({
    type: z.literal("armor"),
    armorId: z.string(),
    quantity: z.number().finite().int().positive(),
  }),
])

export const zWizContentQuestReward = z
  .strictObject({
    gold: z.number().finite().nonnegative(),
    exp: z.number().finite().nonnegative(),
    affinityBonus: z.number().finite().nonnegative(),
    items: z.array(zWizContentQuestRewardEntry).optional(),
  })
  .superRefine((reward, context) => {
    const firstIndexByReward = new Map<string, number>()
    reward.items?.forEach((entry, index) => {
      const id =
        entry.type === "item"
          ? entry.itemId
          : entry.type === "weapon"
            ? entry.weaponId
            : entry.armorId
      const key = `${entry.type}:${id}`
      const firstIndex = firstIndexByReward.get(key)
      if (firstIndex === undefined) {
        firstIndexByReward.set(key, index)
        return
      }
      context.addIssue({
        code: "custom",
        path: ["items", index, `${entry.type}Id`],
        message: `duplicate quest reward; first declared at index ${firstIndex}`,
      })
    })
  })

export const zWizContentQuest = z.strictObject({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  giverNpcId: z.string(),
  objective: zWizContentQuestObjective,
  reward: zWizContentQuestReward,
  nextQuestId: z.string().optional(),
})

export type WizContentQuestObjective = z.infer<typeof zWizContentQuestObjective>
export type WizContentQuestRewardEntry = z.infer<typeof zWizContentQuestRewardEntry>
export type WizContentQuestReward = z.infer<typeof zWizContentQuestReward>
export type WizContentQuest = z.infer<typeof zWizContentQuest>

export type WizContentQuestRewardEntryType = "item" | "weapon" | "armor"

export const getWizContentQuestRewardEntryType = (
  reward: WizContentQuestRewardEntry,
): WizContentQuestRewardEntryType => reward.type

export const getWizContentQuestRewardEntryId = (reward: WizContentQuestRewardEntry): string => {
  switch (reward.type) {
    case "item":
      return reward.itemId
    case "weapon":
      return reward.weaponId
    case "armor":
      return reward.armorId
  }
}
