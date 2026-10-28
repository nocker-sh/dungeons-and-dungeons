import type { WorldContent } from "@/lib/wiz/core/content/world-content"
import type { WizContext } from "@/lib/wiz/core/context"
import { WizEngineBattleSimpleEnemyAI } from "@/lib/wiz/core/engine/battle-ai/simple-enemy-ai"
import type { WizEngineBattleContentResolver } from "@/lib/wiz/core/engine/battle/content"
import { WizEngineBattleTurnActionExecutor } from "@/lib/wiz/core/engine/battle/execution/action-executor"
import type { WizEngineBattleExecutionRejectionReason } from "@/lib/wiz/core/engine/battle/execution/execution-result"
import { WizEngineBattleActionBuilder } from "@/lib/wiz/core/engine/battle/turn-action-builder"
import { WizEngineConversation } from "@/lib/wiz/core/engine/conversation"
import { WizConversationAffinitySystem } from "@/lib/wiz/core/engine/conversation/create-wiz-standard-conversation-affinity-system"
import type { WizItemEffectApplicationService } from "@/lib/wiz/core/domain/services/item-effect-service"
import { WizEngineBattleDefaultDamageCalculator } from "@/lib/wiz/core/engine/damage/default-damage-calculator"
import { WizEngineBattleDefaultFleeCalculator } from "@/lib/wiz/core/engine/flee/default-flee-calculator"
import { WizEngineLevelUp } from "@/lib/wiz/core/engine/level-up"
import { WizEngineInn } from "@/lib/wiz/core/engine/inn"
import { WizEngineInnPlanCatalog } from "@/lib/wiz/core/engine/inn/plan-catalog"
import { WizEnginePartyLevelUp } from "@/lib/wiz/core/engine/level-up/party-level-up"
import { WizEngineFacilityUnlockService } from "@/lib/wiz/core/engine/facility/wiz-engine-facility-unlock-service"
import { WizVaultPlayerItemEffectService } from "@/lib/wiz/core/engine/inventory/wiz-vault-item-effect-service"
import { WizEngineQuestProgress } from "@/lib/wiz/core/engine/quest/progress"
import {
  WizEngineBattleDefaultRewardCalculator,
  type WizEngineBattleRewardCalculator,
} from "@/lib/wiz/core/engine/reward/default-reward-calculator"
import type { WizEngineShopDialogueService } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-dialogue-service"
import { WizEngineShopPurchaseService } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-purchase-service"
import type { WizEngineAbilityLearning } from "@/lib/wiz/core/engine/ability/wiz-engine-ability-learning"
import { WizEngineTimeFactory } from "@/lib/wiz/core/engine/time/wiz-time-factory"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import {
  type WizPreset,
  WizPresetValue,
} from "@/lib/wiz/core/presets/wiz-preset"
import type {
  WizRpgMechanicsResolution,
  WizRpgStandardActionReducerPort,
} from "@/lib/wiz/core/presets/rpg-mechanics"
import { WizStandardRuntimeEnvironment } from "@/lib/wiz/core/presets/runtime-environment"
import { createWizStandardPartyMemberGrowthTable } from "@/lib/wiz/core/presets/standard-party-growth"
import {
  WizBuiltInActionName,
  type WizAction,
} from "@/lib/wiz/core/runtime/action"
import {
  WizSceneBattleCharacterAdapter,
  type WizSceneBattleCharacterAuthority,
} from "@/lib/wiz/core/runtime/converters/battle-character-adapter"
import {
  WizSceneBattleMonsterAdapter,
  type WizSceneBattleMonsterAuthority,
} from "@/lib/wiz/core/runtime/converters/battle-monster-adapter"
import { WizSceneBattleStatusConversionService } from "@/lib/wiz/core/runtime/converters/wiz-status-conversion-service"
import { WizSceneNavigationReducer } from "@/lib/wiz/core/runtime/navigation/navigation-reducer"
import type {
  WizPluginSceneAction,
  WizPluginSceneState,
} from "@/lib/wiz/core/runtime/plugin/plugin-scene"
import type { WizPluginSceneRegistry } from "@/lib/wiz/core/runtime/plugin/plugin-scene-registry"
import type { WizPluginSceneResolvedAction } from "@/lib/wiz/core/runtime/plugin/plugin-scene-module"
import type { WizPluginSceneResult } from "@/lib/wiz/core/runtime/plugin/plugin-scene-result"
import {
  WizSceneResultFactory,
  type WizSceneResult,
} from "@/lib/wiz/core/runtime/scene-result"
import { WizStandardSceneName } from "@/lib/wiz/core/runtime/standard-scene-name"
import type {
  WizSceneTransition,
  WizSceneTransitionRejectionReason,
} from "@/lib/wiz/core/runtime/scene-transition"
import { WizSceneTransitionService } from "@/lib/wiz/core/runtime/scene-transition-service"
import { WizRuntimeFacilityUnlockService } from "@/lib/wiz/core/runtime/services/facility-unlock-service"
import {
  WizSceneBattleReducer,
  type WizSceneBattleReducerPort,
} from "@/lib/wiz/core/runtime/scenes/battle/reducer"
import {
  WizSceneBattleDefaultRewardSettlement,
  type WizSceneBattleRewardSettlement,
  type WizSceneBattleRewardSettlementRejectionReason,
} from "@/lib/wiz/core/runtime/scenes/battle/reward-settlement"
import { WizSceneBattleService } from "@/lib/wiz/core/runtime/scenes/battle/wiz-battle-service"
import { WizSceneConversationReducer } from "@/lib/wiz/core/runtime/scenes/conversation/reducer"
import { WizSceneCraftingReducer } from "@/lib/wiz/core/runtime/scenes/crafting/reducer"
import {
  WizSceneExplorationReducer,
  type WizSceneExplorationRejectionReason,
  type WizSceneExplorationReducerPort,
} from "@/lib/wiz/core/runtime/scenes/exploration/reducer"
import { WizSceneInnReducer } from "@/lib/wiz/core/runtime/scenes/inn/reducer"
import {
  WizSceneInventoryReducer,
  type WizSceneInventoryRejectionReason,
} from "@/lib/wiz/core/runtime/scenes/inventory/reducer"
import { WizSceneLevelUpReducer } from "@/lib/wiz/core/runtime/scenes/level-up/reducer"
import { WizSceneQuestReducer } from "@/lib/wiz/core/runtime/scenes/quest/reducer"
import { WizSceneShopReducer } from "@/lib/wiz/core/runtime/scenes/shop/reducer"
import { WizSceneVillageReducer } from "@/lib/wiz/core/runtime/scenes/village/reducer"
import { WizRuntimeTimeService } from "@/lib/wiz/core/runtime/services/time-service"
import type { WizState, WizStateFor } from "@/lib/wiz/core/runtime/state"
import type { WizSystemAction } from "@/lib/wiz/core/runtime/system/system-action"
import { WizSystemReducer } from "@/lib/wiz/core/runtime/system/system-reducer"
import { WizIdGenerator } from "@/lib/wiz/core/services/wiz-id-generator"
import { WizStandardInventoryService } from "@/lib/wiz/core/rpg/standard-inventory"
import type {
  WizBattleMonsterCustom,
  WizBattleStatusCustom,
  WizDefaultBattleMonsterCustom,
  WizDefaultTypes,
  WizTypes,
} from "@/lib/wiz/core/types/wiz-types"
import type { WizVaultPlayer } from "@/lib/wiz/core/vault/states/player/value"
import { createWizStandardHungerService } from "@/lib/wiz/core/vault/states/player/services/wiz-hunger-service"

