import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import type {
  WorldContent,
  WorldContentSnapshotData,
} from "@/lib/wiz/core/content/world-content"
import { WizConversationAffinitySystem } from "@/lib/wiz/core/engine/conversation/create-wiz-standard-conversation-affinity-system"
import type { WizConversationAffinityPort } from "@/lib/wiz/core/engine/conversation/create-wiz-standard-conversation-affinity-system"
import { isBattleUsableItemDefinition } from "@/lib/wiz/core/engine/battle/is-battle-usable-item-definition"
import { createWizStandardBattleContent } from "@/lib/wiz/core/presets/create-wiz-standard-battle-content"
import { createWizStandardShopDialogueService } from "@/lib/wiz/core/presets/create-wiz-standard-shop-dialogue-service"
import { createWizStandardAbilityLearning } from "@/lib/wiz/core/presets/create-wiz-standard-ability-learning"
import { createWizStandardVault } from "@/lib/wiz/core/presets/create-wiz-standard-vault"
import { WizRpgMechanics } from "@/lib/wiz/core/presets/rpg-mechanics"
import type { WizEffectConfig } from "@/lib/wiz/core/config/battle/wiz-effect-config"
import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type {
  WizDeepReadonly,
  WizImmutableValueContract,
} from "@/lib/wiz/core/immutable-value"
import { WizStandardSceneName } from "@/lib/wiz/core/runtime/standard-scene-name"
import {
  materializeWizEngineBattleTurnIntent,
  WizEngineBattleTurnIntent,
} from "@/lib/wiz/core/engine/battle/turn-intent"
import type { WizItemEffectApplicationService } from "@/lib/wiz/core/domain/services/item-effect-service"
import { assertValidWizPreset } from "@/lib/wiz/core/presets/assert-valid-wiz-preset"
import {
  type WizPreset,
  WizPresetValue,
} from "@/lib/wiz/core/presets/wiz-preset"
import { WizStandardRuntimeEnvironment } from "@/lib/wiz/core/presets/runtime-environment"
import {
  restoreWizStandardSessionScene,
  WizStandardSessionCodec,
  WizStandardSessionSnapshot,
  type WizStandardPluginSceneSnapshotData,
  type WizStandardSessionData,
} from "@/lib/wiz/core/presets/standard-session"
import type { WizAction } from "@/lib/wiz/core/runtime/action"
import type {
  WizPluginSceneAction,
  WizPluginSceneState,
} from "@/lib/wiz/core/runtime/plugin/plugin-scene"
import {
  WizSceneBattleCharacterAdapter,
  type WizSceneBattleCharacterAuthority,
} from "@/lib/wiz/core/runtime/converters/battle-character-adapter"
import {
  WizSceneBattleMonsterAdapter,
  type WizSceneBattleMonsterAuthority,
} from "@/lib/wiz/core/runtime/converters/battle-monster-adapter"
import { WizSceneBattleStatusConversionService } from "@/lib/wiz/core/runtime/converters/wiz-status-conversion-service"
import { WizPluginSceneResolvedAction } from "@/lib/wiz/core/runtime/plugin/plugin-scene-module"
import type { WizPluginSceneRegistry } from "@/lib/wiz/core/runtime/plugin/plugin-scene-registry"
import {
  WizSceneResultFactory,
  type WizSceneResult,
} from "@/lib/wiz/core/runtime/scene-result"
import type { WizSceneTransition } from "@/lib/wiz/core/runtime/scene-transition"
import { toVillageScene } from "@/lib/wiz/core/runtime/to-village-scene"
import { WizStateBattle } from "@/lib/wiz/core/runtime/scenes/battle/state"
import { WizStateConversation } from "@/lib/wiz/core/runtime/scenes/conversation/state"
import { WizStateCrafting } from "@/lib/wiz/core/runtime/scenes/crafting/state"
import { WizStateExploration } from "@/lib/wiz/core/runtime/scenes/exploration/states/state"
import { WizStateInn } from "@/lib/wiz/core/runtime/scenes/inn/state"
import { WizStateLevelUp } from "@/lib/wiz/core/runtime/scenes/level-up/state"
import { WizStateQuest } from "@/lib/wiz/core/runtime/scenes/quest/state"
import { WizStateShop } from "@/lib/wiz/core/runtime/scenes/shop/state"
import {
  WizStateVillage,
  type WizSceneVillageActionType,
} from "@/lib/wiz/core/runtime/scenes/village/state"
import type { WizState, WizStateFor } from "@/lib/wiz/core/runtime/state"
import type { WizLogMessage } from "@/lib/wiz/core/types/wiz-log-message"
import type {
  WizBattleMonsterCustom,
  WizBattleStatusCustom,
  WizDefaultBattleMonsterCustom,
  WizDefaultTypes,
  WizTypes,
} from "@/lib/wiz/core/types/wiz-types"
import type { WizVaultObject } from "@/lib/wiz/core/vault/types"
import { WIZ_ATTRIBUTE_KEYS, type WizAttributeKey } from "@/lib/wiz/core/types"
import type { WizVaultPlayer } from "@/lib/wiz/core/vault/states/player/value"
import { WizVaultValue } from "@/lib/wiz/core/vault/value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizEngineBattleContentResolver } from "@/lib/wiz/core/engine/battle/content"
import type { WizEngineShopDialogueService } from "@/lib/wiz/core/engine/shop/wiz-shop-scene-dialogue-service"
import type { WizWorldSaveEnvelope } from "@/lib/wiz/core/save/world-save-codec"
import type { WizContentRecipe } from "@/lib/wiz/core/definition/recipe/recipe"
import { zWizLogMessage } from "@/lib/wiz/core/vault/schema"
import {
  WizWorld,
  WizWorldDispatchResult,
  WizWorldEnvironment,
  WizWorldModule,
  WizWorldStateOwnership,
  WizWorldValueOwnershipError,
} from "@/lib/wiz/core/world/world"
import {
  WorldSnapshot,
  type WorldSnapshotCanonicalData,
} from "@/lib/wiz/core/save/world-snapshot"
import {
  WizRootReducer,
  type WizRootReducerDependencies,
  type WizRootRejectionReason,
} from "@/lib/wiz/core/presets/default"
import {
  createWizStandardAreaActions,
  WizStandardAreaActions,
} from "@/lib/wiz/core/presets/standard-actions/standard-area-actions"
import {
  createWizStandardBattleActions,
  WizStandardBattleActions,
} from "@/lib/wiz/core/presets/standard-actions/standard-battle-actions"
import { createWizStandardActionOrigin } from "@/lib/wiz/core/presets/standard-actions/create-wiz-standard-action-origin"
import { createWizStandardActionValue } from "@/lib/wiz/core/presets/standard-actions/create-wiz-standard-action-value"
import { isWizStandardActionFromOrigin } from "@/lib/wiz/core/presets/standard-actions/is-wiz-standard-action-from-origin"
import type {
  WizStandardActionValueFor,
  WizStandardPublicAction,
} from "@/lib/wiz/core/presets/standard-actions/standard-action-value"
import {
  createWizStandardEventActions,
  WizStandardEventActions,
} from "@/lib/wiz/core/presets/standard-actions/standard-event-actions"
import {
  createWizStandardNpcActions,
  WizStandardNpcActions,
} from "@/lib/wiz/core/presets/standard-actions/standard-npc-actions"
import {
  createWizStandardQuestActions,
  WizStandardQuestActions,
} from "@/lib/wiz/core/presets/standard-actions/standard-quest-actions"
import {
  createWizStandardRecipeActions,
  WizStandardRecipeActions,
} from "@/lib/wiz/core/presets/standard-actions/standard-recipe-actions"
import {
  createWizStandardShopActions,
  WizStandardShopActions,
} from "@/lib/wiz/core/presets/standard-actions/standard-shop-actions"
import type {
  WizStandardAreaId,
  WizStandardCheckedId,
  WizStandardCheckedIdInput,
  WizStandardContentId,
  WizStandardEquipmentSlotId,
  WizStandardEventId,
  WizStandardFoodItemId,
  WizStandardInnPlanId,
  WizStandardNpcId,
  WizStandardQuestId,
  WizStandardRecipeId,
  WizStandardShopId,
} from "@/lib/wiz/core/presets/standard-actions/content-types"

const standardSceneWorldConstructionToken = Symbol("WizStandardConstruction")
const standardActionOwnership = WizWorldStateOwnership.deepImmutable<unknown>()

type WizStandardContentRequirements<
  TArrays extends WorldContentArrays,
  TRequirements extends WorldContentArrays,
> = false extends (
  TRequirements extends unknown
    ? TArrays extends TRequirements
      ? true
      : false
    : never
)
  ? never
  : unknown

const assertStandardSceneWorldConstructionToken = (token: symbol): void => {
  if (token !== standardSceneWorldConstructionToken) {
    throw new TypeError("Standard values must be created by their owning world")
  }
}

export type WizStandardPluginSceneState = WizPluginSceneState &
  WizImmutableValueContract

export type WizStandardState<
  TExtraState extends WizStandardPluginSceneState = never,
  TTypes extends WizTypes = WizDefaultTypes,
  TRewardCustom = undefined,
> = (WizStateFor<TTypes, TRewardCustom> | TExtraState) &
  WizImmutableValueContract

export type WizStandardSceneType<
  TExtraState extends WizStandardPluginSceneState = never,
  TTypes extends WizTypes = WizDefaultTypes,
> = WizStateFor<TTypes>["type"] | TExtraState["type"]

export type WizStandardAction<TPluginActionInput = never> =
  | WizStandardActionValueFor<WizStandardPublicAction>
  | TPluginActionInput

export type WizStandardCanonicalAction<
  TPluginActionOutput extends WizPluginSceneAction = never,
> = WizStandardActionValueFor<WizStandardPublicAction> | TPluginActionOutput

type WizStandardKernelAction<
  TPluginActionInput,
  TPluginActionOutput extends WizPluginSceneAction,
> =
  | WizStandardActionValueFor<WizStandardPublicAction>
  | WizPluginSceneResolvedAction<TPluginActionInput, TPluginActionOutput>

export class WizStandardActionAppliedEvent<
  TAction extends WizPluginSceneAction = WizPluginSceneAction,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "STANDARD_ACTION_APPLIED"
  readonly action: WizDeepReadonly<TAction>

  constructor(action: WizDeepReadonly<TAction>) {
    this.action = new WizObjectService().ownImmutable<TAction>(action)
    WizImmutableValue.freeze(this)
  }
}

