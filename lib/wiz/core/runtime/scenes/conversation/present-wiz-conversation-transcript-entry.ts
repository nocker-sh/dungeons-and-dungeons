import type { WizVaultNpc } from "@/lib/wiz/core/vault/states/npc/type"
import type {
  WizConversationTranscriptEntry,
  WizSceneConversationHistoryEntry,
} from "@/lib/wiz/core/runtime/scenes/conversation/types"
import { toWizSceneConversationContentLine } from "@/lib/wiz/core/runtime/scenes/conversation/to-wiz-scene-conversation-content-line"
import { missingConversationContentLine } from "@/lib/wiz/core/runtime/scenes/conversation/missing-conversation-content-line"

export function presentWizConversationTranscriptEntry(
  entry: WizConversationTranscriptEntry,
  npc: WizVaultNpc | undefined
): readonly WizSceneConversationHistoryEntry[] {
  if (entry.type === "dialogue_line") {
    const line = npc?.dialogues
      .find((dialogue) => dialogue.id === entry.dialogueId)
      ?.lines.at(entry.lineIndex)
    return Object.freeze([
      line
        ? toWizSceneConversationContentLine(line)
        : missingConversationContentLine(entry.dialogueId, entry.lineIndex),
    ])
  }
  if (entry.type === "option_selected") {
    const option = npc?.dialogues
      .find((dialogue) => dialogue.id === entry.dialogueId)
      ?.options?.find((candidate) => candidate.id === entry.optionId)
    return Object.freeze([
      Object.freeze({
        type: "content",
        speaker: "player",
        text: option?.text ?? entry.optionId,
      }),
    ])
  }
  if (entry.type === "gift_applied") {
    return Object.freeze([
      Object.freeze({
        type: "gift_presented",
        itemId: entry.itemId,
      }),
      Object.freeze({
        type: "gift_reaction",
        reaction: entry.reaction,
      }),
    ])
  }
  return Object.freeze([])
}
