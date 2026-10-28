import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type {
  WizConversationCompletionReceipt,
  WizConversationTranscriptEntry,
} from "@/lib/wiz/core/runtime/scenes/conversation/types"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"
import type { WizVaultDialogue } from "@/lib/wiz/core/vault/states/npc/type"

const objectService = new WizObjectService()

export type WizConversationProgressData =
  | Readonly<{
      phase: "idle"
      dialogueId: null
      nextLineIndex: 0
    }>
  | Readonly<{
      phase: "reading" | "choosing" | "ready_to_complete"
      dialogueId: string
      nextLineIndex: number
    }>
  | Readonly<{
      phase: "completed"
      dialogueId: string
      nextLineIndex: number
      completion: WizConversationCompletionReceipt
    }>

export class WizConversationProgress {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  private readonly properties: WizConversationProgressData

  constructor(properties: WizConversationProgressData) {
    if (
      !Number.isInteger(properties.nextLineIndex) ||
      properties.nextLineIndex < 0
    ) {
      throw new RangeError(
        "Conversation nextLineIndex must be a non-negative integer"
      )
    }
    if (
      properties.dialogueId !== null &&
      properties.dialogueId.trim().length === 0
    ) {
      throw new RangeError("Conversation dialogueId must not be empty")
    }
    if (
      properties.phase === "completed" &&
      (!Number.isInteger(properties.completion.transcriptIndex) ||
        properties.completion.transcriptIndex < 0)
    ) {
      throw new RangeError(
        "Conversation completion transcriptIndex must be a non-negative integer"
      )
    }
    this.properties = objectService.ownImmutable(properties)
    WizImmutableValue.freeze(this)
  }

  get phase(): WizConversationProgressData["phase"] {
    return this.properties.phase
  }

  get dialogueId(): string | null {
    return this.properties.dialogueId
  }

  get nextLineIndex(): number {
    return this.properties.nextLineIndex
  }

  get completion(): WizConversationCompletionReceipt | null {
    return this.properties.phase === "completed"
      ? this.properties.completion
      : null
  }

  get isCompleted(): boolean {
    return this.properties.phase === "completed"
  }

  withPhase(
    phase: "reading" | "choosing" | "ready_to_complete",
    nextLineIndex: number = this.nextLineIndex
  ): WizConversationProgress {
    if (this.dialogueId === null) {
      throw new TypeError("Idle conversation progress has no dialogue")
    }
    return new WizConversationProgress({
      phase,
      dialogueId: this.dialogueId,
      nextLineIndex,
    })
  }

  complete(
    completion: WizConversationCompletionReceipt
  ): WizConversationProgress {
    if (this.dialogueId === null) {
      throw new TypeError("Idle conversation progress cannot be completed")
    }
    return new WizConversationProgress({
      phase: "completed",
      dialogueId: this.dialogueId,
      nextLineIndex: this.nextLineIndex,
      completion,
    })
  }

  toPlain(): WizConversationProgressData {
    return this.properties
  }

  static idle(): WizConversationProgress {
    return new WizConversationProgress({
      phase: "idle",
      dialogueId: null,
      nextLineIndex: 0,
    })
  }

  static reading(
    dialogueId: string,
    nextLineIndex = 0
  ): WizConversationProgress {
    return new WizConversationProgress({
      phase: "reading",
      dialogueId,
      nextLineIndex,
    })
  }
}

export type WizConversationOpening = Readonly<{
  progress: WizConversationProgress
  transcript: readonly WizConversationTranscriptEntry[]
}>

/**
 * Pin a dialogue and derive its initial progress without storing presentation text.
 */
