export type WizGiftPreferenceReaction = "like" | "dislike" | "neutral"

export type WizGiftReaction = "love" | "dislike" | "neutral"

export type WizGiftResolution = Readonly<{
  /**
   * NPC content上の分類。`like` は表示用reactionではなく、好物設定を表す。
   */
  preference: WizGiftPreferenceReaction
  /** UI/historyに残すNPCのreaction。 */
  reaction: WizGiftReaction
  /**
   * affinityの上下限を適用する前の、NPC content由来の正規ボーナス。
   */
  affinityChange: number
}>
