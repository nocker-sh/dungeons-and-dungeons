import type { WizBattleParty } from "@/lib/wiz/core/engine/battle/actors/party"
import { getBattleActionItemId } from "@/lib/wiz/core/engine/battle/execution/get-battle-action-item-id"
import type { WizEngineBattleExecutionRejectionReason } from "@/lib/wiz/core/engine/battle/execution/execution-result"
import type { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"
import { WizEngineLevelUp } from "@/lib/wiz/core/engine/level-up"
import { WizEngineBattleReward } from "@/lib/wiz/core/engine/reward/battle-reward"
import { WizEngineTimeFactory } from "@/lib/wiz/core/engine/time/wiz-time-factory"
import type { WizAction } from "@/lib/wiz/core/runtime/action"
import type { WizRuntimeContentView } from "@/lib/wiz/core/runtime/content-view"
import {
  WizSceneResultFactory,
  type WizSceneResult,
} from "@/lib/wiz/core/runtime/scene-result"
import type { WizSceneBattleAction } from "@/lib/wiz/core/runtime/scenes/battle/action"
import type { WizStandardInventoryService } from "@/lib/wiz/core/rpg/standard-inventory"
import {
  WizSceneBattleDefaultRewardSettlement,
  type WizSceneBattleRewardSettlement,
  type WizSceneBattleRewardSettlementRejectionReason,
  WizSceneBattleRewardSettlementResult,
} from "@/lib/wiz/core/runtime/scenes/battle/reward-settlement"
import type { WizStateBattle } from "@/lib/wiz/core/runtime/scenes/battle/state"
import { WizSceneBattleService } from "@/lib/wiz/core/runtime/scenes/battle/wiz-battle-service"
import { WizRuntimeAreaUnlockService } from "@/lib/wiz/core/runtime/services/area-unlock-service"
import {
  type WizRuntimeDefeatPolicy,
  WizRuntimeDefeatService,
} from "@/lib/wiz/core/runtime/services/defeat-service"
import {
  WizBattleLog,
  type WizLogMessage,
} from "@/lib/wiz/core/types/wiz-log-message"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"
import {
  createWizStandardHungerService,
  type WizHungerServicePort,
} from "@/lib/wiz/core/vault/states/player/services/wiz-hunger-service"

type WizSceneBattleRejectionReason<
  TExecutionReason extends string,
  TSettlementReason extends string,
> =
  | WizEngineBattleExecutionRejectionReason
  | WizSceneBattleRewardSettlementRejectionReason
  | TExecutionReason
  | TSettlementReason

type WizSceneBattleReducerResult<
  TStatus,
  TCustom,
  TRewardCustom,
  TExecutionReason extends string,
  TSettlementReason extends string,
> = WizSceneResult<
  WizStateBattle<TStatus, TCustom, TRewardCustom>,
  never,
  WizSceneBattleRejectionReason<TExecutionReason, TSettlementReason>
>

type Dependencies<
  TStatus = unknown,
  TCustom = unknown,
  TRewardCustom = undefined,
  TExecutionReason extends string = WizEngineBattleExecutionRejectionReason,
  TSettlementReason extends string =
    WizSceneBattleRewardSettlementRejectionReason,
> = {
  readonly battleService: WizSceneBattleService<
    TStatus,
    TCustom,
    TRewardCustom,
    TExecutionReason
  >
  readonly content: Pick<WizRuntimeContentView, "items">
  readonly inventoryService: WizStandardInventoryService
  readonly areaUnlockService?: WizRuntimeAreaUnlockService
  readonly defeatService?: WizRuntimeDefeatPolicy
  readonly levelUpService?: WizEngineLevelUp
  readonly timeFactory?: WizEngineTimeFactory
  readonly hungerService?: WizHungerServicePort
  readonly rewardSettlement?: WizSceneBattleRewardSettlement<
    TStatus,
    TCustom,
    TRewardCustom,
    TSettlementReason
  >
}

export type WizSceneBattleReducerPort<
  TStatus = unknown,
  TCustom = unknown,
  TRewardCustom = undefined,
  TExecutionReason extends string = WizEngineBattleExecutionRejectionReason,
  TSettlementReason extends string =
    WizSceneBattleRewardSettlementRejectionReason,
> = Readonly<{
  readonly reduce: (
    state: WizStateBattle<TStatus, TCustom, TRewardCustom>,
    action: WizAction | WizSceneBattleAction
  ) => WizSceneBattleReducerResult<
    TStatus,
    TCustom,
    TRewardCustom,
    TExecutionReason,
    TSettlementReason
  >
}>

function addLogsToVault(
  vault: WizVaultValue,
  logs: readonly WizLogMessage[]
): WizVaultValue {
  let result = vault
  for (const log of logs) {
    result = result.addLog(log)
  }
  return result
}

export class WizSceneBattleReducer<
  TStatus = unknown,
  TCustom = unknown,
  TRewardCustom = undefined,
  TExecutionReason extends string = WizEngineBattleExecutionRejectionReason,
  TSettlementReason extends string =
    WizSceneBattleRewardSettlementRejectionReason,
> implements WizSceneBattleReducerPort<
  TStatus,
  TCustom,
  TRewardCustom,
  TExecutionReason,
  TSettlementReason
> {
  private readonly battleService: WizSceneBattleService<
    TStatus,
    TCustom,
    TRewardCustom,
    TExecutionReason
  >
  private readonly areaUnlockService: WizRuntimeAreaUnlockService
  private readonly defeatService: WizRuntimeDefeatPolicy
  private readonly levelUpService: WizEngineLevelUp
  private readonly timeFactory: WizEngineTimeFactory
  private readonly hungerService: WizHungerServicePort
  private readonly rewardSettlement: WizSceneBattleRewardSettlement<
    TStatus,
    TCustom,
    TRewardCustom,
    TSettlementReason | WizSceneBattleRewardSettlementRejectionReason
  >

  constructor(
    dependencies: Dependencies<
      TStatus,
      TCustom,
      TRewardCustom,
      TExecutionReason,
      TSettlementReason
    >
  ) {
    this.battleService = dependencies.battleService
    this.areaUnlockService =
      dependencies.areaUnlockService ?? new WizRuntimeAreaUnlockService()
    this.defeatService =
      dependencies.defeatService ?? new WizRuntimeDefeatService()
    this.levelUpService = dependencies.levelUpService ?? new WizEngineLevelUp()
    this.timeFactory = dependencies.timeFactory ?? new WizEngineTimeFactory()
    this.hungerService =
      dependencies.hungerService ?? createWizStandardHungerService()
    const rewardSettlement =
      dependencies.rewardSettlement ??
      new WizSceneBattleDefaultRewardSettlement<
        TStatus,
        TCustom,
        TRewardCustom
      >({
        content: dependencies.content,
        inventoryService: dependencies.inventoryService,
      })
    this.rewardSettlement = Object.freeze({
      settle: Object.freeze(rewardSettlement.settle.bind(rewardSettlement)),
    })
    Object.freeze(this)
  }

  reduce(
    state: WizStateBattle<TStatus, TCustom, TRewardCustom>,
    action: WizAction | WizSceneBattleAction
  ): WizSceneBattleReducerResult<
    TStatus,
    TCustom,
    TRewardCustom,
    TExecutionReason,
    TSettlementReason
  > {
    if (state.type !== "battle") {
      throw new TypeError("Battle reducer requires a battle state")
    }

    if (action.type === "BATTLE_START") {
      return this.handleBattleStart(state)
    }

    if (action.type === "BATTLE_FLEE") {
      return this.handleBattleFlee(state)
    }

    if (action.type === "BATTLE_EXECUTE_ACTION") {
      return this.handleExecuteAction(state, action)
    }

    if (action.type === "BATTLE_EXECUTE_ENEMY_TURN") {
      return this.handleExecuteEnemyTurn(state)
    }

    if (action.type === "BATTLE_END") {
      return this.handleBattleEnd(state)
    }

    return WizSceneResultFactory.accept(state)
  }

  private handleBattleStart(
    state: WizStateBattle<TStatus, TCustom, TRewardCustom>
  ): WizSceneBattleReducerResult<
    TStatus,
    TCustom,
    TRewardCustom,
    TExecutionReason,
    TSettlementReason
  > {
    if (state.phase.phase !== "encounter")
      return WizSceneResultFactory.accept(state)
    const turnOrderScene = this.battleService.createTurnOrderScene(state.phase)
    const newVault = state.vault.addLog({ key: "BATTLE_START" })
    return WizSceneResultFactory.accept(
      state.withPhase(turnOrderScene).withVault(newVault)
    )
  }

  private handleBattleFlee(
    state: WizStateBattle<TStatus, TCustom, TRewardCustom>
  ): WizSceneBattleReducerResult<
    TStatus,
    TCustom,
    TRewardCustom,
    TExecutionReason,
    TSettlementReason
  > {
    if (state.phase.phase !== "encounter")
      return WizSceneResultFactory.accept(state)
    const newVault = state.vault.withLog([]).addLog({ key: "FLED_BATTLE" })
    return WizSceneResultFactory.accept(state.withVault(newVault), {
      type: "GO_TO_EXPLORATION",
      areaId: state.returnAreaId,
    })
  }

  private getWeatherBonus(
    state: WizStateBattle<TStatus, TCustom, TRewardCustom>
  ): number {
    const weather = state.vault.time.weather
    return this.timeFactory.getWeatherEffect(weather).combatBonus
  }

  private getAbilityPowerMultiplier(
    state: WizStateBattle<TStatus, TCustom, TRewardCustom>
  ): number {
    const impact = this.hungerService.getHungerImpact(state.vault.player.hunger)
    return impact.abilityPowerMultiplier
  }

  private handleExecuteAction(
    state: WizStateBattle<TStatus, TCustom, TRewardCustom>,
    action: Extract<WizSceneBattleAction, { type: "BATTLE_EXECUTE_ACTION" }>
  ): WizSceneBattleReducerResult<
    TStatus,
    TCustom,
    TRewardCustom,
    TExecutionReason,
    TSettlementReason
  > {
    if (state.phase.phase !== "turnOrder")
      return WizSceneResultFactory.accept(state)

    const weatherBonus = this.getWeatherBonus(state)
    const abilityPowerMultiplier = this.getAbilityPowerMultiplier(state)
    const result = this.battleService.executeAction(
      state.phase,
      action.action,
      {
        weatherBonus,
        abilityPowerMultiplier,
        actorAbilityIds: this.getActorAbilityIds(
          state.vault,
          action.action.actorId
        ),
        availableItemIds: this.getAvailableItemIds(state.vault),
      }
    )
    if (!result.accepted)
      return WizSceneResultFactory.reject(state, result.reason)

    const nextScene = result.scene
    const vaultAfterConsumption = this.consumeAcceptedItem(
      state.vault,
      result.action
    )
    const vaultAfterLogs = addLogsToVault(vaultAfterConsumption, result.logs)

    if (nextScene.phase === "victory") {
      return this.applyVictory(state, nextScene, vaultAfterLogs)
    }

    if (nextScene.phase === "defeat") {
      return this.applyDefeat(state, nextScene, vaultAfterLogs)
    }

    if (this.isPartyAllFled(nextScene)) {
      return this.applyFleeSuccess(state, nextScene, vaultAfterLogs)
    }

    if (this.battleService.isTurnComplete(nextScene)) {
      return this.applyNextTurn(state, nextScene, vaultAfterLogs)
    }

    return WizSceneResultFactory.accept(
      state
        .withPhase(nextScene)
        .withVault(
          this.syncPartyToVault(vaultAfterLogs, nextScene.context.party)
        )
    )
  }

  private applyVictory(
    state: WizStateBattle<TStatus, TCustom, TRewardCustom>,
    scene: Extract<
      WizStateBattle<TStatus, TCustom, TRewardCustom>["phase"],
      { phase: "victory" }
    >,
    vault: WizVaultValue
  ): WizSceneBattleReducerResult<
    TStatus,
    TCustom,
    TRewardCustom,
    TExecutionReason,
    TSettlementReason
  > {
    const reward = this.battleService.rewardCalculator.calculate(scene.context)
    WizEngineBattleReward.assertAuthentic(reward)
    const victoryWithReward = scene.withReward(reward)

    const settlementResult = this.rewardSettlement.settle({
      vault,
      reward,
      returnAreaId: state.returnAreaId,
      enemies: scene.context.enemies,
    })
    WizSceneBattleRewardSettlementResult.assertAuthentic(settlementResult)
    if (settlementResult.isRejected()) {
      return WizSceneResultFactory.reject(state, settlementResult.reason)
    }
    const newVault = this.syncPartyToVault(
      settlementResult.vault,
      victoryWithReward.context.party
    )

    const stateAfterVictory = this.areaUnlockService.checkAndUnlockWithLog(
      state.withPhase(victoryWithReward).withVault(newVault)
    )

    if (this.levelUpService.shouldLevelUp(stateAfterVictory.vault)) {
      return WizSceneResultFactory.accept(stateAfterVictory, {
        type: "GO_TO_LEVEL_UP",
        returnAreaId: state.returnAreaId,
      })
    }

    return WizSceneResultFactory.accept(stateAfterVictory)
  }

  private applyDefeat(
    state: WizStateBattle<TStatus, TCustom, TRewardCustom>,
    scene: Extract<
      WizStateBattle<TStatus, TCustom, TRewardCustom>["phase"],
      { phase: "defeat" }
    >,
    vault: WizVaultValue
  ): WizSceneBattleReducerResult<
    TStatus,
    TCustom,
    TRewardCustom,
    TExecutionReason,
    TSettlementReason
  > {
    const newVault = this.syncPartyToVault(vault, scene.context.party)
      .updatePlayer((p) => p.withHp(0))
      .addLog({ key: "BATTLE_DEFEAT" })

    return WizSceneResultFactory.accept(
      this.defeatService.check(state.withPhase(scene).withVault(newVault)).state
    )
  }

  private applyFleeSuccess(
    state: WizStateBattle<TStatus, TCustom, TRewardCustom>,
    scene: Extract<
      WizStateBattle<TStatus, TCustom, TRewardCustom>["phase"],
      { phase: "turnOrder" }
    >,
    vault: WizVaultValue
  ): WizSceneBattleReducerResult<
    TStatus,
    TCustom,
    TRewardCustom,
    TExecutionReason,
    TSettlementReason
  > {
    const newVault = this.syncPartyToVault(vault, scene.context.party)
      .withLog([])
      .addLog({ key: "FLED_SUCCESS" })

    return WizSceneResultFactory.accept(
      state.withPhase(scene).withVault(newVault),
      {
        type: "GO_TO_EXPLORATION",
        areaId: state.returnAreaId,
      }
    )
  }

  private applyNextTurn(
    state: WizStateBattle<TStatus, TCustom, TRewardCustom>,
    scene: Extract<
      WizStateBattle<TStatus, TCustom, TRewardCustom>["phase"],
      { phase: "turnOrder" }
    >,
    vault: WizVaultValue
  ): WizSceneBattleReducerResult<
    TStatus,
    TCustom,
    TRewardCustom,
    TExecutionReason,
    TSettlementReason
  > {
    const newTurn = this.battleService.toNextTurn(scene)
    const newVault = this.syncPartyToVault(vault, scene.context.party).addLog({
      key: "TURN_START",
      turnNumber: newTurn.context.turnNumber,
    })

    return WizSceneResultFactory.accept(
      state.withPhase(newTurn).withVault(newVault)
    )
  }

  private isPartyAllFled(
    scene: WizStateBattle<TStatus, TCustom, TRewardCustom>["phase"]
  ): boolean {
    if (scene.phase !== "turnOrder") return false
    return scene.context.party.hasAllLivingMembersFled()
  }

  private handleExecuteEnemyTurn(
    state: WizStateBattle<TStatus, TCustom, TRewardCustom>
  ): WizSceneBattleReducerResult<
    TStatus,
    TCustom,
    TRewardCustom,
    TExecutionReason,
    TSettlementReason
  > {
    if (state.phase.phase !== "turnOrder")
      return WizSceneResultFactory.accept(state)
    const currentActor = this.battleService.getCurrentActor(state.phase)
    if (!currentActor || !currentActor.isEnemy) {
      return WizSceneResultFactory.accept(state)
    }

    const enemyAction = this.battleService.selectEnemyAction(
      currentActor.id,
      state.phase
    )
    if (!enemyAction) {
      const skipResult = this.battleService.skipCurrentActor(state.phase)
      const newVault = state.vault.addLog(
        WizBattleLog.actorCannotAct(currentActor.id)
      )
      return WizSceneResultFactory.accept(
        state.withPhase(skipResult).withVault(newVault)
      )
    }

    const weatherBonus = this.getWeatherBonus(state)
    const abilityPowerMultiplier = this.getAbilityPowerMultiplier(state)
    const result = this.battleService.executeAction(state.phase, enemyAction, {
      weatherBonus,
      abilityPowerMultiplier,
      actorAbilityIds: [],
      availableItemIds: [],
    })
    if (!result.accepted)
      return WizSceneResultFactory.reject(state, result.reason)

    const newWizScene = result.scene
    const newVault = addLogsToVault(state.vault, result.logs)

    if (newWizScene.phase === "defeat") {
      return this.applyDefeat(state, newWizScene, newVault)
    }

    if (newWizScene.phase === "turnOrder") {
      if (this.battleService.isTurnComplete(newWizScene)) {
        return this.applyNextTurn(state, newWizScene, newVault)
      }
    }

    return WizSceneResultFactory.accept(
      state
        .withPhase(newWizScene)
        .withVault(this.syncPartyToVault(newVault, newWizScene.context.party))
    )
  }

  private syncPartyToVault(
    vault: WizVaultValue,
    party: WizBattleParty<TStatus>
  ): WizVaultValue {
    const updatedMembers = vault.partyMembers.map((member) => {
      const battleMember = party.getMemberById(member.id)
      if (!battleMember) return member
      return {
        ...member,
        hp: Math.max(0, battleMember.status.resources.current("health")),
        mp: Math.max(0, battleMember.status.resources.current("mana")),
      }
    })
    const vaultWithMembers = vault.withPartyMembers(updatedMembers)
    const battlePlayer = party.getMemberById("player")
    if (!battlePlayer) return vaultWithMembers

    return vaultWithMembers.updatePlayer((player) =>
      player
        .withHp(Math.max(0, battlePlayer.status.resources.current("health")))
        .withMp(Math.max(0, battlePlayer.status.resources.current("mana")))
    )
  }

  private getActorAbilityIds(
    vault: WizVaultValue,
    actorId: string
  ): readonly string[] {
    if (actorId === "player") return vault.player.abilityIds
    return (
      vault.partyMembers.find((member) => member.id === actorId)?.abilityIds ??
      []
    )
  }

  private getAvailableItemIds(vault: WizVaultValue): readonly string[] {
    return vault.inventory.entries
      .filter((entry) => entry.contentType === "item" && entry.quantity > 0)
      .map((entry) => entry.contentId)
  }

  private consumeAcceptedItem(
    vault: WizVaultValue,
    action: WizEngineBattleTurnAction | null
  ): WizVaultValue {
    if (!action) return vault
    const itemId = getBattleActionItemId(action)
    if (!itemId) return vault
    const entry = vault.inventory.entriesFor("item", itemId)[0]
    if (entry === undefined) return vault
    return vault.updateInventory((inventory) =>
      inventory.consume(entry.entryId)
    )
  }

  private handleBattleEnd(
    state: WizStateBattle<TStatus, TCustom, TRewardCustom>
  ): WizSceneBattleReducerResult<
    TStatus,
    TCustom,
    TRewardCustom,
    TExecutionReason,
    TSettlementReason
  > {
    if (state.phase.phase !== "victory" && state.phase.phase !== "defeat") {
      return WizSceneResultFactory.accept(state)
    }
    if (state.phase.phase === "victory") {
      return WizSceneResultFactory.accept(
        state.updateVault((v) => v.withLog([])),
        {
          type: "GO_TO_EXPLORATION",
          areaId: state.returnAreaId,
        }
      )
    }
    return WizSceneResultFactory.accept(state, { type: "GO_TO_VILLAGE" })
  }
}
