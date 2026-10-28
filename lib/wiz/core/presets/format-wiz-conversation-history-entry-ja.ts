import type { WizSceneConversationHistoryEntry } from "@/lib/wiz/core/runtime/scenes/conversation/types"
import { formatWizGiftReactionJa } from "@/lib/wiz/core/presets/format-wiz-gift-reaction-ja"

export type WizConversationHistoryPresentationJa = Readonly<{
  speaker: string
  text: string
}>

export type WizConversationHistoryPresentationJaOptions = Readonly<{
  npcName: string
  resolveItemName?: (itemId: string) => string | undefined
  resolveNpcSpeakerName?: (sourceSpeaker: string) => string | undefined
  playerName?: string
  narratorName?: string
}>

export function formatWizConversationHistoryEntryJa(
  entry: WizSceneConversationHistoryEntry,
  options: WizConversationHistoryPresentationJaOptions
): WizConversationHistoryPresentationJa {
  if (entry.type === "gift_presented") {
    const itemName = options.resolveItemName?.(entry.itemId) ?? "アイテム"
    return Object.freeze({
      speaker: options.playerName ?? "あなた",
      text: `${itemName}をプレゼントした`,
    })
  }

  if (entry.type === "gift_reaction") {
    return Object.freeze({
      speaker: options.npcName,
      text: formatWizGiftReactionJa(entry.reaction),
    })
  }

  const speaker =
    entry.speaker === "player"
      ? (options.playerName ?? "あなた")
      : entry.speaker === "narrator"
        ? (options.narratorName ?? "語り手")
        : ((entry.sourceSpeaker
            ? options.resolveNpcSpeakerName?.(entry.sourceSpeaker)
            : undefined) ?? options.npcName)

  return Object.freeze({ speaker, text: entry.text })
}
