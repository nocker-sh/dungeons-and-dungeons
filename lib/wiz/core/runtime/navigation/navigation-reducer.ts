import type { WizAction } from "@/lib/wiz/core/runtime/action"
import { WizSceneResultFactory, type WizSceneResult } from "@/lib/wiz/core/runtime/scene-result"
import type { WizState } from "@/lib/wiz/core/runtime/state"
import type { WizSystemAction } from "@/lib/wiz/core/runtime/system/system-action"

export class WizSceneNavigationReducer {
  constructor() {
    Object.freeze(this)
  }

  reduce(state: WizState, action: WizAction | WizSystemAction): WizSceneResult<WizState> {
    if (action.type === "ENCOUNTER_MONSTER") {
      if (state.type !== "exploration") {
        return WizSceneResultFactory.reject(state, "ENCOUNTER_REQUIRES_EXPLORATION")
      }
      const area = state.vault.areas.find((candidate) => candidate.id === state.areaId)
      if (!area) {
        return WizSceneResultFactory.reject(state, "ENCOUNTER_AREA_NOT_FOUND")
      }
      const monster = area.monsters.find((candidate) => candidate.id === action.monsterId)
      if (!monster) {
        return WizSceneResultFactory.reject(state, "ENCOUNTER_TARGET_NOT_IN_AREA")
      }
      const monsterIds = [monster.id]
      const nextState = state.updateVault((v) =>
        v.addLog({ key: "ENCOUNTER_MONSTERS", monsterIds }),
      )

      return WizSceneResultFactory.accept(nextState, {
        type: "START_BATTLE",
        areaId: state.areaId,
        monsterIds,
      })
    }

    if (action.type === "RETURN_TO_VILLAGE") {
      if (state.type !== "exploration") {
        return WizSceneResultFactory.reject(state, "ACTION_NOT_ALLOWED_IN_SCENE")
      }
      const nextState = state.updateVault((v) => v.addLog({ key: "RETURNED_TO_VILLAGE" }))

      return WizSceneResultFactory.accept(nextState, { type: "GO_TO_VILLAGE" })
    }

    return WizSceneResultFactory.accept(state)
  }
}
