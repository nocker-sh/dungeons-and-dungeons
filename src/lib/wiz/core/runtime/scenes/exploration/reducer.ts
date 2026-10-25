import {
  DEFAULT_EXPLORATION_PROBABILITY_CONFIG,
  type WizExplorationProbabilityConfig,
} from "@/lib/wiz/core/config/exploration/wiz-exploration-probability-config"
import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"
import type { WizItemEffectApplicationService } from "@/lib/wiz/core/domain/services/item-effect-service"
import { WizEngineApService } from "@/lib/wiz/core/engine/ap/wiz-engine-ap-service"
import { rollEncounter } from "@/lib/wiz/core/engine/encounter/roll-encounter"
import { WizEngineExplorationEventProgress } from "@/lib/wiz/core/engine/exploration/event-progress"
import {
  WizEngineExplorationEventReward,
  type WizEngineExplorationEventRewardService,
} from "@/lib/wiz/core/engine/exploration/event-reward"
import { WizEngineExplorationSkillCheck } from "@/lib/wiz/core/engine/exploration/skill-check"
import { WizVaultPlayerItemEffectService } from "@/lib/wiz/core/engine/inventory/wiz-vault-item-effect-service"
import { WizEngineTimeFactory } from "@/lib/wiz/core/engine/time/wiz-time-factory"
import type { WizAction } from "@/lib/wiz/core/runtime/action"
import {
  getWizRuntimeContentEntry,
  type WizRuntimeContentView,
} from "@/lib/wiz/core/runtime/content-view"
import { WizSceneResultFactory, type WizSceneResult } from "@/lib/wiz/core/runtime/scene-result"
import type { WizSceneExplorationAction } from "@/lib/wiz/core/runtime/scenes/exploration/action"
import type { WizStateExploration } from "@/lib/wiz/core/runtime/scenes/exploration/states/state"
import { WizRuntimeAreaUnlockService } from "@/lib/wiz/core/runtime/services/area-unlock-service"
import { WizRuntimeFacilityUnlockService } from "@/lib/wiz/core/runtime/services/facility-unlock-service"
import {
  type WizRuntimeDefeatPolicy,
  WizRuntimeDefeatService,
} from "@/lib/wiz/core/runtime/services/defeat-service"
import { WizRuntimeTimeService } from "@/lib/wiz/core/runtime/services/time-service"
import { WizDice } from "@/lib/wiz/core/services/wiz-dice"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizStandardInventoryService } from "@/lib/wiz/core/rpg/standard-inventory"
import type { WizVaultAreaState } from "@/lib/wiz/core/vault/states/area/schema"
import type { WizHungerServicePort } from "@/lib/wiz/core/vault/states/player/services/wiz-hunger-service"
import type { WizVaultPlayer } from "@/lib/wiz/core/vault/states/player/value"

export type WizSceneExplorationReducerDefinition = {
  readonly content: Pick<WizRuntimeContentView, "items">
  readonly inventoryService: WizStandardInventoryService
  readonly dice?: WizDice
  readonly rewardService?: WizEngineExplorationEventRewardService
  readonly skillCheckService?: WizEngineExplorationSkillCheck
  readonly timeFactory?: WizEngineTimeFactory
  readonly apService?: WizEngineApService
  readonly itemEffectService?: WizItemEffectApplicationService<WizVaultPlayer>
  readonly facilityUnlockService?: WizRuntimeFacilityUnlockService
  readonly defeatService?: WizRuntimeDefeatPolicy
  readonly hungerService?: WizHungerServicePort
  readonly probabilityConfig?: WizExplorationProbabilityConfig
}

/**
 * standard explorationを差し替えるstructural reducer port。
 */
export type WizSceneExplorationRejectionReason =
  | "EVENT_CHOICE_REJECTED"
  | "EVENT_ROLL_REJECTED"
  | "EXPLORATION_ACTION_REJECTED"
  | "FOOD_REJECTED"
  | "GATHER_REJECTED"

export type WizSceneExplorationReducerPort<
  TReason extends string = WizSceneExplorationRejectionReason,
> = Readonly<{
  readonly reduce: (
    state: WizStateExploration,
    action: WizAction | WizSceneExplorationAction,
  ) => WizSceneResult<WizStateExploration, never, TReason>
}>

