import type { WizGiftReaction } from "@/lib/wiz/core/engine/conversation/affinity-system"
import type { WizVaultNpc } from "@/lib/wiz/core/vault/states/npc/type"

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

export function toWizSceneConversationSpeaker(
  speaker: string | undefined,
): WizSceneConversationSpeaker {
  const normalized = speaker?.toLowerCase()
  if (normalized === "player") return "player"
  if (normalized === "narrator") return "narrator"
  return "npc"
}

export function toWizSceneConversationContentLine(
  line: Readonly<{
    speaker?: string
    text?: string
    emotion?: string
    portrait?: string
  }>,
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

const missingConversationContentLine = (
  dialogueId: string,
  lineIndex: number,
): WizSceneConversationContentLine =>
  Object.freeze({
    type: "content",
    speaker: "narrator",
    text: `[${dialogueId}#${lineIndex}]`,
  })

export function presentWizConversationTranscriptEntry(
  entry: WizConversationTranscriptEntry,
  npc: WizVaultNpc | undefined,
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

export function presentWizConversationTranscript(
  transcript: readonly WizConversationTranscriptEntry[],
  npc: WizVaultNpc | undefined,
): readonly WizSceneConversationHistoryEntry[] {
  return Object.freeze(
    transcript.flatMap((entry) => presentWizConversationTranscriptEntry(entry, npc)),
  )
}
