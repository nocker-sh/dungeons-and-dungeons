import { WizEngineFacilityUnlockService } from "@/lib/wiz/core/engine/facility/wiz-engine-facility-unlock-service"
import type { WizRuntimeVaultState } from "@/lib/wiz/core/runtime/services/defeat-service"

type Dependencies = {
  readonly facilityUnlockService: WizEngineFacilityUnlockService
}

export class WizRuntimeFacilityUnlockService {
  private readonly facilityUnlockService: WizEngineFacilityUnlockService

  constructor(dependencies: Dependencies) {
    this.facilityUnlockService = dependencies.facilityUnlockService
    Object.freeze(this)
  }

  checkAndUnlockWithLog<TState extends WizRuntimeVaultState<TState>>(state: TState): TState {
    const newFacilities = this.facilityUnlockService.getNewlyUnlocked(
      state.vault.areas,
      state.vault.quests,
      state.vault.unlockedFacilities,
    )
    if (newFacilities.length === 0) return state
    let newState = state
    for (const facilityId of newFacilities) {
      newState = newState.updateVault((v) =>
        v.unlockFacility(facilityId).addLog({ key: "FACILITY_UNLOCKED", facilityId }),
      )
    }
    return newState
  }
}
