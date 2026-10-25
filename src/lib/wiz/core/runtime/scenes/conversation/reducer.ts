import { WizStateGift } from "@/lib/wiz/core/domain/values/gift"
import { WizEngineConversation } from "@/lib/wiz/core/engine/conversation"
import {
  createWizStandardConversationAffinitySystem,
  type WizConversationAffinityPort,
} from "@/lib/wiz/core/engine/conversation/affinity-system"
import { WizEngineDialogueEffectApplicator } from "@/lib/wiz/core/engine/conversation/dialogue-effect-applicator"
import type { WizConversationEvent } from "@/lib/wiz/core/engine/conversation/types"
import type { WizAction } from "@/lib/wiz/core/runtime/action"
import type { WizStandardInventoryService } from "@/lib/wiz/core/rpg/standard-inventory"
import { WizSceneResultFactory, type WizSceneResult } from "@/lib/wiz/core/runtime/scene-result"
import type { WizSceneConversationAction } from "@/lib/wiz/core/runtime/scenes/conversation/action"
import {
  openWizConversationDialogue,
  type WizStateConversation,
} from "@/lib/wiz/core/runtime/scenes/conversation/state"
import type { WizConversationTranscriptEntry } from "@/lib/wiz/core/runtime/scenes/conversation/types"
import type { WizState } from "@/lib/wiz/core/runtime/state"
import { WizVaultRequirementService } from "@/lib/wiz/core/vault/services/requirement-service"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

type Dependencies = {
  readonly inventoryService: WizStandardInventoryService
  readonly affinitySystem?: WizConversationAffinityPort
  readonly conversationService?: WizEngineConversation
  readonly effectApplicator?: WizEngineDialogueEffectApplicator
  readonly requirementService?: WizVaultRequirementService
}

export class WizSceneConversationReducer {
  private readonly affinitySystem: WizConversationAffinityPort
  private readonly conversationService: WizEngineConversation
  private readonly effectApplicator: WizEngineDialogueEffectApplicator
  private readonly requirementService: WizVaultRequirementService

  constructor(dependencies: Dependencies) {
    this.affinitySystem =
      dependencies.affinitySystem ?? createWizStandardConversationAffinitySystem()
    this.conversationService =
      dependencies.conversationService ??
      new WizEngineConversation({
        affinitySystem: this.affinitySystem,
        inventoryService: dependencies.inventoryService,
      })
    this.effectApplicator =
      dependencies.effectApplicator ??
      new WizEngineDialogueEffectApplicator({
        affinitySystem: this.affinitySystem,
        inventoryService: dependencies.inventoryService,
      })
    this.requirementService = dependencies.requirementService ?? new WizVaultRequirementService()
    Object.freeze(this)
  }

  reduce(
    state: WizState,
    action: WizAction | WizSceneConversationAction,
  ): WizSceneResult<WizState> {
    if (state.type !== "conversation") return WizSceneResultFactory.accept(state)

    if (action.type === "ADVANCE_DIALOGUE") {
      return this.handleAdvanceDialogue(state)
    }
    if (action.type === "SELECT_DIALOGUE_OPTION") {
      return this.handleSelectDialogueOption(state, action)
    }
    if (action.type === "SELECT_GIFT") {
      return this.handleSelectGift(state, action)
    }
    if (action.type === "CONFIRM_GIFT") {
      return this.handleConfirmGift(state)
    }
    if (action.type === "CANCEL_GIFT") {
      if (state.pendingGiftItemId === null) {
        return WizSceneResultFactory.reject(state, "GIFT_CANCELLATION_REJECTED")
      }
      return WizSceneResultFactory.accept(state.withPendingGiftItemId(null))
    }
    if (action.type === "END_CONVERSATION") {
      return this.handleEndConversation(state)
    }

    return WizSceneResultFactory.accept(state)
  }

