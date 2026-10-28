import type { WizGiftReaction } from "@/lib/wiz/core/engine/conversation/affinity-system"

export type WizSceneConversationSpeaker = "player" | "npc" | "narrator"

export type WizSceneConversationContentLine = Readonly<{
  type: "content"
  speaker: WizSceneConversationSpeaker
  sourceSpeaker?: string
  text: string
  emotion?: string
  portrait?: string
}>

export type WizGiftPresentationEvent = Readonly<{
  type: "gift_presented"
  itemId: string
}>

export type WizGiftReactionEvent = Readonly<{
  type: "gift_reaction"
  reaction: WizGiftReaction
}>

export type WizSceneConversationHistoryEntry =
  | WizSceneConversationContentLine
  | WizGiftPresentationEvent
  | WizGiftReactionEvent

/**
 * Points at the semantic transcript entry which proves completion.
 *
 * The entry, rather than this receipt, is the single authority for dialogue/option IDs and
 * the actual affinity delta.
 */
export type WizConversationCompletionReceipt = Readonly<{
  transcriptIndex: number
}>

export type WizConversationTranscriptEntry =
  | Readonly<{
      type: "dialogue_started"
      dialogueId: string
    }>
  | Readonly<{
      type: "dialogue_line"
      dialogueId: string
      lineIndex: number
    }>
  | Readonly<{
      type: "dialogue_completed"
      dialogueId: string
      affinityDelta: number
    }>
  | Readonly<{
      type: "option_selected"
      dialogueId: string
      optionId: string
      affinityDelta: number
    }>
  | Readonly<{
      type: "gift_applied"
      itemId: string
      reaction: WizGiftReaction
      affinityDelta: number
    }>
