import type { WizEngineInnPort } from "@/lib/wiz/core/engine/inn"
import type { WizAction } from "@/lib/wiz/core/runtime/action"
import { WizSceneResultFactory, type WizSceneResult } from "@/lib/wiz/core/runtime/scene-result"
import type { WizSceneInnAction } from "@/lib/wiz/core/runtime/scenes/inn/action"
import type { WizStateInn } from "@/lib/wiz/core/runtime/scenes/inn/state"
import type { WizState } from "@/lib/wiz/core/runtime/state"

type Dependencies = {
  readonly innService: WizEngineInnPort
}

export class WizSceneInnReducer {
  private readonly innService: WizEngineInnPort

  constructor(dependencies: Dependencies) {
    if (
      typeof dependencies.innService !== "object" ||
      dependencies.innService === null ||
      typeof dependencies.innService.evaluateStay !== "function" ||
      typeof dependencies.innService.stay !== "function"
    ) {
      throw new TypeError("WizSceneInnReducer requires an inn service")
    }
    this.innService = Object.freeze({
      evaluateStay: Object.freeze(
        dependencies.innService.evaluateStay.bind(dependencies.innService),
      ),
      stay: Object.freeze(dependencies.innService.stay.bind(dependencies.innService)),
    })
    Object.freeze(this)
  }

  reduce(state: WizState, action: WizAction | WizSceneInnAction): WizSceneResult<WizState> {
    if (state.type !== "inn") return WizSceneResultFactory.accept(state)

    if (action.type === "SELECT_STAY_PLAN") {
      return this.handleSelectStayPlan(state, action)
    }

    if (action.type === "CONFIRM_STAY") {
      return this.handleConfirmStay(state)
    }

    if (action.type === "CANCEL_STAY") {
      return WizSceneResultFactory.accept(state.withSelectedPlan(null).withConfirmingStay(false))
    }

    if (action.type === "LEAVE_INN") {
      const newVault = state.vault.addLog({ key: "LEFT_INN" })
      return WizSceneResultFactory.accept(state.withVault(newVault), { type: "GO_TO_VILLAGE" })
    }

    return WizSceneResultFactory.accept(state)
  }

  private handleSelectStayPlan(
    state: WizStateInn,
    action: { plan: string },
  ): WizSceneResult<WizState> {
    const eligibility = this.innService.evaluateStay(state.vault, action.plan)

    if (eligibility.status === "rejected") {
      return WizSceneResultFactory.reject(
        state.withSelectedPlan(null).withConfirmingStay(false).withMessage({
          type: "stay_rejected",
          rejection: eligibility.rejection,
        }),
        "STAY_REJECTED",
      )
    }

    return WizSceneResultFactory.accept(
      state.withSelectedPlan(action.plan).withConfirmingStay(true).withMessage(null),
    )
  }

  private handleConfirmStay(state: WizStateInn): WizSceneResult<WizState> {
    if (!state.selectedPlan) {
      return WizSceneResultFactory.reject(
        state.withConfirmingStay(false).withMessage({
          type: "stay_rejected",
          rejection: { type: "no_plan_selected" },
        }),
        "STAY_REJECTED",
      )
    }

    const stayResult = this.innService.stay(state.vault, state.selectedPlan)

    if (stayResult.status === "rejected") {
      return WizSceneResultFactory.reject(
        state
          .withVault(stayResult.vault)
          .withSelectedPlan(null)
          .withConfirmingStay(false)
          .withMessage({
            type: "stay_rejected",
            rejection: stayResult.rejection,
          }),
        "STAY_REJECTED",
      )
    }

    return WizSceneResultFactory.accept(state.withVault(stayResult.vault), {
      type: "GO_TO_VILLAGE",
    })
  }
}