export class WizStandardSceneChangedEvent<TSceneType extends string = string> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "STANDARD_SCENE_CHANGED"

  constructor(
    readonly previousSceneType: TSceneType,
    readonly sceneType: TSceneType
  ) {
    if (previousSceneType === sceneType) {
      throw new RangeError(
        "Standard scene change event requires two different scene types"
      )
    }
    WizImmutableValue.freeze(this)
  }
}

export type WizStandardEvent<
  TExtraState extends WizStandardPluginSceneState = never,
  TPluginActionOutput extends WizPluginSceneAction = never,
  TPluginEvent = never,
  TTypes extends WizTypes = WizDefaultTypes,
> =
  | TPluginEvent
  | WizStandardActionAppliedEvent<
      WizStandardCanonicalAction<TPluginActionOutput>
    >
  | WizStandardSceneChangedEvent<WizStandardSceneType<TExtraState, TTypes>>

export type WizStandardRejectionReason<
  TPluginReason extends string = never,
  TMechanicsReason extends string = never,
> =
  | WizRootRejectionReason<TPluginReason, TMechanicsReason>
  | WizStandardActionAdmissionRejectionReason
  | "NO_STATE_CHANGE"

type WizStandardPresetDependency<TTypes extends WizTypes> = [
  keyof WizBattleStatusCustom<TTypes["BattleStatus"]>,
] extends [never]
  ? { readonly preset?: WizPreset<TTypes> }
  : { readonly preset: WizPreset<TTypes> }

type WizRpgMechanicsDependency<
  TTypes extends WizTypes,
  TRewardCustom,
  TArrays extends WorldContentArrays,
  TMechanicsReason extends string,
> = [TRewardCustom] extends [undefined]
  ? {
      readonly mechanics?: WizRpgMechanics<
        TTypes,
        TRewardCustom,
        NoInfer<TArrays>,
        TMechanicsReason
      >
    }
  : {
      readonly mechanics: WizRpgMechanics<
        TTypes,
        TRewardCustom,
        NoInfer<TArrays>,
        TMechanicsReason
      >
    }

type WizStandardUsesDefaultBattleMonsterCustom<TTypes extends WizTypes> =
  unknown extends WizBattleMonsterCustom<TTypes>
    ? true
    : [WizBattleMonsterCustom<TTypes>] extends [WizDefaultBattleMonsterCustom]
      ? [WizDefaultBattleMonsterCustom] extends [WizBattleMonsterCustom<TTypes>]
        ? true
        : false
      : false

type WizStandardBattleMonsterDependency<TTypes extends WizTypes> = [
  keyof WizBattleStatusCustom<TTypes["BattleStatus"]>,
] extends [never]
  ? WizStandardUsesDefaultBattleMonsterCustom<TTypes> extends true
    ? {
        readonly battleMonsterAdapter?: WizSceneBattleMonsterAuthority<
          WizBattleStatusCustom<TTypes["BattleStatus"]>,
          WizBattleMonsterCustom<TTypes>
        >
      }
    : {
        readonly battleMonsterAdapter: WizSceneBattleMonsterAuthority<
          WizBattleStatusCustom<TTypes["BattleStatus"]>,
          WizBattleMonsterCustom<TTypes>
        >
      }
  : {
      readonly battleMonsterAdapter: WizSceneBattleMonsterAuthority<
        WizBattleStatusCustom<TTypes["BattleStatus"]>,
        WizBattleMonsterCustom<TTypes>
      >
    }

export type WizStandardSceneWorldOptions<
  TArrays extends WorldContentArrays,
  TExtraState extends WizStandardPluginSceneState = never,
  TPluginActionInput = never,
  TPluginActionOutput extends WizPluginSceneAction = never,
  TTypes extends WizTypes = WizDefaultTypes,
  TPluginEvent = never,
  TPluginReason extends string = never,
  TRewardCustom = undefined,
  TMechanicsReason extends string = never,
> = {
  readonly content: WorldContent<TArrays>
  readonly initialSnapshot?:
    | WorldSnapshot<WorldContentSnapshotData<TArrays>>
    | WorldContentSnapshotData<TArrays>
  readonly environment?: WizWorldEnvironment
  readonly initialTransition?: WizSceneTransition
  readonly itemEffect?: WizItemEffectApplicationService<WizVaultPlayer>
  readonly pluginScenes?: WizPluginSceneRegistry<
    TExtraState,
    TPluginActionInput,
    TPluginActionOutput,
    TPluginEvent,
    TPluginReason
  >
} & WizStandardPresetDependency<TTypes> &
  WizStandardBattleMonsterDependency<TTypes> &
  WizRpgMechanicsDependency<TTypes, TRewardCustom, TArrays, TMechanicsReason>

export type WizStandardConfigurationDiagnostic =
  | Readonly<{
      code: "NPC_AFFINITY_REJECTED"
      affinity: number
      npcId: string
      path: string
      message: string
    }>
  | Readonly<{
      code: "INITIAL_TRANSITION_REJECTED"
      path: "initialTransition"
      message: string
    }>

/**
 * standard worldのpresetとsnapshotを同時に構成できない場合の集約診断。
 */
export class WizStandardConfigurationError extends Error {
  override readonly name = "WizStandardConfigurationError"
  readonly diagnostics: readonly WizStandardConfigurationDiagnostic[]

  constructor(diagnostics: readonly WizStandardConfigurationDiagnostic[]) {
    super(diagnostics.map((diagnostic) => diagnostic.message).join("\n"))
    this.diagnostics = Object.freeze(
      diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic }))
    )
    Object.freeze(this)
  }
}

export type WizStandardStateProvenanceErrorCode =
  | "FOREIGN_WORLD_STATE"
  | "UNTRUSTED_WORLD_STATE"
  | "CONTENT_DEFINITION_MISMATCH"

/**
 * standard stateが対象worldの正規境界を通過していない、または別contentの
 * 静的definitionを保持している場合の明示的な境界error。
 */
export class WizStandardStateProvenanceError extends Error {
  override readonly name = "WizStandardStateProvenanceError"

  constructor(
    readonly code: WizStandardStateProvenanceErrorCode,
    readonly stateType: string
  ) {
    super(
      code === "FOREIGN_WORLD_STATE"
        ? `Standard state "${stateType}" belongs to another world`
        : code === "UNTRUSTED_WORLD_STATE"
          ? `Standard state "${stateType}" was not produced by this world`
          : `Standard state "${stateType}" contains definitions from different content`
    )
    Object.freeze(this)
  }
}

const standardValueOwnership = new WizObjectService()
const standardPluginFieldOwnership = new WizObjectService()

const isExactBuiltInSceneState = (state: WizPluginSceneState): boolean => {
  const prototype = Object.getPrototypeOf(state)
  switch (state.type) {
    case "village":
      return prototype === WizStateVillage.prototype
    case "shop":
      return prototype === WizStateShop.prototype
    case "inn":
      return prototype === WizStateInn.prototype
    case "exploration":
      return prototype === WizStateExploration.prototype
    case "battle":
      return prototype === WizStateBattle.prototype
    case "conversation":
      return prototype === WizStateConversation.prototype
    case "crafting":
      return prototype === WizStateCrafting.prototype
    case "quest":
      return prototype === WizStateQuest.prototype
    case "level_up":
      return prototype === WizStateLevelUp.prototype
    default:
      return false
  }
}

const ownPluginSceneState = <TState extends WizPluginSceneState>(
  state: TState
): TState => {
  if (!Object.isFrozen(state) || !WizImmutableValue.is(state)) {
    const valueType = state.constructor?.name ?? "Object"
    throw new TypeError(
      `Plugin scene "${state.type}" (${valueType}) must declare the WizImmutableValue contract`
    )
  }

  const pluginFields = Reflect.ownKeys(state).flatMap((key) => {
    if (key === WIZ_IMMUTABLE_VALUE) {
      return []
    }
    const descriptor = Object.getOwnPropertyDescriptor(state, key)
    if (!descriptor || !("value" in descriptor)) {
      throw new TypeError(
        `Plugin scene "${state.type}" cannot own accessor field ${String(key)}`
      )
    }
    // vault is the one explicitly trusted runtime graph. Every plugin-owned
    // field remains subject to the strict immutable class contract.
    return descriptor.value === state.vault ? [] : [descriptor.value]
  })
  standardPluginFieldOwnership.ownImmutable(pluginFields)
  return standardValueOwnership.ownImmutable(state)
}

const ownStandardSceneState = <
  TExtraState extends WizStandardPluginSceneState,
  TTypes extends WizTypes = WizDefaultTypes,
  TRewardCustom = undefined,
>(
  state: WizStandardState<TExtraState, TTypes, TRewardCustom>
): WizStandardState<TExtraState, TTypes, TRewardCustom> => {
  if (WizStandardSceneName.isBuiltIn(state.type)) {
    if (!isExactBuiltInSceneState(state)) {
      throw new TypeError(
        `Scene type "${state.type}" is reserved for its standard built-in state class`
      )
    }
    return standardValueOwnership.ownImmutable(state)
  }
  WizStandardSceneName.assertPlugin(state.type)
  return ownPluginSceneState(state)
}

const assertPluginSceneNames = <
  TExtraState extends WizStandardPluginSceneState,
  TPluginActionInput,
  TPluginActionOutput extends WizPluginSceneAction,
  TPluginEvent,
  TPluginReason extends string,
>(
  pluginScenes:
    | WizPluginSceneRegistry<
        TExtraState,
        TPluginActionInput,
        TPluginActionOutput,
        TPluginEvent,
        TPluginReason
      >
    | undefined
): void => {
  for (const type of pluginScenes?.sceneTypes ?? []) {
    WizStandardSceneName.assertPlugin(type)
  }
  for (const navigation of pluginScenes?.navigationSources ?? []) {
    for (const sourceType of navigation.sourceTypes) {
      if (
        !WizStandardSceneName.isBuiltIn(sourceType) &&
        pluginScenes?.hasScene(sourceType) !== true
      ) {
        throw new RangeError(
          `Plugin scene "${navigation.sceneType}" has unknown navigation source "${sourceType}"`
        )
      }
    }
  }
}

const WIZ_STANDARD_VILLAGE_ACTIONS: readonly WizSceneVillageActionType[] =
  Object.freeze(["explore", "shop", "quest", "talk", "home", "inn"])

/**
 * content literal IDをstandard commandへ変換する、不変なaction factory。
 */
export class WizStandardActions<
  TArrays extends WorldContentArrays = WorldContentArrays,
