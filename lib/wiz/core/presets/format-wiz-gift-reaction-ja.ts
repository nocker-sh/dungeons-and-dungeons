import type { WizGiftReaction } from "@/lib/wiz/core/engine/conversation/affinity-system"

export function formatWizGiftReactionJa(reaction: WizGiftReaction): string {
  if (reaction === "love") return "わあ、大好き! ありがとう!"
  if (reaction === "dislike") return "うーん...これは..."
  return "ありがとう。"
}