  private handleAdvanceDialogue(state: WizStateConversation): WizSceneResult<WizState> {
    if (state.progress.phase !== "reading") {
      return WizSceneResultFactory.reject(state, "DIALOGUE_ADVANCE_REJECTED")
    }

    const dialogue = state.getCurrentDialogue()
    if (!dialogue || state.dialogueIndex >= dialogue.lines.length) {
      return WizSceneResultFactory.reject(state, "DIALOGUE_ADVANCE_REJECTED")
    }

    const lineIndex = state.dialogueIndex
    const nextLineIndex = lineIndex + 1
    const lineEntry = Object.freeze({
      type: "dialogue_line" as const,
      dialogueId: dialogue.id,
      lineIndex,
    })
    const withLine = state
      .addTranscript(lineEntry)
      .withProgress(state.progress.withPhase("reading", nextLineIndex))

    if (nextLineIndex < dialogue.lines.length) {
      return WizSceneResultFactory.accept(withLine)
    }
    if ((dialogue.options?.length ?? 0) > 0) {
      return WizSceneResultFactory.accept(
        withLine.withProgress(withLine.progress.withPhase("choosing")),
      )
    }

    const completed = this.completeDialogue(withLine)
    return completed
      ? WizSceneResultFactory.accept(completed)
      : WizSceneResultFactory.reject(state, "DIALOGUE_ADVANCE_REJECTED")
  }

  private handleSelectDialogueOption(
    state: WizStateConversation,
    action: { optionId: string },
  ): WizSceneResult<WizState> {
    if (state.progress.phase !== "choosing") {
      return WizSceneResultFactory.reject(state, "DIALOGUE_OPTION_REJECTED")
    }

    const npc = state.vault.findNpc(state.npcId)
    const dialogue = state.getCurrentDialogue()
    const option = dialogue?.options?.find((candidate) => candidate.id === action.optionId)
    if (!npc || !dialogue || !option) {
      return WizSceneResultFactory.reject(state, "DIALOGUE_OPTION_REJECTED")
    }

    if (
      option.requirements &&
      !this.requirementService.meetsRequirements(option.requirements, {
        affinity: npc.affinity,
        flags: state.vault.flags,
        inventory: state.vault.inventory,
        level: state.vault.player.level,
      })
    ) {
      return WizSceneResultFactory.reject(state, "DIALOGUE_OPTION_REJECTED")
    }
    if (option.affinityChange !== undefined && !Number.isFinite(option.affinityChange)) {
      return WizSceneResultFactory.reject(state, "DIALOGUE_OPTION_REJECTED")
    }

    const previousAffinity = npc.affinity
    const previousLevel = this.affinitySystem.getAffinityLevel(previousAffinity)
    let nextVault = state.vault

    if (option.effects) {
      if (!this.effectApplicator.canApply(nextVault, option.effects)) {
        return WizSceneResultFactory.reject(state, "DIALOGUE_OPTION_REJECTED")
      }
      nextVault = this.effectApplicator.apply(nextVault, state.npcId, option.effects)
    }
    if (option.affinityChange !== undefined) {
      nextVault = nextVault.updateNpc(
        state.npcId,
        (currentNpc) =>
          this.affinitySystem.changeAffinity(currentNpc, option.affinityChange ?? 0, {
            type: "dialogue_option",
            optionId: option.id,
          }).npc,
      )
    }

    const nextNpc = nextVault.findNpc(state.npcId)
    if (!nextNpc) {
      return WizSceneResultFactory.reject(state, "DIALOGUE_OPTION_REJECTED")
    }

    const optionEntry = Object.freeze({
      type: "option_selected" as const,
      dialogueId: dialogue.id,
      optionId: option.id,
      affinityDelta: nextNpc.affinity - previousAffinity,
    })
    nextVault = addAffinityLevelChangedLog(
      nextVault,
      state.npcId,
      previousLevel,
      this.affinitySystem.getAffinityLevel(nextNpc.affinity),
    )

    if (option.responseDialogueId) {
      const responseDialogue = nextNpc.dialogues.find(
        (candidate) => candidate.id === option.responseDialogueId,
      )
      if (!responseDialogue) {
        return WizSceneResultFactory.reject(state, "DIALOGUE_OPTION_REJECTED")
      }
      const opening = openWizConversationDialogue(responseDialogue)
      return WizSceneResultFactory.accept(
        state
          .withVault(nextVault)
          .addTranscript(optionEntry, ...opening.transcript)
          .withProgress(opening.progress),
      )
    }

    const transcriptIndex = state.transcript.length
    const withOption = state.withVault(nextVault).addTranscript(optionEntry)
    return WizSceneResultFactory.accept(
      withOption.withProgress(
        withOption.progress.complete({
          transcriptIndex,
        }),
      ),
    )
  }

