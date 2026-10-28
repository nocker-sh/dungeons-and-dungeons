import type { WizSceneConversationContentLine } from "@/lib/wiz/core/runtime/scenes/conversation/types"
import { toWizSceneConversationSpeaker } from "@/lib/wiz/core/runtime/scenes/conversation/to-wiz-scene-conversation-speaker"

export function toWizSceneConversationContentLine(
  line: Readonly<{
    speaker?: string
    text?: string
    emotion?: string
    portrait?: string
  }>
): WizSceneConversationContentLine {
  return Object.freeze({
    type: "content",
    speaker: toWizSceneConversationSpeaker(line.speaker),
    sourceSpeaker: line.speaker,
    text: line.text ?? "",
    emotion: line.emotion,
    portrait: line.portrait,
  })
}