const explorationReducerOwnership = new WizObjectService()

const ownExplorationContent = (
  content: Pick<WizRuntimeContentView, "items">,
): Pick<WizRuntimeContentView, "items"> =>
  explorationReducerOwnership.ownImmutable({
    items: content.items,
  })

const captureExplorationRewardService = (
  service: WizEngineExplorationEventRewardService,
): WizEngineExplorationEventRewardService => {
  if (
    typeof service !== "object" ||
    service === null ||
    typeof service.applyReward !== "function" ||
    typeof service.applyPenalty !== "function"
  ) {
    throw new TypeError(
      "Exploration reward service must provide applyReward and applyPenalty functions",
    )
  }
  return Object.freeze({
    applyReward: Object.freeze(service.applyReward.bind(service)),
    applyPenalty: Object.freeze(service.applyPenalty.bind(service)),
  })
}

const captureItemEffectService = (
  service: WizItemEffectApplicationService<WizVaultPlayer>,
): WizItemEffectApplicationService<WizVaultPlayer> => {
  if (typeof service !== "object" || service === null || typeof service.apply !== "function") {
    throw new TypeError("Exploration item effect service must provide an apply function")
  }
  return Object.freeze({
    apply: Object.freeze(service.apply.bind(service)),
  })
}

export class WizSceneExplorationReducer implements WizSceneExplorationReducerPort {
  private readonly content: Pick<WizRuntimeContentView, "items">
  private readonly dice: WizDice
  private readonly rewardService: WizEngineExplorationEventRewardService
  private readonly inventoryService: WizStandardInventoryService
  private readonly skillCheckService: WizEngineExplorationSkillCheck
  private readonly areaUnlockService: WizRuntimeAreaUnlockService
  private readonly defeatService: WizRuntimeDefeatPolicy
  private readonly timeService: WizRuntimeTimeService
  private readonly timeFactory: WizEngineTimeFactory
  private readonly apService: WizEngineApService
  private readonly itemEffectService: WizItemEffectApplicationService<WizVaultPlayer>
  private readonly facilityUnlockService: WizRuntimeFacilityUnlockService | null
  private readonly probabilityConfig: WizExplorationProbabilityConfig

  constructor(dependencies: WizSceneExplorationReducerDefinition) {
    this.content = ownExplorationContent(dependencies.content)
    this.dice = dependencies.dice ?? new WizDice()
    this.rewardService = captureExplorationRewardService(
      dependencies.rewardService ??
        new WizEngineExplorationEventReward(dependencies.inventoryService),
    )
    this.inventoryService = dependencies.inventoryService
    this.skillCheckService =
      dependencies.skillCheckService ?? new WizEngineExplorationSkillCheck(this.dice)
    this.areaUnlockService = new WizRuntimeAreaUnlockService()
    this.defeatService = dependencies.defeatService ?? new WizRuntimeDefeatService()
    this.timeFactory = dependencies.timeFactory ?? new WizEngineTimeFactory()
    this.timeService = new WizRuntimeTimeService({
      defeatService: this.defeatService,
      hungerService: dependencies.hungerService,
      timeFactory: this.timeFactory,
    })
    this.apService = dependencies.apService ?? new WizEngineApService()
    this.itemEffectService = captureItemEffectService(
      dependencies.itemEffectService ?? new WizVaultPlayerItemEffectService(),
    )
    this.facilityUnlockService = dependencies.facilityUnlockService ?? null
    this.probabilityConfig = immutableConfig(
      dependencies.probabilityConfig ?? DEFAULT_EXPLORATION_PROBABILITY_CONFIG,
    )
    Object.freeze(this)
  }

  readonly reduce = (
    state: WizStateExploration,
    action: WizAction | WizSceneExplorationAction,
  ): WizSceneResult<WizStateExploration, never, WizSceneExplorationRejectionReason> => {
    if (state.type !== "exploration") {
      throw new TypeError("Exploration reducer requires an exploration state")
    }

    if (action.type === "EXPLORATION_ACTION") {
      return this.handleExplorationAction(state, action)
    }

    if (action.type === "SELECT_EVENT_CHOICE") {
      return this.handleSelectEventChoice(state, action)
    }

    if (action.type === "ROLL_DICE") {
      return this.handleRollDice(state)
    }

    if (action.type === "EAT_FOOD") {
      return this.handleEatFood(state, action)
    }

    if (action.type === "CONTINUE_EXPLORATION") {
      return this.handleContinueExploration(state)
    }

    return WizSceneResultFactory.accept(state)
  }