type WizRootBattleStatus<TTypes extends WizTypes> = WizBattleStatusCustom<
  TTypes["BattleStatus"]
>
type WizRootBattleMonsterCustom<TTypes extends WizTypes> =
  WizBattleMonsterCustom<TTypes>

type WizRootBuiltInState<
  TTypes extends WizTypes,
  TRewardCustom = undefined,
> = WizStateFor<TTypes, TRewardCustom>

type WizRootState<
  TExtraState extends WizPluginSceneState,
  TTypes extends WizTypes,
  TRewardCustom = undefined,
> = WizRootBuiltInState<TTypes, TRewardCustom> | TExtraState

type WizRootInputState<
  TExtraState extends WizPluginSceneState,
  TTypes extends WizTypes,
  TRewardCustom = undefined,
> =
  | TExtraState
  | WizRootBuiltInState<TTypes, TRewardCustom>
  | ([keyof WizRootBattleStatus<TTypes>] extends [never]
      ? WizState<unknown, WizRootBattleMonsterCustom<TTypes>, TRewardCustom>
      : never)

type WizRootReducerLocalRejectionReason =
  | "ACTION_NOT_ALLOWED_IN_SCENE"
  | "BATTLE_ACTION_REJECTED"
  | "BATTLE_REWARD_ITEM_NOT_FOUND"
  | "DIALOGUE_ADVANCE_REJECTED"
  | "DIALOGUE_OPTION_REJECTED"
  | "ENCOUNTER_AREA_NOT_FOUND"
  | "ENCOUNTER_REQUIRES_EXPLORATION"
  | "ENCOUNTER_TARGET_NOT_IN_AREA"
  | "EVENT_CHOICE_REJECTED"
  | "EVENT_ROLL_REJECTED"
  | "EXPLORATION_ACTION_REJECTED"
  | "FOOD_REJECTED"
  | "GATHER_REJECTED"
  | "GIFT_CANCELLATION_REJECTED"
  | "GIFT_CONFIRMATION_REJECTED"
  | "GIFT_SELECTION_REJECTED"
  | "INVENTORY_EQUIPMENT_ALREADY_EQUIPPED"
  | "INVENTORY_EQUIPMENT_NOT_FOUND"
  | "INVENTORY_EQUIPMENT_SLOT_EMPTY"
  | "INVENTORY_EQUIPMENT_SLOT_MISMATCH"
  | "INVENTORY_ITEM_DEFINITION_NOT_FOUND"
  | "INVENTORY_ITEM_EFFECT_REJECTED"
  | "INVENTORY_ITEM_NOT_FOUND"
  | "LEVEL_UP_REJECTED"
  | "MISSING_FACILITY"
  | "MISSING_MATERIALS"
  | "NO_RECIPE_SELECTED"
  | "PLUGIN_ACTION_INVALID"
  | "PURCHASE_REJECTED"
  | "QUEST_ACCEPTANCE_REJECTED"
  | "QUEST_COMPLETION_REJECTED"
  | "QUEST_SELECTION_REJECTED"
  | "RECIPE_NOT_FOUND"
  | "SALE_REJECTED"
  | "SHOP_CONVERSATION_REJECTED"
  | "SHOP_NOT_FOUND"
  | "SHOP_SCOPE_MISMATCH"
  | "STAY_REJECTED"
  | "VILLAGE_ACTION_REJECTED"

