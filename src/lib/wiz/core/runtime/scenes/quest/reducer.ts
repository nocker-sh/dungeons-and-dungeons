import { WizEngineLevelUp } from "@/lib/wiz/core/engine/level-up"
import { WizEngineQuestProgress } from "@/lib/wiz/core/engine/quest/progress"
import type { WizAction } from "@/lib/wiz/core/runtime/action"
import { WizSceneResultFactory, type WizSceneResult } from "@/lib/wiz/core/runtime/scene-result"
import type { WizSceneQuestAction } from "@/lib/wiz/core/runtime/scenes/quest/action"
import type { WizStateQuest } from "@/lib/wiz/core/runtime/scenes/quest/state"
import type { WizState } from "@/lib/wiz/core/runtime/state"
import type { WizRuntimeFacilityUnlockService } from "@/lib/wiz/core/runtime/services/facility-unlock-service"

type Dependencies = {
  readonly questProgressService: WizEngineQuestProgress
  readonly levelUpService?: WizEngineLevelUp
  readonly facilityUnlockService?: WizRuntimeFacilityUnlockService
}

export class WizSceneQuestReducer {
  private readonly questProgressService: WizEngineQuestProgress
  private readonly levelUpService: WizEngineLevelUp
  private readonly facilityUnlockService: WizRuntimeFacilityUnlockService | null

  constructor(dependencies: Dependencies) {
    this.questProgressService = dependencies.questProgressService
    this.levelUpService = dependencies.levelUpService ?? new WizEngineLevelUp()
    this.facilityUnlockService = dependencies.facilityUnlockService ?? null
    Object.freeze(this)
  }

  reduce(state: WizState, action: WizAction | WizSceneQuestAction): WizSceneResult<WizState> {
    if (state.type !== "quest") return WizSceneResultFactory.accept(state)

    if (action.type === "SELECT_QUEST") {
      return this.handleSelectQuest(state, action)
    }

    if (action.type === "CLEAR_QUEST_SELECTION") {
      return WizSceneResultFactory.accept(state.withSelectedQuest(null).withMessage(null))
    }

    if (action.type === "ACCEPT_QUEST") {
      return this.handleAcceptQuest(state)
    }

    if (action.type === "COMPLETE_QUEST") {
      return this.handleCompleteQuest(state)
    }

    if (action.type === "LEAVE_QUEST") {
      return WizSceneResultFactory.accept(state, { type: "GO_TO_VILLAGE" })
    }

    return WizSceneResultFactory.accept(state)
  }

  private handleSelectQuest(
    state: WizStateQuest,
    action: { questId: string },
  ): WizSceneResult<WizState> {
    const quest = state.vault.quests.find((q) => q.id === action.questId)
    if (!quest) {
      return WizSceneResultFactory.reject(
        state.withSelectedQuest(null).withMessage({
          type: "quest_selection_rejected",
          questId: action.questId,
          reason: "quest_not_found",
        }),
        "QUEST_SELECTION_REJECTED",
      )
    }
    return WizSceneResultFactory.accept(state.withSelectedQuest(quest).withMessage(null))
  }

  private handleAcceptQuest(state: WizStateQuest): WizSceneResult<WizState> {
    const selectedQuest = state.selectedQuest
    if (!selectedQuest) {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "quest_acceptance_rejected",
          reason: "no_selection",
        }),
        "QUEST_ACCEPTANCE_REJECTED",
      )
    }
    const quest = state.vault.quests.find((candidate) => candidate.id === selectedQuest.id)
    if (!quest) {
      return WizSceneResultFactory.reject(
        state.withSelectedQuest(null).withMessage({
          type: "quest_selection_rejected",
          questId: selectedQuest.id,
          reason: "quest_not_found",
        }),
        "QUEST_SELECTION_REJECTED",
      )
    }
    if (quest.completed) {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "quest_acceptance_rejected",
          questId: quest.id,
          reason: "already_completed",
        }),
        "QUEST_ACCEPTANCE_REJECTED",
      )
    }
    if (quest.accepted) {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "quest_acceptance_rejected",
          questId: quest.id,
          reason: "already_accepted",
        }),
        "QUEST_ACCEPTANCE_REJECTED",
      )
    }

    const acceptedQuest = { ...quest, accepted: true }
    return WizSceneResultFactory.accept(
      state
        .updateVault((v) =>
          v.updateQuest(quest.id, (q) => ({
            ...q,
            accepted: true,
          })),
        )
        .withSelectedQuest(acceptedQuest)
        .withMessage({
          type: "quest_accepted",
          questId: quest.id,
        }),
    )
  }

  private handleCompleteQuest(state: WizStateQuest): WizSceneResult<WizState> {
    if (!state.selectedQuest) {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "quest_completion_rejected",
          rejection: {
            type: "no_selection",
          },
        }),
        "QUEST_COMPLETION_REJECTED",
      )
    }
    const quest = state.selectedQuest
    const completion = this.questProgressService.completeResult(state.vault, quest.id)
    if (!completion.completed) {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "quest_completion_rejected",
          rejection: completion.rejection,
        }),
        "QUEST_COMPLETION_REJECTED",
      )
    }

    const newVault = completion.vault.addLog({ key: "QUEST_COMPLETED", questId: quest.id })
    const completedQuest = newVault.quests.find((candidate) => candidate.id === quest.id)
    let newState: WizStateQuest = state
      .withVault(newVault)
      .withSelectedQuest(completedQuest ?? { ...quest, completed: true })
      .withMessage(completion.event)
    if (this.facilityUnlockService) {
      newState = this.facilityUnlockService.checkAndUnlockWithLog(newState)
    }

    if (this.levelUpService.shouldLevelUp(newState.vault)) {
      return WizSceneResultFactory.accept(newState, {
        type: "GO_TO_LEVEL_UP",
        returnAreaId: null,
      })
    }
    return WizSceneResultFactory.accept(newState)
  }
}
