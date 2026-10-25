import type { WizRuntimeVaultState } from "@/lib/wiz/core/runtime/services/defeat-service"

type WizRuntimeAreaUnlockResult<TState> = {
  state: TState
  unlockedAreas: string[]
}

export class WizRuntimeAreaUnlockService {
  constructor() {
    Object.freeze(this)
  }

  checkAndUnlock<TState extends WizRuntimeVaultState<TState>>(
    state: TState,
  ): WizRuntimeAreaUnlockResult<TState> {
    let newState = state
    const unlockedAreas: string[] = []

    for (const area of newState.vault.areas) {
      if (!area.unlocked && area.unlockCondition) {
        const requiredArea = newState.vault.areas.find((a) => a.id === area.unlockCondition?.areaId)
        if (
          requiredArea &&
          requiredArea.progress >= (area.unlockCondition?.requiredProgress || 100)
        ) {
          newState = newState.updateVault((v) =>
            v.updateArea(area.id, (a) => ({
              ...a,
              unlocked: true,
            })),
          )
          unlockedAreas.push(area.id)
        }
      }
    }

    return { state: newState, unlockedAreas }
  }

  checkAndUnlockWithLog<TState extends WizRuntimeVaultState<TState>>(state: TState): TState {
    const result = this.checkAndUnlock(state)
    let newState = result.state

    for (const areaId of result.unlockedAreas) {
      newState = newState.updateVault((v) => v.addLog({ key: "AREA_UNLOCKED", areaId }))
    }

    return newState
  }
}
