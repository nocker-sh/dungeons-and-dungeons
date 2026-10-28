import { WizPendingAttributes } from "@/lib/wiz/core/domain/values/pending-attributes"
import { WizEngineLevelUp } from "@/lib/wiz/core/engine/level-up"
import type { WizPartyLevelUpPort } from "@/lib/wiz/core/engine/level-up/party-level-up"
import { WizEngineAbilityLearning } from "@/lib/wiz/core/engine/ability/wiz-engine-ability-learning"
import type { WizAction } from "@/lib/wiz/core/runtime/action"
import { WizSceneResultFactory, type WizSceneResult } from "@/lib/wiz/core/runtime/scene-result"
import type { WizSceneLevelUpAction } from "@/lib/wiz/core/runtime/scenes/level-up/action"
import type { WizStateLevelUp } from "@/lib/wiz/core/runtime/scenes/level-up/state"
import type { WizState } from "@/lib/wiz/core/runtime/state"
import { WIZ_ATTRIBUTE_KEYS, type WizAttributeKey } from "@/lib/wiz/core/types"

const ATTRIBUTE_KEYS = new Set<string>(WIZ_ATTRIBUTE_KEYS)

type Dependencies = {
  readonly levelUpService?: WizEngineLevelUp
  readonly abilityLearning?: WizEngineAbilityLearning
  readonly partyLevelUp?: WizPartyLevelUpPort
}

export class WizSceneLevelUpReducer {
  private readonly levelUpService: WizEngineLevelUp
  private readonly abilityLearning: WizEngineAbilityLearning | null
  private readonly partyLevelUp: WizPartyLevelUpPort | null

  constructor(dependencies: Dependencies = {}) {
    this.levelUpService = dependencies.levelUpService ?? new WizEngineLevelUp()
    this.abilityLearning = dependencies.abilityLearning ?? null
    this.partyLevelUp = dependencies.partyLevelUp ?? null
    Object.freeze(this)
  }

  reduce(state: WizState, action: WizAction | WizSceneLevelUpAction): WizSceneResult<WizState> {
    if (state.type !== "level_up") return WizSceneResultFactory.accept(state)

    if (action.type === "ALLOCATE_ATTRIBUTE") {
      return this.handleAllocateAttribute(state, action)
    }

    if (action.type === "RESET_PENDING_ATTRIBUTES") {
      return this.handleResetPendingAttributes(state)
    }

    if (action.type === "CONFIRM_LEVEL_UP") {
      return this.handleConfirmLevelUp(state)
    }

    return WizSceneResultFactory.accept(state)
  }

  private handleAllocateAttribute(
    state: WizStateLevelUp,
    action: { attribute: WizAttributeKey },
  ): WizSceneResult<WizState> {
    if (state.availablePoints <= 0 || !ATTRIBUTE_KEYS.has(action.attribute)) {
      return WizSceneResultFactory.reject(state, "LEVEL_UP_REJECTED")
    }

    const pendingAttributes = WizPendingAttributes.fromPlain(state.pendingAttributes)
    const updated = pendingAttributes.allocate(action.attribute)

    return WizSceneResultFactory.accept(
      state.withAvailablePoints(state.availablePoints - 1).withPendingAttributes(updated.toPlain()),
    )
  }

  private handleResetPendingAttributes(state: WizStateLevelUp): WizSceneResult<WizState> {
    const pendingAttributes = WizPendingAttributes.fromPlain(state.pendingAttributes)
    const totalPending = pendingAttributes.total
    if (totalPending === 0) {
      return WizSceneResultFactory.reject(state, "LEVEL_UP_REJECTED")
    }
    const reset = pendingAttributes.reset()

    return WizSceneResultFactory.accept(
      state
        .withAvailablePoints(state.availablePoints + totalPending)
        .withPendingAttributes(reset.toPlain()),
    )
  }

  private handleConfirmLevelUp(state: WizStateLevelUp): WizSceneResult<WizState> {
    const pendingAttributes = WizPendingAttributes.fromPlain(state.pendingAttributes)
    if (
      state.availablePoints !== 0 ||
      pendingAttributes.total !== this.levelUpService.getPointsPerLevelUp() ||
      !this.levelUpService.shouldLevelUp(state.vault)
    ) {
      return WizSceneResultFactory.reject(state, "LEVEL_UP_REJECTED")
    }

    let newVault = this.levelUpService
      .applyLevelUp(state.vault, pendingAttributes)
      .addLog({ key: "LEVEL_UP", level: state.vault.player.level + 1 })

    if (this.abilityLearning) {
      const newLevel = state.vault.player.level + 1
      const newAbilities = this.abilityLearning.getNewAbilities(
        newLevel,
        newVault.player.abilityIds,
      )
      newVault = this.abilityLearning.applyNewAbilities(newVault, newAbilities)
      for (const abilityId of newAbilities) {
        newVault = newVault.addLog({ key: "ABILITY_LEARNED", abilityId })
      }
    }

    const newLevel = state.vault.player.level + 1
    if (this.partyLevelUp) {
      newVault = this.partyLevelUp.applyPartyLevelUp(newVault, newLevel)
    }

    if (state.returnAreaId) {
      return WizSceneResultFactory.accept(state.withVault(newVault.withLog([])), {
        type: "GO_TO_EXPLORATION",
        areaId: state.returnAreaId,
      })
    }
    return WizSceneResultFactory.accept(state.withVault(newVault), { type: "GO_TO_VILLAGE" })
  }
}
