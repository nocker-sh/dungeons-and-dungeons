import type { WizContext } from "@/lib/wiz/core/context"
import { WizEngineTimeFactory } from "@/lib/wiz/core/engine/time/wiz-time-factory"
import type { WizAction } from "@/lib/wiz/core/runtime/action"
import { WizRuntimeTimeService } from "@/lib/wiz/core/runtime/services/time-service"
import type { WizState } from "@/lib/wiz/core/runtime/state"
import type { WizSystemAction } from "@/lib/wiz/core/runtime/system/system-action"
import { WizVaultValue } from "@/lib/wiz/core/vault/value"

type Dependencies = {
  readonly context: WizContext
  readonly timeFactory?: WizEngineTimeFactory
  readonly timeService?: WizRuntimeTimeService
}

export class WizSystemReducer {
  private readonly context: WizContext
  private readonly timeFactory: WizEngineTimeFactory
  private readonly timeService: WizRuntimeTimeService

  constructor(dependencies: Dependencies) {
    this.context = dependencies.context
    this.timeFactory = dependencies.timeFactory ?? new WizEngineTimeFactory()
    this.timeService = dependencies.timeService ?? new WizRuntimeTimeService()
    Object.freeze(this)
  }

  reduce(state: WizState, action: WizAction | WizSystemAction): WizState {
    if (action.type === "ADD_LOG") {
      return state.updateVault((v) => v.addLog(action.message))
    }

    if (action.type === "ADVANCE_TIME") {
      return this.timeService.advanceWithLog(state)
    }

    if (action.type === "NEW_DAY") {
      return state.updateVault((v) =>
        v
          .updatePlayer((p) => p.resetAp())
          .withTime({
            ...v.time,
            day: v.time.day + 1,
            timeOfDay: "morning",
            weather: this.timeFactory.rollWeather(v.time.season),
          }),
      )
    }

    if (action.type === "WORLD_ENDED") {
      return state.updateVault((v) => v.withEnded(true))
    }

    if (action.type === "WORLD_RESET") {
      const initialVault = this.context.initialVault
      const initialWorldState = this.context.initialWorldState
      return initialWorldState.withVault(
        WizVaultValue.fromPlain({
          ...initialVault.toPlain(),
          log: [{ key: "WORLD_STARTED" }],
        }),
      )
    }

    return state
  }
}