  private handleEndConversation(state: WizStateConversation): WizSceneResult<WizState> {
    if (state.progress.phase === "ready_to_complete") {
      const completed = this.completeDialogue(state)
      if (completed) {
        return WizSceneResultFactory.accept(completed, { type: "GO_TO_VILLAGE" })
      }
    }

    return WizSceneResultFactory.accept(state, { type: "GO_TO_VILLAGE" })
  }

  private handleSelectGift(
    state: WizStateConversation,
    action: { itemId: string },
  ): WizSceneResult<WizState> {
    if (
      !state.vault.findNpc(state.npcId) ||
      state.vault.inventory.totalQuantity("item", action.itemId) === 0
    ) {
      return WizSceneResultFactory.reject(state, "GIFT_SELECTION_REJECTED")
    }

    return WizSceneResultFactory.accept(state.withPendingGiftItemId(action.itemId))
  }

  private handleConfirmGift(state: WizStateConversation): WizSceneResult<WizState> {
    const itemId = state.pendingGiftItemId
    const npc = state.vault.findNpc(state.npcId)
    if (itemId === null || !npc || state.vault.inventory.totalQuantity("item", itemId) === 0) {
      return WizSceneResultFactory.reject(state, "GIFT_CONFIRMATION_REJECTED")
    }

    const gift = WizStateGift.create(itemId)
    const previousLevel = this.affinitySystem.getAffinityLevel(npc.affinity)
    const giftResult = this.conversationService.applyGiftResult(state.vault, state.npcId, gift)
    if (!giftResult.applied) {
      return WizSceneResultFactory.reject(state, "GIFT_CONFIRMATION_REJECTED")
    }

    const giftApplied = giftResult.events.find(
      (event): event is Extract<WizConversationEvent, { readonly type: "gift_applied" }> =>
        event.type === "gift_applied",
    )
    const nextNpc = giftResult.vault.findNpc(state.npcId)
    if (!giftApplied || !nextNpc) {
      return WizSceneResultFactory.reject(state, "GIFT_CONFIRMATION_REJECTED")
    }

    const nextVault = addAffinityLevelChangedLog(
      giftResult.vault,
      state.npcId,
      previousLevel,
      this.affinitySystem.getAffinityLevel(nextNpc.affinity),
    )
    const giftEntry: WizConversationTranscriptEntry = Object.freeze({
      type: "gift_applied",
      itemId: giftApplied.itemId,
      reaction: giftApplied.reaction,
      affinityDelta: giftApplied.affinityChange.change,
    })

    return WizSceneResultFactory.accept(
      state.withVault(nextVault).withPendingGiftItemId(null).addTranscript(giftEntry),
    )
  }

  private completeDialogue(state: WizStateConversation): WizStateConversation | null {
    const dialogueId = state.dialogueId
    const npc = state.vault.findNpc(state.npcId)
    if (dialogueId === null || !npc) return null

    const previousLevel = this.affinitySystem.getAffinityLevel(npc.affinity)
    const completion = this.conversationService.completeDialogueResult(state.vault, state.npcId)
    if (!completion.applied) return null

    const completionEvent = completion.events.find(
      (event): event is Extract<WizConversationEvent, { readonly type: "dialogue_completed" }> =>
        event.type === "dialogue_completed",
    )
    const nextNpc = completion.vault.findNpc(state.npcId)
    if (!completionEvent || !nextNpc) return null

    const nextVault = addAffinityLevelChangedLog(
      completion.vault,
      state.npcId,
      previousLevel,
      this.affinitySystem.getAffinityLevel(nextNpc.affinity),
    )
    const transcriptIndex = state.transcript.length
    const withCompletion = state.withVault(nextVault).addTranscript(
      Object.freeze({
        type: "dialogue_completed",
        dialogueId,
        affinityDelta: completionEvent.affinityChange.change,
      }),
    )

    return withCompletion.withProgress(
      withCompletion.progress.complete({
        transcriptIndex,
      }),
    )
  }
}

function addAffinityLevelChangedLog(
  vault: WizVaultValue,
  npcId: string,
  previousLevel: string,
  nextLevel: string,
): WizVaultValue {
  if (nextLevel === previousLevel) return vault
  return vault.addLog({
    key: "AFFINITY_LEVEL_CHANGED",
    npcId,
    level: nextLevel,
  })
}