export function openWizConversationDialogue(
  dialogue: WizVaultDialogue
): WizConversationOpening {
  const hasFirstLine = dialogue.lines.length > 0
  const nextLineIndex = hasFirstLine ? 1 : 0
  const phase =
    nextLineIndex < dialogue.lines.length
      ? "reading"
      : (dialogue.options?.length ?? 0) > 0
        ? "choosing"
        : "ready_to_complete"

  return Object.freeze({
    progress: new WizConversationProgress({
      phase,
      dialogueId: dialogue.id,
      nextLineIndex,
    }),
    transcript: Object.freeze([
      Object.freeze({
        type: "dialogue_started" as const,
        dialogueId: dialogue.id,
      }),
      ...(hasFirstLine
        ? [
            Object.freeze({
              type: "dialogue_line" as const,
              dialogueId: dialogue.id,
              lineIndex: 0,
            }),
          ]
        : []),
    ]),
  })
}

export type WizStateConversationDefinition = {
  readonly type: "conversation"
  readonly npcId: string
  readonly progress: WizConversationProgress
  readonly transcript: readonly WizConversationTranscriptEntry[]
  readonly pendingGiftItemId: string | null
  readonly vault: WizVaultValue
}

export class WizStateConversation {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "conversation" as const
  private readonly properties: WizStateConversationDefinition

  constructor(properties: WizStateConversationDefinition) {
    if (properties.progress.phase === "completed") {
      const completion = properties.progress.completion
      if (!completion) {
        throw new RangeError(
          "Completed conversation progress must include a receipt"
        )
      }
      const completionEntry = properties.transcript[completion.transcriptIndex]
      if (
        !completionEntry ||
        (completionEntry.type !== "dialogue_completed" &&
          completionEntry.type !== "option_selected") ||
        completionEntry.dialogueId !== properties.progress.dialogueId
      ) {
        throw new RangeError(
          "Conversation completion must reference a completion entry for the active dialogue"
        )
      }
    }
    this.properties = objectService.ownImmutable(properties)
    WizImmutableValue.freeze(this)
  }

  get vault() {
    return this.properties.vault
  }

  get npcId() {
    return this.properties.npcId
  }

  get progress(): WizConversationProgress {
    return this.properties.progress
  }

  get dialogueId(): string | null {
    return this.properties.progress.dialogueId
  }

  /** 次に表示する行index。 */
  get dialogueIndex(): number {
    return this.properties.progress.nextLineIndex
  }

  get transcript(): readonly WizConversationTranscriptEntry[] {
    return this.properties.transcript
  }

  get pendingGiftItemId(): string | null {
    return this.properties.pendingGiftItemId
  }

  /** current conversationで実際に適用されたclamp後のaffinity差分。 */
  get affinityGained(): number {
    return this.properties.transcript.reduce(
      (total, entry) =>
        total + ("affinityDelta" in entry ? entry.affinityDelta : 0),
      0
    )
  }

  get dialogueCompleted(): boolean {
    return this.properties.progress.isCompleted
  }

  getCurrentDialogue(): WizVaultDialogue | undefined {
    const dialogueId = this.properties.progress.dialogueId
    if (dialogueId === null) return undefined
    return this.properties.vault
      .findNpc(this.properties.npcId)
      ?.dialogues.find((dialogue) => dialogue.id === dialogueId)
  }

  withProgress(progress: WizConversationProgress) {
    return new WizStateConversation({
      ...this.properties,
      progress,
    })
  }

  withTranscript(transcript: readonly WizConversationTranscriptEntry[]) {
    return new WizStateConversation({
      ...this.properties,
      transcript,
    })
  }

  addTranscript(...entries: readonly WizConversationTranscriptEntry[]) {
    return new WizStateConversation({
      ...this.properties,
      transcript: [...this.properties.transcript, ...entries],
    })
  }

  withPendingGiftItemId(itemId: string | null) {
    return new WizStateConversation({
      ...this.properties,
      pendingGiftItemId: itemId,
    })
  }

  withVault(vault: WizVaultValue) {
    return new WizStateConversation({
      ...this.properties,
      vault,
    })
  }

  updateVault(fn: (vault: WizVaultValue) => WizVaultValue) {
    return this.withVault(fn(this.properties.vault))
  }
}

Object.freeze(WizStateConversation.prototype)
Object.freeze(WizStateConversation)