export type WizRootBuiltInRejectionReason =
  | WizRootReducerLocalRejectionReason
  | WizSceneTransitionRejectionReason

type WizLiteralCustomReason<TReason extends string> = string extends TReason
  ? never
  : TReason

export type WizRootRejectionReason<
  TPluginReason extends string = never,
  TMechanicsReason extends string = never,
> =
  | WizRootBuiltInRejectionReason
  | WizLiteralCustomReason<TPluginReason>
  | WizLiteralCustomReason<TMechanicsReason>

const WIZ_ROOT_BUILT_IN_REJECTION_REASONS: readonly WizRootBuiltInRejectionReason[] =
  Object.freeze([
    "ACTION_NOT_ALLOWED_IN_SCENE",
    "BATTLE_ACTION_REJECTED",
    "BATTLE_REWARD_ITEM_NOT_FOUND",
    "DIALOGUE_ADVANCE_REJECTED",
    "DIALOGUE_OPTION_REJECTED",
    "ENCOUNTER_AREA_NOT_FOUND",
    "ENCOUNTER_REQUIRES_EXPLORATION",
    "ENCOUNTER_TARGET_NOT_IN_AREA",
    "EVENT_CHOICE_REJECTED",
    "EVENT_ROLL_REJECTED",
    "EXPLORATION_ACTION_REJECTED",
    "FOOD_REJECTED",
    "GATHER_REJECTED",
    "GIFT_CANCELLATION_REJECTED",
    "GIFT_CONFIRMATION_REJECTED",
    "GIFT_SELECTION_REJECTED",
    "INVENTORY_EQUIPMENT_ALREADY_EQUIPPED",
    "INVENTORY_EQUIPMENT_NOT_FOUND",
    "INVENTORY_EQUIPMENT_SLOT_EMPTY",
    "INVENTORY_EQUIPMENT_SLOT_MISMATCH",
    "INVENTORY_ITEM_DEFINITION_NOT_FOUND",
    "INVENTORY_ITEM_EFFECT_REJECTED",
    "INVENTORY_ITEM_NOT_FOUND",
    "LEVEL_UP_REJECTED",
    "MISSING_FACILITY",
    "MISSING_MATERIALS",
    "NO_RECIPE_SELECTED",
    "PLUGIN_ACTION_INVALID",
    "PURCHASE_REJECTED",
    "QUEST_ACCEPTANCE_REJECTED",
    "QUEST_COMPLETION_REJECTED",
    "QUEST_SELECTION_REJECTED",
    "RECIPE_NOT_FOUND",
    "SALE_REJECTED",
    "SHOP_CONVERSATION_REJECTED",
    "SHOP_NOT_FOUND",
    "SHOP_SCOPE_MISMATCH",
    "STAY_REJECTED",
    "TRANSITION_AREA_LOCKED",
    "TRANSITION_AREA_NOT_FOUND",
    "TRANSITION_INVALID",
    "TRANSITION_LEVEL_UP_NOT_AVAILABLE",
    "TRANSITION_MONSTERS_REQUIRED",
    "TRANSITION_MONSTER_NOT_IN_AREA",
    "TRANSITION_NPC_NOT_FOUND",
    "TRANSITION_PLUGIN_NOT_FOUND",
    "TRANSITION_PLUGIN_SOURCE_NOT_ALLOWED",
    "TRANSITION_PLUGIN_STATE_INVALID",
    "TRANSITION_SHOP_NOT_FOUND",
    "VILLAGE_ACTION_REJECTED",
  ])

export class WizRootReducerContractError extends TypeError {
  override readonly name = "WizRootReducerContractError"

  constructor(
    readonly reason: string,
    message?: string
  ) {
    super(
      message ??
        `Standard built-in reducer returned unknown rejection reason "${reason}"`
    )
    Object.freeze(this)
  }
}

const requireBuiltInRejectionReason = (
  reason: string
): WizRootBuiltInRejectionReason => {
  if (
    !WIZ_ROOT_BUILT_IN_REJECTION_REASONS.includes(
      reason as WizRootBuiltInRejectionReason
    )
  ) {
    throw new WizRootReducerContractError(reason)
  }

  return reason as WizRootBuiltInRejectionReason
}

type WizRootSceneResult<
  TExtraState extends WizPluginSceneState,
  TTypes extends WizTypes,
  TPluginEvent,
  TPluginReason extends string,
  TRewardCustom = undefined,
  TMechanicsReason extends string = never,
> = WizSceneResult<
  WizRootState<TExtraState, TTypes, TRewardCustom>,
  TPluginEvent,
  WizRootRejectionReason<TPluginReason, TMechanicsReason>
>

type WizRootBattleRuntime<
  TTypes extends WizTypes,
  TRewardCustom,
  TMechanicsReason extends string,
> = Readonly<{
  battleReducer: WizSceneBattleReducer<
    WizRootBattleStatus<TTypes>,
    WizRootBattleMonsterCustom<TTypes>,
    TRewardCustom,
    TMechanicsReason | WizEngineBattleExecutionRejectionReason,
    TMechanicsReason | WizSceneBattleRewardSettlementRejectionReason
  >
  battleService: WizSceneBattleService<
    WizRootBattleStatus<TTypes>,
    WizRootBattleMonsterCustom<TTypes>,
    TRewardCustom,
    TMechanicsReason | WizEngineBattleExecutionRejectionReason
  >
}>

