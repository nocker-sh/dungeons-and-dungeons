import type { WizSceneConversationContentLine } from "@/lib/wiz/core/runtime/scenes/conversation/types"

export const missingConversationContentLine = (
  dialogueId: string,
  lineIndex: number
): WizSceneConversationContentLine =>
  Object.freeze({
    type: "content",
    speaker: "narrator",
    text: `[${dialogueId}#${lineIndex}]`,
  })
