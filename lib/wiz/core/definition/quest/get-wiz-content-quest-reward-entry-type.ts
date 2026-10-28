import type { WizContentQuestRewardEntry } from "@/lib/wiz/core/definition/quest/quest"

export type WizContentQuestRewardEntryType = "item" | "weapon" | "armor"

export const getWizContentQuestRewardEntryType = (
  reward: WizContentQuestRewardEntry
): WizContentQuestRewardEntryType => reward.type