type WizRootPresetDependency<TTypes extends WizTypes> = [
  keyof WizBattleStatusCustom<TTypes["BattleStatus"]>,
] extends [never]
  ? { readonly preset?: WizPreset<TTypes> }
  : { readonly preset: WizPreset<TTypes> }

type WizRootMechanicsDependency<
  TTypes extends WizTypes,
  TRewardCustom,
  TMechanicsReason extends string,
> = [TRewardCustom] extends [undefined]
  ? {
      /** @internal resolved once by WizStandardSceneWorld composition. */
      readonly mechanics?: WizRpgMechanicsResolution<
        TTypes,
        TRewardCustom,
        TMechanicsReason
      >
    }
  : {
      /** @internal resolved once by WizStandardSceneWorld composition. */
      readonly mechanics: WizRpgMechanicsResolution<
        TTypes,
        TRewardCustom,
        TMechanicsReason
      >
    }

type WizRootUsesDefaultBattleMonsterCustom<TTypes extends WizTypes> =
  unknown extends WizRootBattleMonsterCustom<TTypes>
    ? true
    : [WizRootBattleMonsterCustom<TTypes>] extends [
          WizDefaultBattleMonsterCustom,
        ]
      ? [WizDefaultBattleMonsterCustom] extends [
          WizRootBattleMonsterCustom<TTypes>,
        ]
        ? true
        : false
      : false

type WizRootBattleMonsterDependency<TTypes extends WizTypes> = [
  keyof WizRootBattleStatus<TTypes>,
] extends [never]
  ? WizRootUsesDefaultBattleMonsterCustom<TTypes> extends true
    ? {
        readonly battleMonsterAdapter?: WizSceneBattleMonsterAuthority<
          WizRootBattleStatus<TTypes>,
          WizRootBattleMonsterCustom<TTypes>
        >
      }
    : {
        readonly battleMonsterAdapter: WizSceneBattleMonsterAuthority<
          WizRootBattleStatus<TTypes>,
          WizRootBattleMonsterCustom<TTypes>
        >
      }
  : {
      readonly battleMonsterAdapter: WizSceneBattleMonsterAuthority<
        WizRootBattleStatus<TTypes>,
        WizRootBattleMonsterCustom<TTypes>
      >
    }

export type WizRootReducerDependencies<
  TExtraState extends WizPluginSceneState = never,
  TExtraActionInput = never,
  TExtraActionOutput extends WizPluginSceneAction = never,
  TTypes extends WizTypes = WizDefaultTypes,
  TPluginEvent = never,
  TPluginReason extends string = never,
  TRewardCustom = undefined,
  TMechanicsReason extends string = never,
> = {
  readonly content: WorldContent
  readonly context: WizContext<NoInfer<TExtraState>>
  readonly shopDialogueService: WizEngineShopDialogueService
  readonly abilityLearning?: WizEngineAbilityLearning
  /** standard playerで解釈するitem effectを差し替える。 */
  readonly itemEffect?: WizItemEffectApplicationService<WizVaultPlayer>
  readonly battleContent?: WizEngineBattleContentResolver
  /** 戦闘開始とsession復元で共有するactor変換port。 */
  readonly battleCharacterAdapter?: WizSceneBattleCharacterAuthority<
    WizRootBattleStatus<TTypes>
  >
  /** standard runtimeの乱数・時刻・IDを一括で供給する唯一の依存源。 */
  readonly environment?: WizStandardRuntimeEnvironment
  /**
   * schema・reducer・navigationを束ねたplugin scene registryを登録する。
   *
   * scene 固有 reducer より優先されるが、system/navigation action は常にグローバル処理される。
   *
   * @example
   * ```ts
   * pluginScenes: WizPluginSceneRegistry.define([arenaModule, dungeonModule])
   * ```
   */
  readonly pluginScenes?: WizPluginSceneRegistry<
    TExtraState,
    TExtraActionInput,
    TExtraActionOutput,
    TPluginEvent,
    TPluginReason
  >
} & WizRootPresetDependency<TTypes> &
  WizRootBattleMonsterDependency<TTypes> &
  WizRootMechanicsDependency<TTypes, TRewardCustom, TMechanicsReason>

const SYSTEM_ACTIONS = new Set([
  "ADD_LOG",
  "ADVANCE_TIME",
  "NEW_DAY",
  "WORLD_ENDED",
  "WORLD_RESET",
])

const INVENTORY_ACTIONS = new Set(["USE_ITEM", "EQUIP", "UNEQUIP"])

const NAVIGATION_ACTIONS = new Set(["ENCOUNTER_MONSTER", "RETURN_TO_VILLAGE"])

const getActionType = (action: unknown): string | null => {
  if (typeof action !== "object" || action === null) {
    return null
  }
  const type = Object.getOwnPropertyDescriptor(action, "type")?.value

  return typeof type === "string" ? type : null
}

/**
 * Top-level reducer that dispatches actions to scene-specific reducers.
 *
 * plugin state・schema input・canonical outputを型レベルで拡張できる:
 *
 * ```ts
 * type ArenaState = { type: "arena"; vault: WizVaultValue; ... }
 * const root = new WizRootReducer<ArenaState, ArenaActionInput, ArenaAction>({
 *   content, context, shopDialogueService,
 *   pluginScenes: WizPluginSceneRegistry.define([arenaModule]),
 * })
 * ```
 */