> {
  readonly battle: WizStandardBattleActions<TArrays>
  readonly #content: WorldContent<TArrays>
  readonly #origin: symbol

  private constructor(
    token: symbol,
    content: WorldContent<TArrays>,
    origin: symbol
  ) {
    assertStandardSceneWorldConstructionToken(token)
    this.#content = content
    this.#origin = origin
    this.battle = createWizStandardBattleActions<TArrays>(
      origin,
      content.arrays.abilities.map((ability) => ability.id),
      content.arrays.items.flatMap((item) =>
        isBattleUsableItemDefinition(item) ? [item.id] : []
      )
    )
    Object.freeze(this)
  }

  /** @internal */
  static create<TArrays extends WorldContentArrays>(
    token: typeof standardSceneWorldConstructionToken,
    content: WorldContent<TArrays>,
    origin: symbol
  ): WizStandardActions<TArrays> {
    return new WizStandardActions(token, content, origin)
  }

  area<const TCandidate extends string>(
    areaId: WizStandardCheckedIdInput<TCandidate, WizStandardAreaId<TArrays>>
  ): WizStandardAreaActions<
    TArrays,
    WizStandardCheckedId<TCandidate, WizStandardAreaId<TArrays>>
  >
  area(
    areaId: string
  ): WizStandardAreaActions<TArrays, WizStandardAreaId<TArrays>> {
    const area = this.#content.arrays.areas.find(
      (
        candidate
      ): candidate is typeof candidate &
        Readonly<{ id: WizStandardAreaId<TArrays> }> => candidate.id === areaId
    )
    if (!area) {
      throw new RangeError(`Unknown standard area "${areaId}"`)
    }
    return createWizStandardAreaActions<TArrays, WizStandardAreaId<TArrays>>(
      this.#origin,
      area.id,
      area.monsterIds
    )
  }

  npc<const TCandidate extends string>(
    npcId: WizStandardCheckedIdInput<TCandidate, WizStandardNpcId<TArrays>>
  ): WizStandardNpcActions<
    TArrays,
    WizStandardCheckedId<TCandidate, WizStandardNpcId<TArrays>>
  >
  npc(
    npcId: string
  ): WizStandardNpcActions<TArrays, WizStandardNpcId<TArrays>> {
    const npc = this.#content.arrays.npcs.find(
      (
        candidate
      ): candidate is typeof candidate &
        Readonly<{ id: WizStandardNpcId<TArrays> }> => candidate.id === npcId
    )
    if (!npc) {
      throw new RangeError(`Unknown standard NPC "${npcId}"`)
    }
    return createWizStandardNpcActions<TArrays, WizStandardNpcId<TArrays>>(
      this.#origin,
      npc.id,
      npc.dialogues
    )
  }

  event<const TCandidate extends string>(
    eventId: WizStandardCheckedIdInput<TCandidate, WizStandardEventId<TArrays>>
  ): WizStandardEventActions<
    TArrays,
    WizStandardCheckedId<TCandidate, WizStandardEventId<TArrays>>
  >
  event(
    eventId: string
  ): WizStandardEventActions<TArrays, WizStandardEventId<TArrays>> {
    const event = this.#content.arrays.events.find(
      (
        candidate
      ): candidate is typeof candidate &
        Readonly<{ id: WizStandardEventId<TArrays> }> =>
        candidate.id === eventId
    )
    if (!event) {
      throw new RangeError(`Unknown standard event "${eventId}"`)
    }
    return createWizStandardEventActions<TArrays, WizStandardEventId<TArrays>>(
      this.#origin,
      event.id,
      event.choices.length
    )
  }

  recipe<const TCandidate extends string>(
    recipeId: WizStandardCheckedIdInput<
      TCandidate,
      WizStandardRecipeId<TArrays>
    >
  ): WizStandardRecipeActions<
    TArrays,
    WizStandardCheckedId<TCandidate, WizStandardRecipeId<TArrays>>
  >
  recipe(
    recipeId: string
  ): WizStandardRecipeActions<TArrays, WizStandardRecipeId<TArrays>> {
    const recipe = this.#content.arrays.recipes.find(
      (
        candidate
      ): candidate is typeof candidate &
        Readonly<{ id: WizStandardRecipeId<TArrays> }> =>
        candidate.id === recipeId
    )
    if (!recipe) {
      throw new RangeError(`Unknown standard recipe "${recipeId}"`)
    }
    return createWizStandardRecipeActions<
      TArrays,
      WizStandardRecipeId<TArrays>
    >(this.#origin, recipe.id)
  }

  quest<const TCandidate extends string>(
    questId: WizStandardCheckedIdInput<TCandidate, WizStandardQuestId<TArrays>>
  ): WizStandardQuestActions<
    TArrays,
    WizStandardCheckedId<TCandidate, WizStandardQuestId<TArrays>>
  >
  quest(
    questId: string
  ): WizStandardQuestActions<TArrays, WizStandardQuestId<TArrays>> {
    const quest = this.#content.arrays.quests.find(
      (
        candidate
      ): candidate is typeof candidate &
        Readonly<{ id: WizStandardQuestId<TArrays> }> =>
        candidate.id === questId
    )
    if (!quest) {
      throw new RangeError(`Unknown standard quest "${questId}"`)
    }
    return createWizStandardQuestActions<TArrays, WizStandardQuestId<TArrays>>(
      this.#origin,
      quest.id
    )
  }

  shop<const TCandidate extends string>(
    shopId: WizStandardCheckedIdInput<TCandidate, WizStandardShopId<TArrays>>
  ): WizStandardShopActions<
    TArrays,
    WizStandardCheckedId<TCandidate, WizStandardShopId<TArrays>>
  >
  shop(
    shopId: string
  ): WizStandardShopActions<TArrays, WizStandardShopId<TArrays>> {
    const shop = this.#content.shopDialogues.find(
      (
        candidate
      ): candidate is typeof candidate &
        Readonly<{ shopId: WizStandardShopId<TArrays> }> =>
        candidate.shopId === shopId
    )
    if (!shop) {
      throw new RangeError(`Unknown standard shop "${shopId}"`)
    }
    return createWizStandardShopActions<TArrays, WizStandardShopId<TArrays>>(
      this.#origin,
      shop.shopId,
      shop.products.itemIds,
      shop.products.weaponIds,
      shop.products.armorIds,
      shop.topics.map((topic) => topic.id)
    )
  }

  selectVillageAction<const TCandidate extends string>(
    action: WizStandardCheckedIdInput<TCandidate, WizSceneVillageActionType>
  ): WizStandardActionValueFor<{
    type: "SELECT_VILLAGE_ACTION"
    action: WizStandardCheckedId<TCandidate, WizSceneVillageActionType>
  }>
  selectVillageAction(action: string) {
    const knownAction = WIZ_STANDARD_VILLAGE_ACTIONS.find(
      (candidate) => candidate === action
    )
    if (knownAction === undefined) {
      throw new RangeError(`Unknown standard village action "${action}"`)
    }

    return this.create({ type: "SELECT_VILLAGE_ACTION", action: knownAction })
  }

  enterInn() {
    return this.create({ type: "GO_TO_INN" })
  }

  openQuestBoard() {
    return this.create({ type: "GO_TO_QUEST" })
  }

  enterCrafting() {
    return this.create({ type: "GO_TO_CRAFTING" })
  }

  confirmPurchase() {
    return this.create({ type: "CONFIRM_PURCHASE" })
  }

  cancelPurchase() {
    return this.create({ type: "CANCEL_PURCHASE" })
  }

  sellItem<const TCandidate extends string>(
    itemId: WizStandardCheckedIdInput<
      TCandidate,
      WizStandardContentId<TArrays, "items">
    >
  ): WizStandardActionValueFor<{
    type: "SELL_ITEM"
    itemId: WizStandardCheckedId<
      TCandidate,
      WizStandardContentId<TArrays, "items">
    >
  }>
  sellItem(itemId: string) {
    const knownItemId = this.#content.arrays.items.find(
      (candidate) => candidate.id === itemId
    )?.id
    if (knownItemId === undefined) {
      throw new RangeError(`Unknown standard item "${itemId}"`)
    }

    return this.create({ type: "SELL_ITEM", itemId: knownItemId })
  }

  advanceShopConversation() {
    return this.create({ type: "ADVANCE_SHOP_CONVERSATION" })
  }

  endShopConversation() {
    return this.create({ type: "END_SHOP_CONVERSATION" })
  }

  leaveShop() {
    return this.create({ type: "LEAVE_SHOP" })
  }

  selectStayPlan<const TCandidate extends string>(
    plan: WizStandardCheckedIdInput<TCandidate, WizStandardInnPlanId<TArrays>>
  ): WizStandardActionValueFor<{
    type: "SELECT_STAY_PLAN"
    plan: WizStandardCheckedId<TCandidate, WizStandardInnPlanId<TArrays>>
  }>
  selectStayPlan(plan: string) {
    const knownPlan = this.#content.arrays.innPlans.find(
      (candidate) => candidate.id === plan
    )?.id
    if (knownPlan === undefined) {
      throw new RangeError(`Unknown standard stay plan "${plan}"`)
    }

    return this.create({ type: "SELECT_STAY_PLAN", plan: knownPlan })
  }

  confirmStay() {
    return this.create({ type: "CONFIRM_STAY" })
  }

  cancelStay() {
    return this.create({ type: "CANCEL_STAY" })
  }

  leaveInn() {
    return this.create({ type: "LEAVE_INN" })
  }

  continueExploration() {
    return this.create({ type: "CONTINUE_EXPLORATION" })
  }

  eatFood<const TCandidate extends string>(
    itemId: WizStandardCheckedIdInput<
      TCandidate,
      WizStandardFoodItemId<TArrays>
    >
  ): WizStandardActionValueFor<{
    type: "EAT_FOOD"
    itemId: WizStandardCheckedId<TCandidate, WizStandardFoodItemId<TArrays>>
  }>
  eatFood(itemId: string) {
    const isKnownFoodItemId = (
      candidateId: string
    ): candidateId is WizStandardFoodItemId<TArrays> =>
      this.#content.arrays.items.some(
        (candidate) =>
          candidate.id === candidateId && candidate.effect?.type === "food"
      )
    if (!isKnownFoodItemId(itemId)) {
      throw new RangeError(`Unknown standard food item "${itemId}"`)
    }

    return this.create({ type: "EAT_FOOD", itemId })
  }

  advanceDialogue() {
    return this.create({ type: "ADVANCE_DIALOGUE" })
  }

  selectGift<const TCandidate extends string>(
    itemId: WizStandardCheckedIdInput<
      TCandidate,
      WizStandardContentId<TArrays, "items">
    >
  ): WizStandardActionValueFor<{
    type: "SELECT_GIFT"
    itemId: WizStandardCheckedId<
      TCandidate,
      WizStandardContentId<TArrays, "items">
    >
  }>
  selectGift(itemId: string) {
    const knownItemId = this.#content.arrays.items.find(
      (candidate) => candidate.id === itemId
    )?.id
    if (knownItemId === undefined) {
      throw new RangeError(`Unknown standard item "${itemId}"`)
    }

    return this.create({ type: "SELECT_GIFT", itemId: knownItemId })
  }

  confirmGift() {
    return this.create({ type: "CONFIRM_GIFT" })
  }

  cancelGift() {
    return this.create({ type: "CANCEL_GIFT" })
  }

  endConversation() {
    return this.create({ type: "END_CONVERSATION" })
  }

  confirmCraft() {
    return this.create({ type: "CONFIRM_CRAFT" })
  }

  cancelCraft() {
    return this.create({ type: "CANCEL_CRAFT" })
  }

  leaveCrafting() {
    return this.create({ type: "LEAVE_CRAFTING" })
  }

  acceptQuest() {
    return this.create({ type: "ACCEPT_QUEST" })
  }

  completeQuest() {
    return this.create({ type: "COMPLETE_QUEST" })
  }

  clearQuestSelection() {
    return this.create({ type: "CLEAR_QUEST_SELECTION" })
  }

  leaveQuestBoard() {
    return this.create({ type: "LEAVE_QUEST" })
  }

  allocateAttribute<const TCandidate extends string>(
    attribute: WizStandardCheckedIdInput<TCandidate, WizAttributeKey>
  ): WizStandardActionValueFor<{
    type: "ALLOCATE_ATTRIBUTE"
    attribute: WizStandardCheckedId<TCandidate, WizAttributeKey>
  }>
  allocateAttribute(attribute: string) {
    const knownAttribute = WIZ_ATTRIBUTE_KEYS.find(
      (candidate) => candidate === attribute
    )
    if (knownAttribute === undefined) {
      throw new RangeError(`Unknown standard attribute "${attribute}"`)
    }

    return this.create({
      type: "ALLOCATE_ATTRIBUTE",
      attribute: knownAttribute,
    })
  }

  resetPendingAttributes() {
    return this.create({ type: "RESET_PENDING_ATTRIBUTES" })
  }

  confirmLevelUp() {
    return this.create({ type: "CONFIRM_LEVEL_UP" })
  }

  useItem<const TCandidate extends string>(
    itemId: WizStandardCheckedIdInput<
      TCandidate,
      WizStandardContentId<TArrays, "items">
    >
  ): WizStandardActionValueFor<{
    type: "USE_ITEM"
    itemId: WizStandardCheckedId<
      TCandidate,
      WizStandardContentId<TArrays, "items">
    >
  }>
  useItem(itemId: string) {
    const knownItemId = this.#content.arrays.items.find(
      (candidate) => candidate.id === itemId
    )?.id
    if (knownItemId === undefined) {
      throw new RangeError(`Unknown standard item "${itemId}"`)
    }

    return this.create({ type: "USE_ITEM", itemId: knownItemId })
  }

  equip<const TEntryId extends string, const TCandidate extends string>(
    entryId: TEntryId,
    slotId: WizStandardCheckedIdInput<
      TCandidate,
      WizStandardEquipmentSlotId<TArrays>
    >
  ): WizStandardActionValueFor<{
    entryId: TEntryId
    type: "EQUIP"
    slotId: WizStandardCheckedId<
      TCandidate,
      WizStandardEquipmentSlotId<TArrays>
    >
  }>
  equip(entryId: string, slotId: string) {
    const knownSlotId = [
      ...this.#content.arrays.weapons,
      ...this.#content.arrays.armors,
    ].find((candidate) => candidate.slotId === slotId)?.slotId
    if (knownSlotId === undefined) {
      throw new RangeError(`Unknown standard equipment slot "${slotId}"`)
    }
    return this.create({ type: "EQUIP", entryId, slotId: knownSlotId })
  }

  unequip<const TCandidate extends string>(
    slotId: WizStandardCheckedIdInput<
      TCandidate,
      WizStandardEquipmentSlotId<TArrays>
    >
  ): WizStandardActionValueFor<{
    type: "UNEQUIP"
    slotId: WizStandardCheckedId<
      TCandidate,
      WizStandardEquipmentSlotId<TArrays>
    >
  }>
  unequip(slotId: string) {
    const knownSlotId = [
      ...this.#content.arrays.weapons,
      ...this.#content.arrays.armors,
    ].find((candidate) => candidate.slotId === slotId)?.slotId
    if (knownSlotId === undefined) {
      throw new RangeError(`Unknown standard equipment slot "${slotId}"`)
    }
    return this.create({ type: "UNEQUIP", slotId: knownSlotId })
  }

  returnToVillage() {
    return this.create({ type: "RETURN_TO_VILLAGE" })
  }

  advanceTime() {
    return this.create({ type: "ADVANCE_TIME" })
  }

  startNewDay() {
    return this.create({ type: "NEW_DAY" })
  }

  endWorld() {
    return this.create({ type: "WORLD_ENDED" })
  }

  addLog<const TMessage extends WizLogMessage>(
    message: TMessage
  ): WizStandardActionValueFor<{
    type: "ADD_LOG"
    message: WizDeepReadonly<TMessage>
  }>
  addLog(message: WizLogMessage) {
    const validation = zWizLogMessage.safeParse(message)
    if (!validation.success) {
      throw new TypeError("Invalid standard log message")
    }

    return this.create({
      type: "ADD_LOG",
      message: validation.data,
    })
  }

  resetWorld() {
    return this.create({ type: "WORLD_RESET" })
  }

  private create<TAction extends WizStandardPublicAction>(action: TAction) {
    return createWizStandardActionValue(this.#origin, action)
  }
}

