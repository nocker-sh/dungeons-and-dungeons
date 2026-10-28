import type { WizContentQuestRewardEntry } from "@/lib/wiz/core/definition/quest/quest"

export const getWizContentQuestRewardEntryId = (
  reward: WizContentQuestRewardEntry
): string => {
  switch (reward.type) {
    case "item":
      return reward.itemId
    case "weapon":
      return reward.weaponId
    case "armor":
      return reward.armorId
  }
}