export class WizRootReducer<
  TExtraState extends WizPluginSceneState = never,
  TExtraActionInput = never,
  TExtraActionOutput extends WizPluginSceneAction = never,
  TTypes extends WizTypes = WizDefaultTypes,
  TPluginEvent = never,
  TPluginReason extends string = never,
  TRewardCustom = undefined,
  TMechanicsReason extends string = never,
> {
  private readonly systemReducer: WizSystemReducer
  private readonly inventoryReducer: WizSceneInventoryReducer<TMechanicsReason>
  private readonly shopReducer: WizSceneShopReducer
  private readonly explorationReducer: WizSceneExplorationReducerPort<
    TMechanicsReason | WizSceneExplorationRejectionReason
  >
  private readonly craftingReducer: WizSceneCraftingReducer
  private readonly conversationReducer: WizSceneConversationReducer
  private readonly villageReducer: WizSceneVillageReducer
  private readonly innReducer: WizSceneInnReducer
  private readonly questReducer: WizSceneQuestReducer
  private readonly levelUpReducer: WizSceneLevelUpReducer
  private readonly standardActionReducer:
    | WizRpgStandardActionReducerPort<TTypes, TRewardCustom, TMechanicsReason>
    | undefined
  private readonly battleReducer: WizSceneBattleReducerPort<
    WizRootBattleStatus<TTypes>,
    WizRootBattleMonsterCustom<TTypes>,
    TRewardCustom,
    TMechanicsReason | WizEngineBattleExecutionRejectionReason,
    TMechanicsReason | WizSceneBattleRewardSettlementRejectionReason
  >
  private readonly navigationReducer: WizSceneNavigationReducer
  private readonly transitionService: WizSceneTransitionService<
    WizRootBattleStatus<TTypes>,
    WizRootBattleMonsterCustom<TTypes>,
    TRewardCustom,
    TExtraState
  >
  private readonly pluginScenes?: WizPluginSceneRegistry<
    TExtraState,
    TExtraActionInput,
    TExtraActionOutput,
    TPluginEvent,
    TPluginReason
  >

  constructor(
    dependencies: WizRootReducerDependencies<
      TExtraState,
      TExtraActionInput,
      TExtraActionOutput,
      TTypes,
      TPluginEvent,
      TPluginReason,
      TRewardCustom,
      TMechanicsReason
    >
  ) {
    const preset = dependencies.preset
      ? WizPresetValue.from(dependencies.preset)
      : (WizPresetValue.create() as unknown as WizPreset<TTypes>)
    const environment =
      dependencies.environment ?? WizStandardRuntimeEnvironment.create()
    const dice = environment.dice
    const idGenerator = new WizIdGenerator({ source: environment.nextId })
    const inventoryService = new WizStandardInventoryService(environment.nextId)
    const actionBuilder = new WizEngineBattleActionBuilder({
      nextId: environment.nextId,
    })
    const timeFactory = new WizEngineTimeFactory({
      config: preset.time,
      random: dice.random,
    })
    const mechanics = dependencies.mechanics
    const hungerService =
      mechanics?.hungerService ?? createWizStandardHungerService()
    const timeService = new WizRuntimeTimeService({
      timeFactory,
      defeatService: mechanics?.defeatPolicy,
      hungerService,
    })
    const facilityUnlockService = new WizRuntimeFacilityUnlockService({
      facilityUnlockService: new WizEngineFacilityUnlockService(
        dependencies.content.arrays.facilities
      ),
    })
    const levelUpService = new WizEngineLevelUp(preset.levelUp)
    const itemEffect =
      dependencies.itemEffect ?? new WizVaultPlayerItemEffectService()
    const conversationAffinitySystem =
      mechanics?.affinitySystem ??
      WizConversationAffinitySystem.fromConfig(preset.conversation)
    const conversationService = new WizEngineConversation({
      config: preset.conversation,
      affinitySystem: conversationAffinitySystem,
      inventoryService,
    })
    const statusConversionService = new WizSceneBattleStatusConversionService<
      TTypes["BattleStatus"]
    >(preset.statusConversion)
    const battleCharacterAdapter =
      dependencies.battleCharacterAdapter ??
      new WizSceneBattleCharacterAdapter<TTypes["BattleStatus"]>(
        statusConversionService,
        dependencies.content
      )
    if (
      dependencies.battleMonsterAdapter === undefined &&
      (preset.statusConversion.battleStatusFormula !== undefined ||
        preset.statusConversion.customStatusFormula !== undefined)
    ) {
      throw new TypeError(
        "Custom battle status requires a battleMonsterAdapter that creates every required monster status field"
      )
    }
    // The conditional dependency and runtime formula check above prove that this fallback
    // is reachable only for the empty standard status extension.
    const battleMonsterAdapter =
      dependencies.battleMonsterAdapter ??
      (WizSceneBattleMonsterAdapter.createDefault() as unknown as WizSceneBattleMonsterAuthority<
        WizRootBattleStatus<TTypes>,
        WizRootBattleMonsterCustom<TTypes>
      >)
    const fleeCalculator = new WizEngineBattleDefaultFleeCalculator({
      config: preset.flee,
      dice,
    })
    const createBattleRuntime = <TRuntimeRewardCustom>(
      rewardCalculator: WizEngineBattleRewardCalculator<
        WizRootBattleStatus<TTypes>,
        WizRootBattleMonsterCustom<TTypes>,
        TRuntimeRewardCustom
      >,
      rewardSettlement?: WizSceneBattleRewardSettlement<
        WizRootBattleStatus<TTypes>,
        WizRootBattleMonsterCustom<TTypes>,
        TRuntimeRewardCustom,
        TMechanicsReason | WizSceneBattleRewardSettlementRejectionReason
      >
    ) => {
      const battleService = new WizSceneBattleService<
        WizRootBattleStatus<TTypes>,
        WizRootBattleMonsterCustom<TTypes>,
        TRuntimeRewardCustom,
        TMechanicsReason | WizEngineBattleExecutionRejectionReason
      >({
        executor:
          mechanics?.battleExecutor ??
          new WizEngineBattleTurnActionExecutor<
            WizRootBattleStatus<TTypes>,
            WizRootBattleMonsterCustom<TTypes>
          >({
            damageCalculator: new WizEngineBattleDefaultDamageCalculator<
              WizRootBattleStatus<TTypes>
            >({
              config: preset.damage,
              dice,
            }),
            fleeCalculator,
            idGenerator,
            effectConfig: preset.effect,
          }),
        enemyAI:
          mechanics?.enemyAI ??
          new WizEngineBattleSimpleEnemyAI<
            WizRootBattleStatus<TTypes>,
            WizRootBattleMonsterCustom<TTypes>
          >({
            dice,
            actionBuilder,
          }),
        rewardCalculator,
        turnOrderPolicy: mechanics?.turnOrderPolicy,
        idGenerator,
        content: dependencies.battleContent,
      })
      const battleReducer = new WizSceneBattleReducer<
        WizRootBattleStatus<TTypes>,
        WizRootBattleMonsterCustom<TTypes>,
        TRuntimeRewardCustom,
        TMechanicsReason | WizEngineBattleExecutionRejectionReason,
        TMechanicsReason | WizSceneBattleRewardSettlementRejectionReason
      >({
        battleService,
        content: dependencies.content,
        inventoryService,
        defeatService: mechanics?.defeatPolicy,
        hungerService,
        levelUpService,
        timeFactory,
        rewardSettlement:
          rewardSettlement ??
          new WizSceneBattleDefaultRewardSettlement<
            WizRootBattleStatus<TTypes>,
            WizRootBattleMonsterCustom<TTypes>,
            TRuntimeRewardCustom
          >({ content: dependencies.content, inventoryService }),
      })
      return Object.freeze({ battleReducer, battleService })
    }
    const battleRuntime = (
      mechanics?.rewardCalculator === undefined
        ? createBattleRuntime(
            new WizEngineBattleDefaultRewardCalculator<
              WizRootBattleStatus<TTypes>,
              WizRootBattleMonsterCustom<TTypes>
            >({ config: preset.reward, dice })
          )
        : createBattleRuntime(
            mechanics.rewardCalculator,
            mechanics.rewardSettlement
          )
    ) as WizRootBattleRuntime<TTypes, TRewardCustom, TMechanicsReason>

    this.systemReducer = new WizSystemReducer({
      context: dependencies.context as WizContext,
      timeFactory,
      timeService,
    })
    this.inventoryReducer = new WizSceneInventoryReducer({
      content: dependencies.content,
      equipmentRules: mechanics?.equipmentRules,
      itemEffect,
    })
    this.shopReducer = new WizSceneShopReducer({
      content: dependencies.content,
      dialogueService: dependencies.shopDialogueService,
      purchaseService: new WizEngineShopPurchaseService(inventoryService),
    })
    this.explorationReducer =
      mechanics?.explorationReducer ??
      new WizSceneExplorationReducer({
        content: dependencies.content,
        dice,
        inventoryService,
        probabilityConfig: preset.exploration,
        timeFactory,
        itemEffectService: itemEffect,
        defeatService: mechanics?.defeatPolicy,
        hungerService,
        facilityUnlockService,
      })
    this.craftingReducer = new WizSceneCraftingReducer({
      content: dependencies.content,
      dice,
      inventoryService,
    })
    this.conversationReducer = new WizSceneConversationReducer({
      affinitySystem: conversationAffinitySystem,
      conversationService,
      inventoryService,
    })
    this.villageReducer = new WizSceneVillageReducer({
      shopDialogueService: dependencies.shopDialogueService,
    })
    this.innReducer = new WizSceneInnReducer({
      innService:
        mechanics?.innService ??
        new WizEngineInn(
          new WizEngineInnPlanCatalog(dependencies.content.arrays.innPlans),
          {
            timeFactory,
          }
        ),
    })
    this.questReducer = new WizSceneQuestReducer({
      facilityUnlockService,
      levelUpService,
      questProgressService: new WizEngineQuestProgress({
        affinitySystem: conversationAffinitySystem,
        inventoryService,
      }),
    })
    this.levelUpReducer = new WizSceneLevelUpReducer({
      levelUpService,
      abilityLearning: dependencies.abilityLearning,
      partyLevelUp:
        mechanics?.partyLevelUp ??
        new WizEnginePartyLevelUp(createWizStandardPartyMemberGrowthTable()),
    })
    this.standardActionReducer = mechanics?.standardActionReducer
    this.battleReducer = battleRuntime.battleReducer
    this.navigationReducer = new WizSceneNavigationReducer()
    this.transitionService = new WizSceneTransitionService<
      WizRootBattleStatus<TTypes>,
      WizRootBattleMonsterCustom<TTypes>,
      TRewardCustom,
      TExtraState
    >({
      content: dependencies.content,
      shopDialogueService: dependencies.shopDialogueService,
      levelUpService,
      battleCharacterAdapter,
      battleMonsterAdapter,
      battleService: battleRuntime.battleService,
      pluginSceneRegistry: dependencies.pluginScenes,
    })
    this.pluginScenes = dependencies.pluginScenes
    Object.freeze(this)
  }

  reduce(
    state: WizRootInputState<TExtraState, TTypes, TRewardCustom>,
    action: WizAction | WizSystemAction | TExtraActionInput
  ): WizRootSceneResult<
    TExtraState,
    TTypes,
    TPluginEvent,
    TPluginReason,
    TRewardCustom,
    TMechanicsReason
  > {
    const rootState = state as WizRootState<TExtraState, TTypes, TRewardCustom>
    return this.applyResult(rootState, this.route(rootState, action))
  }

  /** @internal Standard Schemaを既に一度通したplugin actionを再検証せず適用する。 */
  reduceResolvedPluginAction(
    state: WizRootInputState<TExtraState, TTypes, TRewardCustom>,
    resolvedAction: WizPluginSceneResolvedAction<
      TExtraActionInput,
      TExtraActionOutput
    >
  ): WizRootSceneResult<
    TExtraState,
    TTypes,
    TPluginEvent,
    TPluginReason,
    TRewardCustom,
    TMechanicsReason
  > {
    const rootState = state as WizRootState<TExtraState, TTypes, TRewardCustom>
    if (!this.pluginScenes?.hasScene(rootState.type)) {
      return this.rejected(rootState, "ACTION_NOT_ALLOWED_IN_SCENE")
    }
    const pluginResult = this.pluginScenes.reduceResolved(
      rootState as TExtraState,
      resolvedAction
    )
    if (pluginResult === null) {
      return this.rejected(rootState, "PLUGIN_ACTION_INVALID")
    }

    return this.applyResult(rootState, this.asPluginSceneResult(pluginResult))
  }

  navigate(
    state:
      | WizRootInputState<TExtraState, TTypes, TRewardCustom>
      | WizDeepReadonly<WizRootState<TExtraState, TTypes, TRewardCustom>>,
    transition: WizSceneTransition
  ): WizRootSceneResult<
    TExtraState,
    TTypes,
    TPluginEvent,
    TPluginReason,
    TRewardCustom,
    TMechanicsReason
  > {
    const rootState = state as WizRootState<TExtraState, TTypes, TRewardCustom>

    return this.applyResult(rootState, this.accepted(rootState, transition))
  }

  private route(
    state: WizRootState<TExtraState, TTypes, TRewardCustom>,
    action: WizAction | WizSystemAction | TExtraActionInput
  ): WizRootSceneResult<
    TExtraState,
    TTypes,
    TPluginEvent,
    TPluginReason,
    TRewardCustom,
    TMechanicsReason
  > {
    const actionType = getActionType(action)
    if (
      actionType !== null &&
      WizBuiltInActionName.is(actionType) &&
      WizStandardSceneName.isBuiltIn(state.type) &&
      this.standardActionReducer !== undefined
    ) {
      const overridden = this.standardActionReducer.reduce(
        state as WizRootBuiltInState<TTypes, TRewardCustom>,
        action as WizAction
      )
      if (overridden !== null) {
        return this.asMechanicsSceneResult(overridden)
      }
    }
    if (actionType !== null && SYSTEM_ACTIONS.has(actionType)) {
      return this.accepted(
        this.systemReducer.reduce(
          state as WizState,
          action as WizAction | WizSystemAction
        ) as WizRootBuiltInState<TTypes, TRewardCustom> | TExtraState
      )
    }

    if (actionType !== null && INVENTORY_ACTIONS.has(actionType)) {
      if (state.type === "battle") {
        return this.rejected(state, "ACTION_NOT_ALLOWED_IN_SCENE")
      }
      const inventoryResult = this.inventoryReducer.reduce(
        state as WizState,
        action as WizAction | WizSystemAction
      ) as unknown as WizSceneResult<
        WizRootBuiltInState<TTypes, TRewardCustom>,
        never,
        TMechanicsReason | WizSceneInventoryRejectionReason
      >
      return this.asMechanicsSceneResult(inventoryResult)
    }

    if (actionType !== null && NAVIGATION_ACTIONS.has(actionType)) {
      return this.asBuiltInSceneResult(
        this.navigationReducer.reduce(
          state as WizState,
          action as WizAction | WizSystemAction
        )
      )
    }

    if (this.pluginScenes?.hasScene(state.type)) {
      const pluginResult = this.pluginScenes.reduce(
        state as TExtraState,
        action as TExtraActionInput
      )
      if (pluginResult === null) {
        return this.rejected(state, "PLUGIN_ACTION_INVALID")
      }

      return this.asPluginSceneResult(pluginResult)
    }

    if (this.pluginScenes?.acceptsAnyAction(action)) {
      return this.rejected(state, "ACTION_NOT_ALLOWED_IN_SCENE")
    }

    return this.dispatchBuiltIn(
      state as WizRootBuiltInState<TTypes, TRewardCustom>,
      action as WizAction | WizSystemAction
    )
  }

  private dispatchBuiltIn(
    state: WizRootBuiltInState<TTypes, TRewardCustom>,
    action: WizAction | WizSystemAction
  ): WizRootSceneResult<
    TExtraState,
    TTypes,
    TPluginEvent,
    TPluginReason,
    TRewardCustom,
    TMechanicsReason
  > {
    if (state.type === "village") {
      return this.asBuiltInSceneResult(
        this.villageReducer.reduce(state, action)
      )
    }

    if (state.type === "shop") {
      return this.asBuiltInSceneResult(this.shopReducer.reduce(state, action))
    }

    if (state.type === "inn") {
      return this.asBuiltInSceneResult(this.innReducer.reduce(state, action))
    }

    if (state.type === "exploration") {
      return this.asMechanicsSceneResult(
        this.explorationReducer.reduce(state, action)
      )
    }

    if (state.type === "battle") {
      return this.asMechanicsSceneResult(
        this.battleReducer.reduce(state, action)
      )
    }

    if (state.type === "conversation") {
      return this.asBuiltInSceneResult(
        this.conversationReducer.reduce(state, action)
      )
    }

    if (state.type === "crafting") {
      return this.asBuiltInSceneResult(
        this.craftingReducer.reduce(state, action)
      )
    }

    if (state.type === "quest") {
      return this.asBuiltInSceneResult(this.questReducer.reduce(state, action))
    }

    if (state.type === "level_up") {
      return this.asBuiltInSceneResult(
        this.levelUpReducer.reduce(state, action)
      )
    }

    return this.accepted(state)
  }

  private accepted(
    state: WizRootState<TExtraState, TTypes, TRewardCustom>,
    transition?: WizSceneTransition,
    events?: readonly WizDeepReadonly<TPluginEvent>[]
  ): WizRootSceneResult<
    TExtraState,
    TTypes,
    TPluginEvent,
    TPluginReason,
    TRewardCustom,
    TMechanicsReason
  > {
    return WizSceneResultFactory.accept<
      WizRootState<TExtraState, TTypes, TRewardCustom>,
      readonly TPluginEvent[]
    >(state, transition, events as readonly TPluginEvent[] | undefined)
  }

  private rejected(
    state: WizRootState<TExtraState, TTypes, TRewardCustom>,
    reason: WizRootRejectionReason<TPluginReason, TMechanicsReason>
  ): WizRootSceneResult<
    TExtraState,
    TTypes,
    TPluginEvent,
    TPluginReason,
    TRewardCustom,
    TMechanicsReason
  > {
    return WizSceneResultFactory.reject<
      WizRootState<TExtraState, TTypes, TRewardCustom>,
      WizRootRejectionReason<TPluginReason, TMechanicsReason>
    >(state, reason)
  }

  private applyResult(
    previousState: WizRootState<TExtraState, TTypes, TRewardCustom>,
    result: WizRootSceneResult<
      TExtraState,
      TTypes,
      TPluginEvent,
      TPluginReason,
      TRewardCustom,
      TMechanicsReason
    >
  ): WizRootSceneResult<
    TExtraState,
    TTypes,
    TPluginEvent,
    TPluginReason,
    TRewardCustom,
    TMechanicsReason
  > {
    WizSceneResultFactory.assertAuthentic(result)
    if (result.state.type !== previousState.type) {
      throw new WizRootReducerContractError(
        "SCENE_STATE_TYPE_CHANGED_WITHOUT_TRANSITION",
        `Scene reducer for "${previousState.type}" returned state for "${result.state.type}" without a transition`
      )
    }
    if (result.accepted === false) {
      return this.rejected(previousState, result.reason)
    }
    const transitioned = this.transitionService.applyResult(result)
    if (transitioned.accepted === false) {
      return this.rejected(
        previousState,
        requireBuiltInRejectionReason(transitioned.reason)
      )
    }
    return transitioned
  }

  private asBuiltInSceneResult(
    result: WizSceneResult<WizState, never, string>
  ): WizRootSceneResult<
    TExtraState,
    TTypes,
    TPluginEvent,
    TPluginReason,
    TRewardCustom,
    TMechanicsReason
  > {
    WizSceneResultFactory.assertAuthentic(result)
    const rootState = result.state as WizRootBuiltInState<TTypes, TRewardCustom>
    if (result.accepted === false) {
      return this.rejected(
        rootState,
        requireBuiltInRejectionReason(result.reason)
      )
    }

    return this.accepted(rootState, result.transition)
  }

  private asMechanicsSceneResult<
    TResultState extends WizRootBuiltInState<TTypes, TRewardCustom>,
    TResultReason extends string,
  >(
    result: WizSceneResult<TResultState, never, TResultReason>
  ): WizRootSceneResult<
    TExtraState,
    TTypes,
    TPluginEvent,
    TPluginReason,
    TRewardCustom,
    TMechanicsReason
  > {
    WizSceneResultFactory.assertAuthentic(result)
    if (result.accepted === false) {
      return this.rejected(
        result.state,
        result.reason as WizRootRejectionReason<TPluginReason, TMechanicsReason>
      )
    }

    return this.accepted(result.state, result.transition)
  }

  private asPluginSceneResult(
    result: WizPluginSceneResult<TExtraState, TPluginEvent, TPluginReason>
  ): WizRootSceneResult<
    TExtraState,
    TTypes,
    TPluginEvent,
    TPluginReason,
    TRewardCustom,
    TMechanicsReason
  > {
    WizSceneResultFactory.assertAuthentic(result)
    if (result.accepted === false) {
      return this.rejected(
        result.state,
        result.reason as WizRootRejectionReason<TPluginReason, TMechanicsReason>
      )
    }

    return this.accepted(result.state, result.transition, result.events)
  }
}

Object.freeze(WizRootReducerContractError.prototype)
Object.freeze(WizRootReducerContractError)