  private handleExplorationAction(
    state: WizStateExploration,
    action: Extract<WizSceneExplorationAction, { type: "EXPLORATION_ACTION" }>,
  ): WizSceneResult<WizStateExploration, never, WizSceneExplorationRejectionReason> {
    const area = state.vault.areas.find((a) => a.id === state.areaId)
    if (!area) {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "action_rejected",
          action: action.action,
          areaId: state.areaId,
          reason: "area_not_found",
        }),
        "EXPLORATION_ACTION_REJECTED",
      )
    }

    if (action.action === "explore" || action.action === "gather" || action.action === "hunt") {
      if (!this.apService.canAct(state.vault.player.ap)) {
        return WizSceneResultFactory.reject(
          state
            .updateVault((v) => v.addLog({ key: "NOT_ENOUGH_AP" }))
            .withMessage({
              type: "action_rejected",
              action: action.action,
              areaId: state.areaId,
              reason: "not_enough_ap",
            }),
          "EXPLORATION_ACTION_REJECTED",
        )
      }
    }

    if (action.action === "explore") {
      return this.handleExplore(state, area)
    }

    if (action.action === "gather") {
      return this.handleGather(state, area)
    }

    if (action.action === "hunt") {
      return this.handleHunt(state, area)
    }

    if (action.action === "rest") {
      return this.handleRest(state)
    }

    return WizSceneResultFactory.accept(state)
  }

  private handleExplore(
    state: WizStateExploration,
    area: WizVaultAreaState,
  ): WizSceneResult<WizStateExploration, never, WizSceneExplorationRejectionReason> {
    const stateAfterAp = state
      .withMessage(null)
      .updateVault((v) => v.updatePlayer((p) => p.useAp(1)))
    const timeEffect = this.timeFactory.getTimeEffect(stateAfterAp.vault.time.timeOfDay)
    const weatherEffect = this.timeFactory.getWeatherEffect(stateAfterAp.vault.time.weather)
    const monsterChance = Math.round(
      this.probabilityConfig.monsterEncounterBase * timeEffect.monsterEncounterRate,
    )
    if (this.dice.chance(monsterChance) && area.monsters.length > 0) {
      const enemies = rollEncounter(area.monsters, this.dice)
      const monsterIds = enemies.map((monster) => monster.id)
      const nextState = stateAfterAp.updateVault((v) =>
        v
          .incrementAreaProgress(stateAfterAp.areaId, 10)
          .addLog({ key: "ENCOUNTER_MONSTERS", monsterIds }),
      )
      let unlockedState = this.areaUnlockService.checkAndUnlockWithLog(nextState)
      if (this.facilityUnlockService) {
        unlockedState = this.facilityUnlockService.checkAndUnlockWithLog(unlockedState)
      }
      return WizSceneResultFactory.accept(unlockedState, {
        type: "START_BATTLE",
        areaId: stateAfterAp.areaId,
        monsterIds,
      })
    }
    const eventChance = Math.max(
      this.probabilityConfig.eventMin,
      Math.min(
        this.probabilityConfig.eventMax,
        this.probabilityConfig.eventBase +
          weatherEffect.explorationBonus * this.probabilityConfig.eventWeatherCoefficient,
      ),
    )
    if (this.dice.chance(eventChance) && area.events.length > 0) {
      const event = this.dice.pick(area.events)
      if (event) {
        let nextState: WizStateExploration = stateAfterAp
          .withEventProgress(WizEngineExplorationEventProgress.encounter(event).toPlain())
          .withMessage({
            type: "event_encountered",
            eventId: event.id,
          })
          .updateVault((v) => v.incrementAreaProgress(stateAfterAp.areaId, 10))
        nextState = this.areaUnlockService.checkAndUnlockWithLog(nextState)
        if (this.facilityUnlockService) {
          nextState = this.facilityUnlockService.checkAndUnlockWithLog(nextState)
        }
        return WizSceneResultFactory.accept(nextState)
      }
    }
    let newState: WizStateExploration = stateAfterAp.updateVault((v) =>
      v.incrementAreaProgress(stateAfterAp.areaId, 10).addLog({ key: "EXPLORED_AREA" }),
    )
    newState = this.areaUnlockService.checkAndUnlockWithLog(newState)
    if (this.facilityUnlockService) {
      newState = this.facilityUnlockService.checkAndUnlockWithLog(newState)
    }
    return WizSceneResultFactory.accept(
      this.timeService.advanceWithLog(newState, this.getHungerCostForArea(area.dangerLevel)),
    )
  }

  private handleGather(
    state: WizStateExploration,
    area: WizVaultAreaState,
  ): WizSceneResult<WizStateExploration, never, WizSceneExplorationRejectionReason> {
    const stateAfterAp = state
      .withMessage(null)
      .updateVault((v) => v.updatePlayer((p) => p.useAp(1)))
    if (area.availableGathering.length === 0) {
      return WizSceneResultFactory.reject(
        stateAfterAp
          .updateVault((v) => v.addLog({ key: "NO_GATHERING_AVAILABLE" }))
          .withMessage({
            type: "gather_rejected",
            areaId: stateAfterAp.areaId,
            reason: "nothing_available",
          }),
        "GATHER_REJECTED",
      )
    }

    const seasonEffect = this.timeFactory.getSeasonEffect(stateAfterAp.vault.time.season)
    const weatherEffect = this.timeFactory.getWeatherEffect(stateAfterAp.vault.time.weather)
    const gatheringBonus = seasonEffect.gatheringBonus + weatherEffect.gatheringBonus

    if (gatheringBonus <= -2) {
      return WizSceneResultFactory.reject(
        stateAfterAp
          .updateVault((v) => v.incrementAreaProgress(stateAfterAp.areaId, 5))
          .withMessage({
            type: "gather_rejected",
            areaId: stateAfterAp.areaId,
            reason: "environment",
          }),
        "GATHER_REJECTED",
      )
    }

    const itemId = this.dice.pick(area.availableGathering)
    if (!itemId) {
      return WizSceneResultFactory.reject(
        stateAfterAp.withMessage({
          type: "action_rejected",
          action: "gather",
          areaId: stateAfterAp.areaId,
          reason: "random_selection_failed",
        }),
        "EXPLORATION_ACTION_REJECTED",
      )
    }
    const item = getWizRuntimeContentEntry(this.content.items, itemId)
    if (!item) {
      return WizSceneResultFactory.reject(
        stateAfterAp.withMessage({
          type: "action_rejected",
          action: "gather",
          areaId: stateAfterAp.areaId,
          reason: "content_not_found",
          referenceId: itemId,
        }),
        "EXPLORATION_ACTION_REJECTED",
      )
    }

    const bonusItemId = gatheringBonus >= 2 ? this.dice.pick(area.availableGathering) : null
    const hasValidBonusItem =
      bonusItemId !== null &&
      getWizRuntimeContentEntry(this.content.items, bonusItemId) !== undefined
    const gatheredItemIds = Object.freeze([
      itemId,
      ...(hasValidBonusItem && bonusItemId !== null ? [bonusItemId] : []),
    ])
    const vaultWithItems = gatheredItemIds
      .reduce(
        (vault, gatheredItemId) =>
          vault.updateInventory((inventory) =>
            this.inventoryService.add(inventory, "item", gatheredItemId),
          ),
        stateAfterAp.vault,
      )
      .incrementAreaProgress(stateAfterAp.areaId, 5)
    const vaultWithLogs = gatheredItemIds.reduce(
      (vault, gatheredItemId) => vault.addLog({ key: "GATHERED_ITEM", itemId: gatheredItemId }),
      vaultWithItems,
    )
    const vaultWithQuestProgress = [...new Set(gatheredItemIds)].reduce(
      (vault, gatheredItemId) => vault.updateQuestProgressGather(gatheredItemId),
      vaultWithLogs,
    )
    const gathered = stateAfterAp.withVault(vaultWithQuestProgress).withMessage({
      type: "items_gathered",
      areaId: stateAfterAp.areaId,
      itemIds: gatheredItemIds,
    })

    let newState: WizStateExploration = this.areaUnlockService.checkAndUnlockWithLog(gathered)
    if (this.facilityUnlockService) {
      newState = this.facilityUnlockService.checkAndUnlockWithLog(newState)
    }

    return WizSceneResultFactory.accept(
      this.timeService.advanceWithLog(newState, this.getHungerCostForArea(area.dangerLevel)),
    )
  }

  private handleHunt(
    state: WizStateExploration,
    area: WizVaultAreaState,
  ): WizSceneResult<WizStateExploration, never, WizSceneExplorationRejectionReason> {
    const stateAfterAp = state
      .withMessage(null)
      .updateVault((v) => v.updatePlayer((p) => p.useAp(1)))
    if (area.monsters.length === 0) {
      return WizSceneResultFactory.reject(
        stateAfterAp
          .updateVault((v) => v.addLog({ key: "NO_MONSTERS_AVAILABLE" }))
          .withMessage({
            type: "action_rejected",
            action: "hunt",
            areaId: stateAfterAp.areaId,
            reason: "no_targets_available",
          }),
        "EXPLORATION_ACTION_REJECTED",
      )
    }
    const monster = this.dice.pick(area.monsters)
    if (!monster) {
      return WizSceneResultFactory.reject(
        stateAfterAp.withMessage({
          type: "action_rejected",
          action: "hunt",
          areaId: stateAfterAp.areaId,
          reason: "random_selection_failed",
        }),
        "EXPLORATION_ACTION_REJECTED",
      )
    }
    const nextState = stateAfterAp.updateVault((v) =>
      v
        .incrementAreaProgress(stateAfterAp.areaId, 5)
        .addLog({ key: "DISCOVERED_MONSTER", monsterId: monster.id }),
    )
    let unlockedState = this.areaUnlockService.checkAndUnlockWithLog(nextState)
    if (this.facilityUnlockService) {
      unlockedState = this.facilityUnlockService.checkAndUnlockWithLog(unlockedState)
    }
    return WizSceneResultFactory.accept(unlockedState, {
      type: "START_BATTLE",
      areaId: stateAfterAp.areaId,
      monsterIds: [monster.id],
    })
  }

  private handleRest(
    state: WizStateExploration,
  ): WizSceneResult<WizStateExploration, never, WizSceneExplorationRejectionReason> {
    const area = state.vault.areas.find((a) => a.id === state.areaId)
    const hungerCost = area ? this.getHungerCostForArea(area.dangerLevel) : 10
    const apBefore = state.vault.player.ap
    const maxAp = state.vault.player.maxAp
    if (apBefore >= maxAp) {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "action_rejected",
          action: "rest",
          areaId: state.areaId,
          reason: "already_rested",
        }),
        "EXPLORATION_ACTION_REJECTED",
      )
    }
    const apRecovered = Math.min(2, maxAp - apBefore)
    const newState: WizStateExploration = state
      .withMessage(null)
      .updateVault((v) =>
        v.updatePlayer((p) => p.restoreAp(apRecovered)).addLog({ key: "RESTED", apRecovered }),
      )
    return WizSceneResultFactory.accept(this.timeService.advanceWithLog(newState, hungerCost))
  }

  private handleSelectEventChoice(
    state: WizStateExploration,
    action: { choiceIndex: number },
  ): WizSceneResult<WizStateExploration, never, WizSceneExplorationRejectionReason> {
    if (state.eventProgress.status !== "encounter") {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "event_choice_rejected",
          reason: "event_not_active",
          choiceIndex: action.choiceIndex,
        }),
        "EVENT_CHOICE_REJECTED",
      )
    }
    if (!state.eventProgress.event.choices[action.choiceIndex]) {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "event_choice_rejected",
          reason: "choice_not_found",
          choiceIndex: action.choiceIndex,
        }),
        "EVENT_CHOICE_REJECTED",
      )
    }
    const progress = new WizEngineExplorationEventProgress(state.eventProgress)
    return WizSceneResultFactory.accept(
      state
        .withEventProgress(progress.withChoiceIndex(action.choiceIndex).toPlain())
        .withMessage(null),
    )
  }

  private handleRollDice(
    state: WizStateExploration,
  ): WizSceneResult<WizStateExploration, never, WizSceneExplorationRejectionReason> {
    if (state.eventProgress.status !== "encounter") {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "event_roll_rejected",
          reason: "event_not_active",
        }),
        "EVENT_ROLL_REJECTED",
      )
    }
    const event = state.eventProgress.event
    const choiceIndex = state.eventProgress.choiceIndex
    if (choiceIndex === null) {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "event_roll_rejected",
          reason: "choice_not_selected",
        }),
        "EVENT_ROLL_REJECTED",
      )
    }
    const choice = event.choices[choiceIndex]
    if (!choice) {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "event_roll_rejected",
          reason: "choice_not_found",
          choiceIndex,
        }),
        "EVENT_ROLL_REJECTED",
      )
    }

    // 難易度がない場合は自動成功
    if (!choice.stat || !choice.difficulty) {
      const diceResult = this.skillCheckService.autoSuccess()
      const eventProgress = WizEngineExplorationEventProgress.result(
        event,
        choiceIndex,
        diceResult,
        choice.successText,
      )
      const newVault = this.rewardService
        .applyReward(state.vault, choice.successReward)
        .addLog({ key: "EVENT_RESOLVED", eventId: event.id, succeeded: true })
      return WizSceneResultFactory.accept(
        state.withVault(newVault).withEventProgress(eventProgress.toPlain()).withMessage(null),
      )
    }

    // スキルチェック実行
    const statValue = choice.stat ? state.vault.player.attributes[choice.stat] : 0
    const diceResult = this.skillCheckService.check(statValue, 0, choice.difficulty)
    const resultText = diceResult.success ? choice.successText : choice.failText
    const eventProgress = WizEngineExplorationEventProgress.result(
      event,
      choiceIndex,
      diceResult,
      resultText,
    )

    // 報酬/ペナルティ適用
    let newVault = state.vault
    if (diceResult.success) {
      newVault = this.rewardService.applyReward(newVault, choice.successReward)
    } else {
      newVault = this.rewardService.applyPenalty(newVault, choice.failPenalty)
    }
    newVault = newVault.addLog({
      key: "EVENT_RESOLVED",
      eventId: event.id,
      succeeded: diceResult.success,
    })

    return WizSceneResultFactory.accept(
      this.defeatService.check(
        state.withVault(newVault).withEventProgress(eventProgress.toPlain()).withMessage(null),
      ).state,
    )
  }

  private handleEatFood(
    state: WizStateExploration,
    action: { itemId: string },
  ): WizSceneResult<WizStateExploration, never, WizSceneExplorationRejectionReason> {
    const itemDef = getWizRuntimeContentEntry(this.content.items, action.itemId)
    if (!itemDef) {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "food_rejected",
          itemId: action.itemId,
          reason: "item_not_found",
        }),
        "FOOD_REJECTED",
      )
    }
    if (!itemDef.effect || itemDef.effect.type !== "food") {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "food_rejected",
          itemId: action.itemId,
          reason: "not_food",
        }),
        "FOOD_REJECTED",
      )
    }
    if (state.vault.inventory.totalQuantity("item", action.itemId) <= 0) {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "food_rejected",
          itemId: action.itemId,
          reason: "not_owned",
        }),
        "FOOD_REJECTED",
      )
    }
    const useResult = this.itemEffectService.apply(state.vault.player, itemDef.effect)
    if (!useResult.applied) {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "food_rejected",
          itemId: action.itemId,
          reason: "effect_rejected",
          effectRejection: useResult.rejection,
        }),
        "FOOD_REJECTED",
      )
    }
    const newState = state.withMessage(null).updateVault((v) =>
      v
        .updatePlayer((_p) => useResult.target)
        .updateInventory((inventory) =>
          this.inventoryService.consume(inventory, "item", action.itemId),
        )
        .addLog({
          key: "ITEM_EFFECT_APPLIED",
          itemId: action.itemId,
          events: useResult.events,
        }),
    )
    return WizSceneResultFactory.accept(newState)
  }

  private handleContinueExploration(
    state: WizStateExploration,
  ): WizSceneResult<WizStateExploration, never, WizSceneExplorationRejectionReason> {
    return WizSceneResultFactory.accept(
      state.withEventProgress(WizEngineExplorationEventProgress.none().toPlain()).withMessage(null),
    )
  }

  private getHungerCostForArea(dangerLevel: number): number {
    return this.probabilityConfig.hungerCostFromDangerLevel(dangerLevel)
  }
}

Object.freeze(WizSceneExplorationReducer.prototype)
Object.freeze(WizSceneExplorationReducer)