Object.freeze(WizStandardActions.prototype)
Object.freeze(WizStandardActions)

const createWizStandardActions = <TArrays extends WorldContentArrays>(
  content: WorldContent<TArrays>,
  origin: symbol
): WizStandardActions<TArrays> =>
  WizStandardActions.create(
    standardSceneWorldConstructionToken,
    content,
    origin
  )

const STANDARD_INVENTORY_ACTION_TYPES: readonly string[] = Object.freeze([
  "USE_ITEM",
  "EQUIP",
  "UNEQUIP",
])

const GLOBAL_ACTION_TYPES: readonly string[] = Object.freeze([
  "ADD_LOG",
  "ADVANCE_TIME",
  "NEW_DAY",
  "WORLD_ENDED",
  "WORLD_RESET",
  ...STANDARD_INVENTORY_ACTION_TYPES,
])

const SCENE_ACTION_TYPES: Readonly<
  Record<WizState["type"], readonly string[]>
> = Object.freeze({
  village: Object.freeze([
    "SELECT_VILLAGE_ACTION",
    "GO_TO_SHOP",
    "GO_TO_INN",
    "GO_TO_EXPLORATION",
    "TALK_TO_NPC",
    "GO_TO_QUEST",
    "GO_TO_CRAFTING",
  ]),
  shop: Object.freeze([
    "SELECT_ITEM_TO_BUY",
    "SELECT_WEAPON_TO_BUY",
    "SELECT_ARMOR_TO_BUY",
    "CONFIRM_PURCHASE",
    "CANCEL_PURCHASE",
    "SELL_ITEM",
    "START_SHOP_CONVERSATION",
    "ADVANCE_SHOP_CONVERSATION",
    "END_SHOP_CONVERSATION",
    "LEAVE_SHOP",
  ]),
  inn: Object.freeze([
    "SELECT_STAY_PLAN",
    "CONFIRM_STAY",
    "CANCEL_STAY",
    "LEAVE_INN",
  ]),
  exploration: Object.freeze([
    "EXPLORATION_ACTION",
    "SELECT_EVENT_CHOICE",
    "ROLL_DICE",
    "CONTINUE_EXPLORATION",
    "EAT_FOOD",
    "ENCOUNTER_MONSTER",
    "RETURN_TO_VILLAGE",
  ]),
  battle: Object.freeze([
    "BATTLE_START",
    "BATTLE_FLEE",
    "BATTLE_EXECUTE_INTENT",
    "BATTLE_EXECUTE_ENEMY_TURN",
    "BATTLE_END",
  ]),
  conversation: Object.freeze([
    "ADVANCE_DIALOGUE",
    "SELECT_DIALOGUE_OPTION",
    "SELECT_GIFT",
    "CONFIRM_GIFT",
    "CANCEL_GIFT",
    "END_CONVERSATION",
  ]),
  crafting: Object.freeze([
    "SELECT_RECIPE",
    "CONFIRM_CRAFT",
    "CANCEL_CRAFT",
    "LEAVE_CRAFTING",
  ]),
  quest: Object.freeze([
    "SELECT_QUEST",
    "CLEAR_QUEST_SELECTION",
    "ACCEPT_QUEST",
    "COMPLETE_QUEST",
    "LEAVE_QUEST",
  ]),
  level_up: Object.freeze([
    "ALLOCATE_ATTRIBUTE",
    "RESET_PENDING_ATTRIBUTES",
    "CONFIRM_LEVEL_UP",
  ]),
})

const isActionObject = (
  action: unknown
): action is Readonly<{ type: string }> &
  Readonly<Record<PropertyKey, unknown>> => {
  if (typeof action !== "object" || action === null) {
    return false
  }
  const type = Object.getOwnPropertyDescriptor(action, "type")?.value

  return typeof type === "string"
}

const getBattleTurnIntent = (
  action: unknown
): WizEngineBattleTurnIntent | undefined => {
  if (!isActionObject(action) || action.type !== "BATTLE_EXECUTE_INTENT") {
    return undefined
  }
  const intent = action.intent
  if (!(intent instanceof WizEngineBattleTurnIntent)) {
    return undefined
  }
  try {
    WizEngineBattleTurnIntent.assertAuthentic(intent)
    return intent
  } catch {
    return undefined
  }
}

const STANDARD_ACTION_TYPES = new Set<string>([
  ...GLOBAL_ACTION_TYPES,
  ...Object.values(SCENE_ACTION_TYPES).flat(),
])
const STANDARD_RESERVED_ACTION_TYPES = new Set<string>([
  ...STANDARD_ACTION_TYPES,
  "BATTLE_EXECUTE_ACTION",
])

