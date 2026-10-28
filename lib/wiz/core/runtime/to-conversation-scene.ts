import { WizEngineConversationDialogueSelector } from "@/lib/wiz/core/engine/conversation/dialogue-selector"
import {
  openWizConversationDialogue,
  WizConversationProgress,
  WizStateConversation,
} from "@/lib/wiz/core/runtime/scenes/conversation/state"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export function toConversationScene(
  vault: WizVaultValue,
  npcId: string
): WizStateConversation {
  const npc = vault.findNpc(npcId)
  const dialogue = npc
    ? new WizEngineConversationDialogueSelector().select({
        npc,
        vault,
      })
    : undefined
  const opening = dialogue ? openWizConversationDialogue(dialogue) : null

  return new WizStateConversation({
    type: "conversation",
    npcId,
    progress: opening?.progress ?? WizConversationProgress.idle(),
    transcript: opening?.transcript ?? [],
    pendingGiftItemId: null,
    vault,
  })
}
