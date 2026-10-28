import type { WizVaultNpc } from "@/lib/wiz/core/vault/states/npc/type"
import type {
  WizConversationTranscriptEntry,
  WizSceneConversationHistoryEntry,
} from "@/lib/wiz/core/runtime/scenes/conversation/types"
import { presentWizConversationTranscriptEntry } from "@/lib/wiz/core/runtime/scenes/conversation/present-wiz-conversation-transcript-entry"

export function presentWizConversationTranscript(
  transcript: readonly WizConversationTranscriptEntry[],
  npc: WizVaultNpc | undefined
): readonly WizSceneConversationHistoryEntry[] {
  return Object.freeze(
    transcript.flatMap((entry) =>
      presentWizConversationTranscriptEntry(entry, npc)
    )
  )
}