type WizStandardActionAdmissionRejectionReason =
  | "ACTION_NOT_ALLOWED_IN_SCENE"
  | "AREA_SCOPE_MISMATCH"
  | "DIALOGUE_SCOPE_MISMATCH"
  | "ENCOUNTER_REQUIRES_EXPLORATION"
  | "EVENT_SCOPE_MISMATCH"
  | "NPC_SCOPE_MISMATCH"
  | "SHOP_SCOPE_MISMATCH"

type WizStandardActionAdmission = Readonly<
  | { accepted: true }
  | {
      accepted: false
      reason?: WizStandardActionAdmissionRejectionReason
    }
>

const ACCEPTED_STANDARD_ACTION = Object.freeze({ accepted: true as const })
const UNHANDLED_STANDARD_ACTION = Object.freeze({ accepted: false as const })

const getStandardActionAdmission = <
  TExtraState extends WizStandardPluginSceneState,
  TPluginActionInput,
  TPluginActionOutput extends WizPluginSceneAction,
  TTypes extends WizTypes,
  TRewardCustom,
  TPluginEvent,
  TPluginReason extends string,
>(
  state: WizStandardState<TExtraState, TTypes, TRewardCustom>,
  action: unknown,
  pluginScenes:
    | WizPluginSceneRegistry<
        TExtraState,
        TPluginActionInput,
        TPluginActionOutput,
        TPluginEvent,
        TPluginReason
      >
    | undefined,
  actionOrigin: symbol
): WizStandardActionAdmission => {
  if (!isActionObject(action)) {
    return pluginScenes?.acceptsAnyAction(action) === true
      ? Object.freeze({
          accepted: false,
          reason: "ACTION_NOT_ALLOWED_IN_SCENE",
        })
      : UNHANDLED_STANDARD_ACTION
  }
  if (
    STANDARD_RESERVED_ACTION_TYPES.has(action.type) &&
    !isWizStandardActionFromOrigin(action, actionOrigin)
  ) {
    return UNHANDLED_STANDARD_ACTION
  }
  if (
    state.type === "battle" &&
    STANDARD_INVENTORY_ACTION_TYPES.includes(action.type)
  ) {
    return Object.freeze({
      accepted: false,
      reason: "ACTION_NOT_ALLOWED_IN_SCENE",
    })
  }
  if (GLOBAL_ACTION_TYPES.includes(action.type)) {
    return ACCEPTED_STANDARD_ACTION
  }
  if (action.type === "ENCOUNTER_MONSTER" && state.type !== "exploration") {
    return Object.freeze({
      accepted: false,
      reason: "ENCOUNTER_REQUIRES_EXPLORATION",
    })
  }
  if (
    state instanceof WizStateExploration &&
    (action.type === "EXPLORATION_ACTION" ||
      action.type === "ENCOUNTER_MONSTER") &&
    action.areaId !== state.areaId
  ) {
    return Object.freeze({
      accepted: false,
      reason: "AREA_SCOPE_MISMATCH",
    })
  }
  if (
    state instanceof WizStateExploration &&
    (action.type === "SELECT_EVENT_CHOICE" || action.type === "ROLL_DICE")
  ) {
    const activeEventId =
      state.eventProgress.status === "none"
        ? undefined
        : state.eventProgress.event.id
    if (action.eventId !== activeEventId) {
      return Object.freeze({
        accepted: false,
        reason: "EVENT_SCOPE_MISMATCH",
      })
    }
  }
  if (
    state instanceof WizStateConversation &&
    action.type === "SELECT_DIALOGUE_OPTION"
  ) {
    if (action.npcId !== state.npcId) {
      return Object.freeze({
        accepted: false,
        reason: "NPC_SCOPE_MISMATCH",
      })
    }
    if (action.dialogueId !== state.dialogueId) {
      return Object.freeze({
        accepted: false,
        reason: "DIALOGUE_SCOPE_MISMATCH",
      })
    }
  }
  if (
    state instanceof WizStateShop &&
    (action.type === "SELECT_ITEM_TO_BUY" ||
      action.type === "SELECT_WEAPON_TO_BUY" ||
      action.type === "SELECT_ARMOR_TO_BUY" ||
      action.type === "START_SHOP_CONVERSATION") &&
    action.shopId !== state.shopId
  ) {
    return Object.freeze({
      accepted: false,
      reason: "SHOP_SCOPE_MISMATCH",
    })
  }
  const sceneActionTypes = Object.hasOwn(SCENE_ACTION_TYPES, state.type)
    ? SCENE_ACTION_TYPES[state.type as WizState["type"]]
    : undefined
  const accepted = sceneActionTypes?.includes(action.type) === true
  if (accepted) {
    return ACCEPTED_STANDARD_ACTION
  }
  return (isWizStandardActionFromOrigin(action, actionOrigin) &&
    STANDARD_ACTION_TYPES.has(action.type)) ||
    pluginScenes?.acceptsAnyAction(action) === true
    ? Object.freeze({
        accepted: false,
        reason: "ACTION_NOT_ALLOWED_IN_SCENE",
      })
    : UNHANDLED_STANDARD_ACTION
}

const overlaySnapshot = (
  base: WizVaultValue,
  snapshot: WorldSnapshot
): WizVaultValue => {
  const baseData = base.toPlain()
  const snapshotData = snapshot.toPlain()

  const properties: WizVaultObject = {
    ...baseData,
    player: {
      ...snapshotData.player,
      attributes: { ...snapshotData.player.attributes },
      ...(snapshotData.player.customAttributes === undefined
        ? {}
        : { customAttributes: { ...snapshotData.player.customAttributes } }),
      abilityIds: [...snapshotData.player.abilityIds],
    },
    partyMembers: snapshotData.partyMembers.map((member) => ({
      ...member,
      attributes: { ...member.attributes },
      abilityIds: [...member.abilityIds],
    })),
    inventory: {
      ...snapshotData.inventory,
      entries: snapshotData.inventory.entries.map((entry) => ({ ...entry })),
    },
    equipment: snapshotData.equipment,
    time: { ...snapshotData.time },
    areas: baseData.areas.map((area) => {
      const state = snapshotData.areas.find(
        (candidate) => candidate.id === area.id
      )
      return state
        ? {
            ...area,
            progress: state.progress,
            unlocked: state.unlocked,
          }
        : area
    }),
    npcs: baseData.npcs.map((npc) => {
      const state = snapshotData.npcs.find(
        (candidate) => candidate.id === npc.id
      )
      return state ? { ...npc, affinity: state.affinity } : npc
    }),
    quests: baseData.quests.map((quest) => {
      const state = snapshotData.quests.find(
        (candidate) => candidate.id === quest.id
      )
      if (!state) {
        return quest
      }
      return {
        ...quest,
        accepted: state.accepted,
        completed: state.completed,
        objective:
          state.progress !== undefined && "current" in quest.objective
            ? { ...quest.objective, current: state.progress }
            : quest.objective,
      }
    }),
    flags: snapshotData.flags,
    log: snapshotData.log,
    unlockedFacilities: snapshotData.unlockedFacilities,
    isEnded: snapshotData.isEnded,
  }
  return WizVaultValue.fromPlain(properties)
}

const areStandardStateValuesEqual = (
  left: unknown,
  right: unknown
): boolean => {
  if (Object.is(left, right)) {
    return true
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((entry, index) =>
        areStandardStateValuesEqual(entry, right[index])
      )
    )
  }
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false
  }

  const leftRecord = left as Readonly<Record<string, unknown>>
  const rightRecord = right as Readonly<Record<string, unknown>>
  const leftKeys = Object.keys(leftRecord)
  const rightKeys = Object.keys(rightRecord)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.hasOwn(rightRecord, key) &&
        areStandardStateValuesEqual(leftRecord[key], rightRecord[key])
    )
  )
}

const standardStateOrigins = new WeakMap<object, object>()

/**
 * stateを変更せず、world固有tokenとcanonical vaultの両方で出自を検証する。
 *
 * initial state、internal dispatch result、restore resultだけをtrustedとして登録する。
 * 公開境界へ戻された`with*()`派生値は、内容が似ていてもidentity authorityを持たない。
 */
class WizStandardStateProvenance<TArrays extends WorldContentArrays> {
  private readonly token = Object.freeze({})

  constructor(
    private readonly canonicalVault: WizVaultValue,
    private readonly content: WorldContent<TArrays>
  ) {
    Object.freeze(this)
  }

  registerTrusted<TState extends WizPluginSceneState>(state: TState): TState {
    const origin = standardStateOrigins.get(state)
    if (origin === this.token) {
      return state
    }
    if (origin !== undefined) {
      throw new WizStandardStateProvenanceError(
        "FOREIGN_WORLD_STATE",
        state.type
      )
    }

    const rawSnapshot = WorldSnapshot.fromVault(state.vault)
    const snapshot = this.content.validateSnapshot(rawSnapshot)
    const canonicalVault = overlaySnapshot(this.canonicalVault, snapshot)
    if (
      !areStandardStateValuesEqual(
        state.vault.toPlain(),
        canonicalVault.toPlain()
      )
    ) {
      throw new WizStandardStateProvenanceError(
        "CONTENT_DEFINITION_MISMATCH",
        state.type
      )
    }

    standardStateOrigins.set(state, this.token)
    return state
  }

  requireAdmitted<TState extends WizPluginSceneState>(state: TState): TState {
    const origin = standardStateOrigins.get(state)
    if (origin === this.token) {
      return state
    }
    if (origin !== undefined) {
      throw new WizStandardStateProvenanceError(
        "FOREIGN_WORLD_STATE",
        state.type
      )
    }
    throw new WizStandardStateProvenanceError(
      "UNTRUSTED_WORLD_STATE",
      state.type
    )
  }
}

const validateStandardAffinity = (
  npcs: readonly Readonly<{ id: string; affinity: number }>[],
  affinitySystem: WizConversationAffinityPort
): void => {
  const diagnostics = npcs.flatMap<WizStandardConfigurationDiagnostic>(
    (npc, index) =>
      !affinitySystem.acceptsAffinity(npc.affinity)
        ? [
            {
              code: "NPC_AFFINITY_REJECTED",
              affinity: npc.affinity,
              npcId: npc.id,
              path: `npcs[${index}].affinity`,
              message: `NPC "${npc.id}" affinity at npcs[${index}].affinity is not accepted by the configured affinity system`,
            },
          ]
        : []
  )

  if (diagnostics.length > 0) {
    throw new WizStandardConfigurationError(diagnostics)
  }
}

