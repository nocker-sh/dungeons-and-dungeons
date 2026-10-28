import type { WizSceneConversationSpeaker } from "@/lib/wiz/core/runtime/scenes/conversation/types"

export function toWizSceneConversationSpeaker(
  speaker: string | undefined
): WizSceneConversationSpeaker {
  const normalized = speaker?.toLowerCase()
  if (normalized === "player") return "player"
  if (normalized === "narrator") return "narrator"
  return "npc"
}