type StandardComposition<
  TArrays extends WorldContentArrays,
  TExtraState extends WizStandardPluginSceneState,
  TPluginActionInput,
  TPluginActionOutput extends WizPluginSceneAction,
  TTypes extends WizTypes,
  TPluginEvent,
  TPluginReason extends string,
  TRewardCustom,
> = Readonly<{
  content: WorldContent<TArrays>
  initialSnapshot: WorldSnapshot<WorldContentSnapshotData<TArrays>>
  initialState: WizStandardState<TExtraState, TTypes, TRewardCustom>
  environment: WizWorldEnvironment
  actions: WizStandardActions<TArrays>
  actionOrigin: symbol
  battleCharacterAuthority: WizSceneBattleCharacterAuthority<
    WizBattleStatusCustom<TTypes["BattleStatus"]>
  >
  battleMonsterAuthority: WizSceneBattleMonsterAuthority<
    WizBattleStatusCustom<TTypes["BattleStatus"]>,
    WizBattleMonsterCustom<TTypes>
  >
  battleContent?: WizEngineBattleContentResolver
  affinitySystem: WizConversationAffinityPort
  levelUpPointsPerLevel: number
  resolveRecipe?: (
    recipeId: string
  ) => WizDeepReadonly<WizContentRecipe> | undefined
  shopDialogues?: WizEngineShopDialogueService
  effectConfig: WizEffectConfig
  pluginScenes?: WizPluginSceneRegistry<
    TExtraState,
    TPluginActionInput,
    TPluginActionOutput,
    TPluginEvent,
    TPluginReason
  >
}>

/**
 * 村・探索・戦闘・時間・survival構成を、contentから一度に組み立てる不変facade。
 */
export class WizStandardSceneWorld<
  TArrays extends WorldContentArrays = WorldContentArrays,
  TExtraState extends WizStandardPluginSceneState = never,
  TPluginActionInput = never,
  TPluginActionOutput extends WizPluginSceneAction = never,
  TTypes extends WizTypes = WizDefaultTypes,
  TPluginEvent = never,
  TPluginReason extends string = never,
  TRewardCustom = undefined,
  TMechanicsReason extends string = never,
> {
  readonly content: WorldContent<TArrays>
  readonly initialState: WizStandardState<TExtraState, TTypes, TRewardCustom>
  readonly initialSnapshot: WorldSnapshot<WorldContentSnapshotData<TArrays>>
  readonly environment: WizWorldEnvironment
  readonly actions: WizStandardActions<TArrays>

  readonly #actionOrigin: symbol
  private readonly kernel: WizWorld<
    WizStandardState<TExtraState, TTypes, TRewardCustom>,
    WizStandardKernelAction<TPluginActionInput, TPluginActionOutput>,
    WizStandardEvent<TExtraState, TPluginActionOutput, TPluginEvent, TTypes>,
    WizStandardRejectionReason<TPluginReason, TMechanicsReason>
  >
  private readonly pluginScenes?: WizPluginSceneRegistry<
    TExtraState,
    TPluginActionInput,
    TPluginActionOutput,
    TPluginEvent,
    TPluginReason
  >
  private readonly battleCharacterAuthority: WizSceneBattleCharacterAuthority<
    WizBattleStatusCustom<TTypes["BattleStatus"]>
  >
  private readonly battleMonsterAuthority: WizSceneBattleMonsterAuthority<
    WizBattleStatusCustom<TTypes["BattleStatus"]>,
    WizBattleMonsterCustom<TTypes>
  >
  private readonly battleContent?: WizEngineBattleContentResolver
  private readonly affinitySystem: WizConversationAffinityPort
  private readonly levelUpPointsPerLevel: number
  private readonly resolveRecipe?: (
    recipeId: string
  ) => WizDeepReadonly<WizContentRecipe> | undefined
  private readonly shopDialogues?: WizEngineShopDialogueService
  private readonly effectConfig: WizEffectConfig
  private readonly stateProvenance: WizStandardStateProvenance<TArrays>
  private readonly rootReducer: WizRootReducer<
    TExtraState,
    TPluginActionInput,
    TPluginActionOutput,
    TTypes,
    TPluginEvent,
    TPluginReason,
    TRewardCustom,
    TMechanicsReason
  >

  private constructor(
    token: symbol,
    composition: StandardComposition<
      TArrays,
      TExtraState,
      TPluginActionInput,
      TPluginActionOutput,
      TTypes,
      TPluginEvent,
      TPluginReason,
      TRewardCustom
    >,
    rootReducer: WizRootReducer<
      TExtraState,
      TPluginActionInput,
      TPluginActionOutput,
      TTypes,
      TPluginEvent,
      TPluginReason,
      TRewardCustom,
      TMechanicsReason
    >
  ) {
    assertStandardSceneWorldConstructionToken(token)
    const module = WizWorldModule.define<
      WizStandardState<TExtraState, TTypes, TRewardCustom>,
      WizStandardKernelAction<TPluginActionInput, TPluginActionOutput>,
      WizStandardEvent<TExtraState, TPluginActionOutput, TPluginEvent, TTypes>,
      WizStandardRejectionReason<TPluginReason, TMechanicsReason>
    >({
      name: "standard-runtime",
      accepts: (
        action
      ): action is WizStandardKernelAction<
        TPluginActionInput,
        TPluginActionOutput
      > =>
        action instanceof WizPluginSceneResolvedAction ||
        isActionObject(action),
      reduce: (state, action, transactionEnvironment) => {
        // kernel ownershipはbuilt-in/plugin双方のimmutable contractとprototypeを検証済み。
        // conditional readonly型がgeneric plugin subtypeを展開する型上の差だけをここで戻す。
        const reducerState = state as
          | WizStateFor<TTypes, TRewardCustom>
          | TExtraState
        const canonicalPluginAction =
          action instanceof WizPluginSceneResolvedAction
            ? composition.pluginScenes?.getCanonicalAction(state.type, action)
            : null
        if (
          action instanceof WizPluginSceneResolvedAction &&
          canonicalPluginAction == null
        ) {
          return { accepted: false, reason: "PLUGIN_ACTION_INVALID" }
        }
        const battleIntent = getBattleTurnIntent(action)
        const reducerAction = battleIntent
          ? ({
              type: "BATTLE_EXECUTE_ACTION",
              action: materializeWizEngineBattleTurnIntent(
                battleIntent,
                transactionEnvironment.nextId()
              ),
            } satisfies Extract<WizAction, { type: "BATTLE_EXECUTE_ACTION" }>)
          : (action as unknown as WizAction)
        const result =
          action instanceof WizPluginSceneResolvedAction
            ? rootReducer.reduceResolvedPluginAction(reducerState, action)
            : rootReducer.reduce(reducerState, reducerAction)
        if (result.accepted === false) {
          return { accepted: false, reason: result.reason }
        }
        if (result.state === state && result.events.length === 0) {
          return { accepted: false, reason: "NO_STATE_CHANGE" }
        }
        const appliedAction =
          action instanceof WizPluginSceneResolvedAction
            ? canonicalPluginAction
            : action
        if (appliedAction == null) {
          return { accepted: false, reason: "PLUGIN_ACTION_INVALID" }
        }
        const events: (
          | WizStandardActionAppliedEvent<
              WizStandardCanonicalAction<TPluginActionOutput>
            >
          | WizStandardSceneChangedEvent<
              WizStandardSceneType<TExtraState, TTypes>
            >
          | WizDeepReadonly<TPluginEvent>
        )[] = [
          new WizStandardActionAppliedEvent<
            WizStandardCanonicalAction<TPluginActionOutput>
          >(appliedAction),
          ...result.events,
        ]
        if (state.type !== result.state.type) {
          events.push(
            new WizStandardSceneChangedEvent<
              WizStandardSceneType<TExtraState, TTypes>
            >(state.type, result.state.type)
          )
        }

        return { accepted: true, events, state: result.state }
      },
    })

    this.kernel = WizWorld.create(
      composition.initialState,
      composition.environment,
      WizWorldStateOwnership.define<
        WizStandardState<TExtraState, TTypes, TRewardCustom>
      >({
        ownState: (state) => {
          const owned = ownStandardSceneState(
            state as WizStandardState<TExtraState, TTypes, TRewardCustom>
          ) as WizDeepReadonly<
            WizStandardState<TExtraState, TTypes, TRewardCustom>
          >
          validateStandardAffinity(owned.vault.npcs, composition.affinitySystem)
          return owned
        },
      })
    ).with(module)
    this.content = composition.content
    this.initialState = this.kernel.initialState
    this.initialSnapshot = composition.initialSnapshot
    this.environment = composition.environment
    this.actions = composition.actions
    this.#actionOrigin = composition.actionOrigin
    this.pluginScenes = composition.pluginScenes
    this.battleCharacterAuthority = composition.battleCharacterAuthority
    this.battleMonsterAuthority = composition.battleMonsterAuthority
    this.battleContent = composition.battleContent
    this.affinitySystem = composition.affinitySystem
    this.levelUpPointsPerLevel = composition.levelUpPointsPerLevel
    this.resolveRecipe = composition.resolveRecipe
    this.shopDialogues = composition.shopDialogues
    this.effectConfig = immutableConfig(composition.effectConfig)
    this.rootReducer = rootReducer
    this.stateProvenance = new WizStandardStateProvenance(
      this.initialState.vault,
      composition.content
    )
    this.stateProvenance.registerTrusted(this.initialState)
    Object.freeze(this)
  }

  static create<
    const TArrays extends WorldContentArrays,
    TTypes extends WizTypes,
    TExtraState extends WizStandardPluginSceneState = never,
    TPluginActionInput = never,
    TPluginActionOutput extends WizPluginSceneAction = never,
    TPluginEvent = never,
    TPluginReason extends string = never,
    TRewardCustom = undefined,
    TMechanicsReason extends string = never,
  >(
    options: Omit<
      WizStandardSceneWorldOptions<
        TArrays,
        TExtraState,
        TPluginActionInput,
        TPluginActionOutput,
        TTypes,
        TPluginEvent,
        TPluginReason,
        TRewardCustom,
        TMechanicsReason
      >,
      "preset"
    > & {
      readonly preset: WizPresetValue<TTypes>
    }
  ): WizStandardSceneWorld<
    TArrays,
    TExtraState,
    TPluginActionInput,
    TPluginActionOutput,
    TTypes,
    TPluginEvent,
    TPluginReason,
    TRewardCustom,
    TMechanicsReason
  >
  static create<
    const TArrays extends WorldContentArrays,
    TTypes extends WizTypes,
    TExtraState extends WizStandardPluginSceneState = never,
    TPluginActionInput = never,
    TPluginActionOutput extends WizPluginSceneAction = never,
    TPluginEvent = never,
    TPluginReason extends string = never,
    TRewardCustom = undefined,
    TMechanicsReason extends string = never,
  >(
    options: Omit<
      WizStandardSceneWorldOptions<
        TArrays,
        TExtraState,
        TPluginActionInput,
        TPluginActionOutput,
        TTypes,
        TPluginEvent,
        TPluginReason,
        TRewardCustom,
        TMechanicsReason
      >,
      "preset"
    > & {
      readonly preset: WizPreset<TTypes>
    }
  ): WizStandardSceneWorld<
    TArrays,
    TExtraState,
    TPluginActionInput,
    TPluginActionOutput,
    TTypes,
    TPluginEvent,
    TPluginReason,
    TRewardCustom,
    TMechanicsReason
  >
  static create<
    const TArrays extends WorldContentArrays,
    TRewardCustom = undefined,
    TMechanicsReason extends string = never,
  >(
    options: WizStandardSceneWorldOptions<
      TArrays,
      never,
      never,
      never,
      WizDefaultTypes,
      never,
      never,
      TRewardCustom,
      TMechanicsReason
    >
  ): WizStandardSceneWorld<
    TArrays,
    never,
    never,
    never,
    WizDefaultTypes,
    never,
    never,
    TRewardCustom,
    TMechanicsReason
  >
  static create<
    const TArrays extends WorldContentArrays,
    TExtraState extends WizStandardPluginSceneState = never,
    TPluginActionInput = never,
    TPluginActionOutput extends WizPluginSceneAction = never,
    TTypes extends WizTypes = WizDefaultTypes,
    TPluginEvent = never,
    TPluginReason extends string = never,
    TRewardCustom = undefined,
    TMechanicsReason extends string = never,
  >(
    options: WizStandardSceneWorldOptions<
      TArrays,
      TExtraState,
      TPluginActionInput,
      TPluginActionOutput,
      TTypes,
      TPluginEvent,
      TPluginReason,
      TRewardCustom,
      TMechanicsReason
    >
  ): WizStandardSceneWorld<
    TArrays,
    TExtraState,
    TPluginActionInput,
    TPluginActionOutput,
    TTypes,
    TPluginEvent,
    TPluginReason,
    TRewardCustom,
    TMechanicsReason
  >
  static create(options: unknown): unknown {
    const createConfigured = <
      const TArrays extends WorldContentArrays,
      TExtraState extends WizStandardPluginSceneState = never,
      TPluginActionInput = never,
      TPluginActionOutput extends WizPluginSceneAction = never,
      TTypes extends WizTypes = WizDefaultTypes,
      TPluginEvent = never,
      TPluginReason extends string = never,
      TRewardCustom = undefined,
      TMechanicsReason extends string = never,
    >(
      options: WizStandardSceneWorldOptions<
        TArrays,
        TExtraState,
        TPluginActionInput,
        TPluginActionOutput,
        TTypes,
        TPluginEvent,
        TPluginReason,
        TRewardCustom,
        TMechanicsReason
      >
    ): WizStandardSceneWorld<
      TArrays,
      TExtraState,
      TPluginActionInput,
      TPluginActionOutput,
      TTypes,
      TPluginEvent,
      TPluginReason,
      TRewardCustom,
      TMechanicsReason
    > => {
      const pluginScenes = options.pluginScenes
      assertPluginSceneNames(pluginScenes)
      const environment = options.environment ?? WizWorldEnvironment.create()
      const snapshot =
        options.initialSnapshot === undefined
          ? options.content.createInitialSnapshot()
          : options.content.validateSnapshot(options.initialSnapshot)
      const preset =
        options.preset ??
        (WizPresetValue.create() as unknown as WizPreset<TTypes>)
      assertValidWizPreset(preset)
      const runtimeEnvironment =
        WizStandardRuntimeEnvironment.fromWorldEnvironment(environment)
      const actionOrigin = createWizStandardActionOrigin()
      const battleContent = createWizStandardBattleContent(options.content)
      const mechanics = options.mechanics?.resolve({
        preset,
        content: options.content,
        battleContent,
        environment: runtimeEnvironment,
      })
      const affinitySystem =
        mechanics?.affinitySystem ??
        WizConversationAffinitySystem.fromConfig(preset.conversation)
      validateStandardAffinity(snapshot.toPlain().npcs, affinitySystem)
      const vault = overlaySnapshot(
        createWizStandardVault(options.content),
        snapshot
      )
      const baseState = toVillageScene(vault)
      const shopDialogues = createWizStandardShopDialogueService(
        options.content
      )
      const battleCharacterAuthority = new WizSceneBattleCharacterAdapter<
        TTypes["BattleStatus"]
      >(
        new WizSceneBattleStatusConversionService<TTypes["BattleStatus"]>(
          preset.statusConversion
        ),
        options.content
      )
      if (
        options.battleMonsterAdapter === undefined &&
        (preset.statusConversion.battleStatusFormula !== undefined ||
          preset.statusConversion.customStatusFormula !== undefined)
      ) {
        throw new TypeError(
          "Custom battle status requires a battleMonsterAdapter that creates every required monster status field"
        )
      }
      // The conditional option and runtime formula check above prove that this fallback
      // is reachable only for the empty standard status extension.
      const battleMonsterAdapter =
        options.battleMonsterAdapter ??
        (WizSceneBattleMonsterAdapter.createDefault() as unknown as WizSceneBattleMonsterAuthority<
          WizBattleStatusCustom<TTypes["BattleStatus"]>,
          WizBattleMonsterCustom<TTypes>
        >)
      const dependencies = {
        content: options.content,
        battleCharacterAdapter: battleCharacterAuthority,
        battleMonsterAdapter,
        battleContent,
        context: {
          initialVault: vault,
          initialWorldState: baseState,
        },
        environment: runtimeEnvironment,
        itemEffect: options.itemEffect,
        mechanics,
        pluginScenes,
        shopDialogueService: shopDialogues,
        abilityLearning: createWizStandardAbilityLearning(options.content),
        preset,
      } as WizRootReducerDependencies<
        TExtraState,
        TPluginActionInput,
        TPluginActionOutput,
        TTypes,
        TPluginEvent,
        TPluginReason,
        TRewardCustom,
        TMechanicsReason
      >
      const initialRootReducer = new WizRootReducer<
        TExtraState,
        TPluginActionInput,
        TPluginActionOutput,
        TTypes,
        TPluginEvent,
        TPluginReason,
        TRewardCustom,
        TMechanicsReason
      >(dependencies)
      const initialTransitionResult =
        options.initialTransition === undefined
          ? WizSceneResultFactory.accept(baseState)
          : initialRootReducer.navigate(baseState, options.initialTransition)
      if (initialTransitionResult.accepted === false) {
        throw new WizStandardConfigurationError([
          {
            code: "INITIAL_TRANSITION_REJECTED",
            path: "initialTransition",
            message: `initialTransition was rejected: ${initialTransitionResult.reason}`,
          },
        ])
      }
      const initialState = ownStandardSceneState<
        TExtraState,
        TTypes,
        TRewardCustom
      >(initialTransitionResult.state)
      const rootReducer =
        initialState === baseState
          ? initialRootReducer
          : new WizRootReducer<
              TExtraState,
              TPluginActionInput,
              TPluginActionOutput,
              TTypes,
              TPluginEvent,
              TPluginReason,
              TRewardCustom,
              TMechanicsReason
            >({
              ...dependencies,
              context: {
                initialVault: vault,
                initialWorldState: initialState,
              },
            })

      return new WizStandardSceneWorld<
        TArrays,
        TExtraState,
        TPluginActionInput,
        TPluginActionOutput,
        TTypes,
        TPluginEvent,
        TPluginReason,
        TRewardCustom,
        TMechanicsReason
      >(
        standardSceneWorldConstructionToken,
        {
          actions: createWizStandardActions(options.content, actionOrigin),
          actionOrigin,
          battleCharacterAuthority,
          battleMonsterAuthority: battleMonsterAdapter,
          battleContent,
          affinitySystem,
          content: options.content,
          environment,
          initialSnapshot: snapshot,
          initialState,
          levelUpPointsPerLevel: preset.levelUp.pointsPerLevelUp,
          resolveRecipe: (recipeId) => options.content.getRecipe(recipeId),
          pluginScenes,
          shopDialogues,
          effectConfig: preset.effect,
        },
        rootReducer
      )
    }

    return createConfigured(
      options as WizStandardSceneWorldOptions<
        WorldContentArrays,
        WizStandardPluginSceneState,
        unknown,
        WizPluginSceneAction,
        WizTypes,
        unknown,
        string,
        unknown,
        string
      >
    )
  }

  dispatch(
    state: WizStandardState<TExtraState, TTypes, TRewardCustom>,
    action: WizStandardAction<TPluginActionInput>
  ): WizWorldDispatchResult<
    WizStandardState<TExtraState, TTypes, TRewardCustom>,
    WizStandardEvent<TExtraState, TPluginActionOutput, TPluginEvent, TTypes>,
    WizStandardRejectionReason<TPluginReason, TMechanicsReason>
  > {
    const ownedState = this.stateProvenance.requireAdmitted(
      this.kernel.stateOwnership.own(state)
    )
    const ownedActionOrError = (() => {
      try {
        return standardActionOwnership.own(action)
      } catch (error) {
        return error
      }
    })()
    if (ownedActionOrError instanceof WizWorldValueOwnershipError) {
      return WizWorldDispatchResult.invalidAction<
        WizStandardState<TExtraState, TTypes, TRewardCustom>,
        WizStandardEvent<
          TExtraState,
          TPluginActionOutput,
          TPluginEvent,
          TTypes
        >,
        WizStandardRejectionReason<TPluginReason, TMechanicsReason>
      >(
        ownedState,
        action,
        [
          Object.freeze({
            kind: "ownership",
            moduleName: "standard-runtime",
            path: ownedActionOrError.path,
            reason: ownedActionOrError.reason,
            valueType: ownedActionOrError.valueType,
          }),
        ],
        this.kernel.stateOwnership
      )
    }
    if (ownedActionOrError instanceof Error) {
      throw ownedActionOrError
    }
    const ownedAction = ownedActionOrError
    const isAuthenticBuiltInAction = isWizStandardActionFromOrigin(
      ownedAction,
      this.#actionOrigin
    )
    if (
      isActionObject(ownedAction) &&
      STANDARD_RESERVED_ACTION_TYPES.has(ownedAction.type) &&
      !isAuthenticBuiltInAction
    ) {
      return WizWorldDispatchResult.rejected<
        WizStandardState<TExtraState, TTypes, TRewardCustom>,
        WizStandardEvent<
          TExtraState,
          TPluginActionOutput,
          TPluginEvent,
          TTypes
        >,
        WizStandardRejectionReason<TPluginReason, TMechanicsReason>
      >(ownedState, ownedAction, this.kernel.stateOwnership)
    }
    const pluginScenes = this.pluginScenes
    if (
      pluginScenes !== undefined &&
      pluginScenes.hasScene(ownedState.type) &&
      !isAuthenticBuiltInAction
    ) {
      const resolvedAction = pluginScenes.resolveUnknownAction(
        ownedState.type,
        ownedAction
      )
      if (resolvedAction === null) {
        return WizWorldDispatchResult.rejectedByRule<
          WizStandardState<TExtraState, TTypes, TRewardCustom>,
          WizStandardEvent<
            TExtraState,
            TPluginActionOutput,
            TPluginEvent,
            TTypes
          >,
          WizStandardRejectionReason<TPluginReason, TMechanicsReason>
        >(
          ownedState,
          ownedAction,
          "PLUGIN_ACTION_INVALID",
          this.kernel.stateOwnership
        )
      }
      const pluginDispatch = this.kernel.dispatch(ownedState, resolvedAction)
      this.stateProvenance.registerTrusted(pluginDispatch.state)

      return pluginDispatch
    }
    const admission = getStandardActionAdmission<
      TExtraState,
      TPluginActionInput,
      TPluginActionOutput,
      TTypes,
      TRewardCustom,
      TPluginEvent,
      TPluginReason
    >(ownedState, ownedAction, pluginScenes, this.#actionOrigin)
    if (!admission.accepted && admission.reason) {
      return WizWorldDispatchResult.rejectedByRule<
        WizStandardState<TExtraState, TTypes, TRewardCustom>,
        WizStandardEvent<
          TExtraState,
          TPluginActionOutput,
          TPluginEvent,
          TTypes
        >,
        WizStandardRejectionReason<TPluginReason, TMechanicsReason>
      >(ownedState, ownedAction, admission.reason, this.kernel.stateOwnership)
    }
    if (!admission.accepted) {
      return WizWorldDispatchResult.rejected<
        WizStandardState<TExtraState, TTypes, TRewardCustom>,
        WizStandardEvent<
          TExtraState,
          TPluginActionOutput,
          TPluginEvent,
          TTypes
        >,
        WizStandardRejectionReason<TPluginReason, TMechanicsReason>
      >(ownedState, ownedAction, this.kernel.stateOwnership)
    }
    if (!isAuthenticBuiltInAction) {
      return WizWorldDispatchResult.rejected<
        WizStandardState<TExtraState, TTypes, TRewardCustom>,
        WizStandardEvent<
          TExtraState,
          TPluginActionOutput,
          TPluginEvent,
          TTypes
        >,
        WizStandardRejectionReason<TPluginReason, TMechanicsReason>
      >(ownedState, ownedAction, this.kernel.stateOwnership)
    }
    const builtInDispatch = this.kernel.dispatch(ownedState, ownedAction)
    this.stateProvenance.registerTrusted(builtInDispatch.state)

    return builtInDispatch
  }

  /**
   * @internal New RPG composition root uses this nominal check to route an action
   * to the standard scene runtime without relying on a string action type.
   */
  ownsAction(action: unknown): action is WizStandardAction<TPluginActionInput> {
    try {
      const ownedAction = standardActionOwnership.own(action)
      return (
        isWizStandardActionFromOrigin(ownedAction, this.#actionOrigin) ||
        this.pluginScenes?.acceptsAnyAction(ownedAction) === true
      )
    } catch {
      return false
    }
  }

  navigate(
    state: WizStandardState<TExtraState, TTypes, TRewardCustom>,
    transition: WizSceneTransition
  ): WizSceneResult<
    WizStandardState<TExtraState, TTypes, TRewardCustom>,
    | TPluginEvent
    | WizStandardSceneChangedEvent<WizStandardSceneType<TExtraState, TTypes>>,
    WizStandardRejectionReason<TPluginReason, TMechanicsReason>
  > {
    const ownedState = this.stateProvenance.requireAdmitted(
      this.kernel.stateOwnership.own(state)
    )
    const result = this.rootReducer.navigate(ownedState, transition)
    if (result.accepted === false) {
      return result
    }
    const nextState = this.kernel.stateOwnership.own(result.state)
    this.stateProvenance.registerTrusted(nextState)

    const events: (
      | WizDeepReadonly<TPluginEvent>
      | WizStandardSceneChangedEvent<WizStandardSceneType<TExtraState, TTypes>>
    )[] = [...result.events]
    if (ownedState.type !== nextState.type) {
      events.push(
        new WizStandardSceneChangedEvent<
          WizStandardSceneType<TExtraState, TTypes>
        >(ownedState.type, nextState.type)
      )
    }

    return WizSceneResultFactory.accept<
      WizStandardState<TExtraState, TTypes, TRewardCustom>,
      readonly (
        | TPluginEvent
        | WizStandardSceneChangedEvent<
            WizStandardSceneType<TExtraState, TTypes>
          >
      )[]
    >(
      nextState as WizStandardState<TExtraState, TTypes, TRewardCustom>,
      undefined,
      events as readonly (
        | TPluginEvent
        | WizStandardSceneChangedEvent<
            WizStandardSceneType<TExtraState, TTypes>
          >
      )[]
    )
  }

  /**
   * 現在のscene stateから、静的definitionを含まない正規snapshotを生成する。
   */
  snapshot(
    state: WizStandardState<TExtraState, TTypes, TRewardCustom>
  ): WorldSnapshot<WorldContentSnapshotData<TArrays>> {
    const ownedState = this.stateProvenance.requireAdmitted(
      this.kernel.stateOwnership.own(state)
    )
    const snapshot = WorldSnapshot.fromVault(ownedState.vault)
    const validated = this.content.validateSnapshot(snapshot)
    validateStandardAffinity(validated.toPlain().npcs, this.affinitySystem)
    return validated
  }

  /**
   * vaultだけでなく現在のbuilt-in/plugin sceneも含むversioned sessionを生成する。
   */
  session<
    TPluginData extends object,
    TPluginScene extends WizStandardPluginSceneSnapshotData<TPluginData>,
    TCodecArrays extends WorldContentArrays,
    TRewardCustomInput,
  >(
    state: WizStandardState<TExtraState, TTypes, TRewardCustom>,
    codec: WizStandardSessionCodec<
      TExtraState,
      TPluginData,
      TPluginScene,
      TCodecArrays,
      TRewardCustom,
      TRewardCustomInput
    > &
      WizStandardContentRequirements<TArrays, TCodecArrays>
  ): WizStandardSessionSnapshot<
    TExtraState,
    TPluginData,
    TPluginScene,
    WorldContentSnapshotData<TArrays>,
    TRewardCustom,
    TRewardCustomInput
  > {
    return codec.capture(state, this.snapshot(state))
  }

  /**
   * sessionをJSON-safeなversion envelopeへ変換する。
   */
  save<
    TPluginData extends object,
    TPluginScene extends WizStandardPluginSceneSnapshotData<TPluginData>,
    TCodecArrays extends WorldContentArrays,
    TRewardCustomInput,
  >(
    state: WizStandardState<TExtraState, TTypes, TRewardCustom>,
    codec: WizStandardSessionCodec<
      TExtraState,
      TPluginData,
      TPluginScene,
      TCodecArrays,
      TRewardCustom,
      TRewardCustomInput
    > &
      WizStandardContentRequirements<TArrays, TCodecArrays>
  ): WizWorldSaveEnvelope<
    WizStandardSessionData<
      TPluginData,
      TPluginScene,
      WorldSnapshotCanonicalData<WorldContentSnapshotData<TArrays>>,
      TRewardCustomInput
    >
  > {
    return this.session(state, codec).toEnvelope()
  }

  /**
   * unknownのversion envelopeを検証し、保存時のsceneを復元する。
   *
   * WorldSnapshot/vault snapshotは`initialSnapshot`から受け取る。
   */
  restore<
    TPluginData extends object,
    TPluginScene extends WizStandardPluginSceneSnapshotData<TPluginData>,
    TCodecArrays extends WorldContentArrays,
    TRewardCustomInput,
  >(
    input: unknown,
    codec: WizStandardSessionCodec<
      TExtraState,
      TPluginData,
      TPluginScene,
      TCodecArrays,
      TRewardCustom,
      TRewardCustomInput
    > &
      WizStandardContentRequirements<TArrays, TCodecArrays>
  ): WizStandardState<TExtraState, TTypes, TRewardCustom> {
    const session = codec.parse(input)
    const snapshot = this.content.validateSnapshot(session.world)
    validateStandardAffinity(snapshot.toPlain().npcs, this.affinitySystem)
    const vault = overlaySnapshot(this.initialState.vault, snapshot)
    const restoredScene = restoreWizStandardSessionScene(codec, session, {
      vault,
      battleCharacterAuthority: this.battleCharacterAuthority,
      battleMonsterAuthority: this.battleMonsterAuthority,
      content: this.content,
      battleContent: this.battleContent,
      levelUpPointsPerLevel: this.levelUpPointsPerLevel,
      resolveRecipe: this.resolveRecipe,
      shopDialogues: this.shopDialogues,
      effectConfig: this.effectConfig,
    }) as WizStandardState<TExtraState, TTypes, TRewardCustom>
    const restored = this.kernel.stateOwnership.own(restoredScene)
    return this.stateProvenance.registerTrusted(restored)
  }
}

Object.freeze(WizStandardSceneWorld.prototype)
Object.freeze(WizStandardSceneWorld)
Object.freeze(WizStandardActionAppliedEvent.prototype)
Object.freeze(WizStandardActionAppliedEvent)
Object.freeze(WizStandardSceneChangedEvent.prototype)
Object.freeze(WizStandardSceneChangedEvent)
Object.freeze(WizStandardConfigurationError.prototype)
Object.freeze(WizStandardConfigurationError)
Object.freeze(WizStandardStateProvenanceError.prototype)
Object.freeze(WizStandardStateProvenanceError)
