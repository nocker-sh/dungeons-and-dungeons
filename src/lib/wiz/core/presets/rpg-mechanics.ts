import { WorldContent } from "@/lib/wiz/core/content/world-content"
import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import type { WizEngineBattleEnemyAI } from "@/lib/wiz/core/engine/battle-ai/simple-enemy-ai"
import type { WizEngineBattleContent } from "@/lib/wiz/core/engine/battle/content"
import type {
  WizEngineBattleExecutor,
  WizEngineBattleTurnOrderPolicy,
} from "@/lib/wiz/core/engine/battle/phases/turn-order"
import type { WizEngineBattleRewardCalculator } from "@/lib/wiz/core/engine/reward/default-reward-calculator"
import type { WizPartyLevelUpPort } from "@/lib/wiz/core/engine/level-up/party-level-up"
import type { WizEngineInnPort } from "@/lib/wiz/core/engine/inn"
import type { WizConversationAffinityPort } from "@/lib/wiz/core/engine/conversation/affinity-system"
import { WizRpgEquipmentRules } from "@/lib/wiz/core/rpg/equipment-rules"
import type { WizStandardInventoryEntry } from "@/lib/wiz/core/rpg/standard-inventory"
import { type WizPreset, WizPresetValue } from "@/lib/wiz/core/presets/wiz-preset"
import type { WizStandardRuntimeEnvironment } from "@/lib/wiz/core/presets/runtime-environment"
import type { WizSceneBattleRewardSettlement } from "@/lib/wiz/core/runtime/scenes/battle/reward-settlement"
import type { WizSceneExplorationReducerPort } from "@/lib/wiz/core/runtime/scenes/exploration/reducer"
import type { WizAction } from "@/lib/wiz/core/runtime/action"
import type { WizSceneResult } from "@/lib/wiz/core/runtime/scene-result"
import type {
  WizRuntimeDefeatPolicy,
  WizRuntimeVaultState,
} from "@/lib/wiz/core/runtime/services/defeat-service"
import type { WizHungerServicePort } from "@/lib/wiz/core/vault/states/player/services/wiz-hunger-service"
import type { WizStateFor } from "@/lib/wiz/core/runtime/state"
import type {
  WizBattleMonsterCustom,
  WizBattleStatusCustom,
  WizDefaultTypes,
  WizTypes,
} from "@/lib/wiz/core/types/wiz-types"

const wizRpgMechanicsConstructionToken = Symbol("WizRpgMechanics.constructor")
const authenticWizRpgMechanics = new WeakSet<object>()

const assertAuthenticWizRpgMechanics = (mechanics: object): void => {
  if (!authenticWizRpgMechanics.has(mechanics)) {
    throw new TypeError("WizRpgMechanics instance was not created by define()")
  }
}

type WizRpgMechanicsBattleStatus<TTypes extends WizTypes> = WizBattleStatusCustom<
  TTypes["BattleStatus"]
>
type WizRpgMechanicsBattleMonsterCustom<TTypes extends WizTypes> = WizBattleMonsterCustom<TTypes>

/**
 * 組み込みactionを標準reducerより先に処理する純粋port。
 *
 * `null`は標準処理へ委譲することを表す。resultを返したactionだけを差し替える。
 */
export type WizRpgStandardActionReducerPort<
  TTypes extends WizTypes = WizDefaultTypes,
  TRewardCustom = undefined,
  TReason extends string = never,
> = Readonly<{
  reduce: (
    state: WizStateFor<TTypes, TRewardCustom>,
    action: WizAction,
  ) => WizSceneResult<WizStateFor<TTypes, TRewardCustom>, never, TReason> | null
}>

export type WizRpgMechanicsFactoryContext<
  TTypes extends WizTypes = WizDefaultTypes,
  TArrays extends WorldContentArrays = WorldContentArrays,
> = Readonly<{
  readonly preset: WizPresetValue<TTypes>
  readonly content: WorldContent<TArrays>
  readonly battleContent: WizEngineBattleContent
  readonly environment: WizStandardRuntimeEnvironment
}>

/** @internal */
export type WizRpgMechanicsContext<
  TTypes extends WizTypes = WizDefaultTypes,
  TArrays extends WorldContentArrays = WorldContentArrays,
> = Readonly<{
  readonly preset: WizPreset<TTypes>
  readonly content: WorldContent<TArrays>
  readonly battleContent: WizEngineBattleContent
  readonly environment: WizStandardRuntimeEnvironment
}>

type WizRpgMechanicsBaseDefinition<
  TTypes extends WizTypes,
  TRewardCustom,
  TArrays extends WorldContentArrays,
  TMechanicsReason extends string,
> = Readonly<{
  readonly battleExecutor?: (
    context: WizRpgMechanicsFactoryContext<TTypes, TArrays>,
  ) => WizEngineBattleExecutor<
    WizRpgMechanicsBattleStatus<TTypes>,
    WizRpgMechanicsBattleMonsterCustom<TTypes>,
    TMechanicsReason
  >
  readonly turnOrderPolicy?: (
    context: WizRpgMechanicsFactoryContext<TTypes, TArrays>,
  ) => WizEngineBattleTurnOrderPolicy<
    WizRpgMechanicsBattleStatus<TTypes>,
    WizRpgMechanicsBattleMonsterCustom<TTypes>
  >
  readonly enemyAI?: (
    context: WizRpgMechanicsFactoryContext<TTypes, TArrays>,
  ) => WizEngineBattleEnemyAI<
    WizRpgMechanicsBattleStatus<TTypes>,
    WizRpgMechanicsBattleMonsterCustom<TTypes>
  >
  readonly explorationReducer?: (
    context: WizRpgMechanicsFactoryContext<TTypes, TArrays>,
  ) => WizSceneExplorationReducerPort<TMechanicsReason>
  readonly defeatPolicy?: (
    context: WizRpgMechanicsFactoryContext<TTypes, TArrays>,
  ) => WizRuntimeDefeatPolicy
  readonly hungerService?: (
    context: WizRpgMechanicsFactoryContext<TTypes, TArrays>,
  ) => WizHungerServicePort
  readonly affinitySystem?: (
    context: WizRpgMechanicsFactoryContext<TTypes, TArrays>,
  ) => WizConversationAffinityPort
  readonly innService?: (
    context: WizRpgMechanicsFactoryContext<TTypes, TArrays>,
  ) => WizEngineInnPort
  readonly standardActionReducer?: (
    context: WizRpgMechanicsFactoryContext<TTypes, TArrays>,
  ) => WizRpgStandardActionReducerPort<TTypes, TRewardCustom, TMechanicsReason>
  readonly equipmentRules?: (
    context: WizRpgMechanicsFactoryContext<TTypes, TArrays>,
  ) => WizRpgEquipmentRules<WizStandardInventoryEntry, TMechanicsReason>
  readonly partyLevelUp?: (
    context: WizRpgMechanicsFactoryContext<TTypes, TArrays>,
  ) => WizPartyLevelUpPort
}>

type WizRpgMechanicsRewardDefinition<
  TTypes extends WizTypes,
  TRewardCustom,
  TArrays extends WorldContentArrays,
  TMechanicsReason extends string,
> = [TRewardCustom] extends [undefined]
  ?
      | WizRpgMechanicsWithoutRewardDefinition
      | WizRpgMechanicsWithRewardDefinition<TTypes, TRewardCustom, TArrays, TMechanicsReason>
  : WizRpgMechanicsWithRewardDefinition<TTypes, TRewardCustom, TArrays, TMechanicsReason>

type WizRpgMechanicsWithoutRewardDefinition = Readonly<{
  readonly rewardCalculator?: undefined
  readonly rewardSettlement?: undefined
}>

type WizRpgMechanicsWithRewardDefinition<
  TTypes extends WizTypes,
  TRewardCustom,
  TArrays extends WorldContentArrays,
  TMechanicsReason extends string,
> = Readonly<{
  readonly rewardCalculator: (
    context: WizRpgMechanicsFactoryContext<TTypes, TArrays>,
  ) => WizEngineBattleRewardCalculator<
    WizRpgMechanicsBattleStatus<TTypes>,
    WizRpgMechanicsBattleMonsterCustom<TTypes>,
    TRewardCustom
  >
  readonly rewardSettlement?: (
    context: WizRpgMechanicsFactoryContext<TTypes, TArrays>,
  ) => WizSceneBattleRewardSettlement<
    WizRpgMechanicsBattleStatus<TTypes>,
    WizRpgMechanicsBattleMonsterCustom<TTypes>,
    NoInfer<TRewardCustom>,
    TMechanicsReason
  >
}>

export type WizRpgMechanicsDefinition<
  TTypes extends WizTypes = WizDefaultTypes,
  TRewardCustom = undefined,
  TArrays extends WorldContentArrays = WorldContentArrays,
  TMechanicsReason extends string = never,
> = WizRpgMechanicsBaseDefinition<TTypes, TRewardCustom, TArrays, TMechanicsReason> &
  WizRpgMechanicsRewardDefinition<TTypes, TRewardCustom, TArrays, TMechanicsReason>

export type WizRpgMechanicsPatchDefinition<
  TTypes extends WizTypes = WizDefaultTypes,
  TRewardCustom = undefined,
  TArrays extends WorldContentArrays = WorldContentArrays,
  TMechanicsReason extends string = never,
> = WizRpgMechanicsBaseDefinition<TTypes, TRewardCustom, TArrays, TMechanicsReason> &
  Readonly<{
    readonly rewardCalculator?: (
      context: WizRpgMechanicsFactoryContext<TTypes, TArrays>,
    ) => WizEngineBattleRewardCalculator<
      WizRpgMechanicsBattleStatus<TTypes>,
      WizRpgMechanicsBattleMonsterCustom<TTypes>,
      TRewardCustom
    >
    readonly rewardSettlement?: (
      context: WizRpgMechanicsFactoryContext<TTypes, TArrays>,
    ) => WizSceneBattleRewardSettlement<
      WizRpgMechanicsBattleStatus<TTypes>,
      WizRpgMechanicsBattleMonsterCustom<TTypes>,
      TRewardCustom,
      TMechanicsReason
    >
  }>

type WizRpgMechanicsStoredDefinition<
  TTypes extends WizTypes,
  TRewardCustom,
  TArrays extends WorldContentArrays,
  TMechanicsReason extends string,
> = WizRpgMechanicsBaseDefinition<TTypes, TRewardCustom, TArrays, TMechanicsReason> &
  Readonly<{
    readonly rewardCalculator?: (
      context: WizRpgMechanicsFactoryContext<TTypes, TArrays>,
    ) => WizEngineBattleRewardCalculator<
      WizRpgMechanicsBattleStatus<TTypes>,
      WizRpgMechanicsBattleMonsterCustom<TTypes>,
      TRewardCustom
    >
    readonly rewardSettlement?: (
      context: WizRpgMechanicsFactoryContext<TTypes, TArrays>,
    ) => WizSceneBattleRewardSettlement<
      WizRpgMechanicsBattleStatus<TTypes>,
      WizRpgMechanicsBattleMonsterCustom<TTypes>,
      TRewardCustom,
      TMechanicsReason
    >
  }>

type WizRpgMechanicsBaseResolution<
  TTypes extends WizTypes,
  TRewardCustom,
  TMechanicsReason extends string,
> = Readonly<{
  readonly battleExecutor?: WizEngineBattleExecutor<
    WizRpgMechanicsBattleStatus<TTypes>,
    WizRpgMechanicsBattleMonsterCustom<TTypes>,
    TMechanicsReason
  >
  readonly turnOrderPolicy?: WizEngineBattleTurnOrderPolicy<
    WizRpgMechanicsBattleStatus<TTypes>,
    WizRpgMechanicsBattleMonsterCustom<TTypes>
  >
  readonly enemyAI?: WizEngineBattleEnemyAI<
    WizRpgMechanicsBattleStatus<TTypes>,
    WizRpgMechanicsBattleMonsterCustom<TTypes>
  >
  readonly explorationReducer?: WizSceneExplorationReducerPort<TMechanicsReason>
  readonly defeatPolicy?: WizRuntimeDefeatPolicy
  readonly hungerService?: WizHungerServicePort
  readonly affinitySystem?: WizConversationAffinityPort
  readonly innService?: WizEngineInnPort
  readonly standardActionReducer?: WizRpgStandardActionReducerPort<
    TTypes,
    TRewardCustom,
    TMechanicsReason
  >
  readonly equipmentRules?: WizRpgEquipmentRules<WizStandardInventoryEntry, TMechanicsReason>
  readonly partyLevelUp?: WizPartyLevelUpPort
}>

type WizRpgMechanicsRewardResolution<
  TTypes extends WizTypes,
  TRewardCustom,
  TMechanicsReason extends string,
> = [TRewardCustom] extends [undefined]
  ?
      | Readonly<{
          readonly rewardCalculator: undefined
          readonly rewardSettlement: undefined
        }>
      | Readonly<{
          readonly rewardCalculator: WizEngineBattleRewardCalculator<
            WizRpgMechanicsBattleStatus<TTypes>,
            WizRpgMechanicsBattleMonsterCustom<TTypes>,
            TRewardCustom
          >
          readonly rewardSettlement?: WizSceneBattleRewardSettlement<
            WizRpgMechanicsBattleStatus<TTypes>,
            WizRpgMechanicsBattleMonsterCustom<TTypes>,
            TRewardCustom,
            TMechanicsReason
          >
        }>
  : Readonly<{
      readonly rewardCalculator: WizEngineBattleRewardCalculator<
        WizRpgMechanicsBattleStatus<TTypes>,
        WizRpgMechanicsBattleMonsterCustom<TTypes>,
        TRewardCustom
      >
      readonly rewardSettlement?: WizSceneBattleRewardSettlement<
        WizRpgMechanicsBattleStatus<TTypes>,
        WizRpgMechanicsBattleMonsterCustom<TTypes>,
        TRewardCustom,
        TMechanicsReason
      >
    }>

export type WizRpgMechanicsResolution<
  TTypes extends WizTypes = WizDefaultTypes,
  TRewardCustom = undefined,
  TMechanicsReason extends string = never,
> = WizRpgMechanicsBaseResolution<TTypes, TRewardCustom, TMechanicsReason> &
  WizRpgMechanicsRewardResolution<TTypes, TRewardCustom, TMechanicsReason>

const captureFactory = <TContext, TPort>(
  name: string,
  factory: ((context: TContext) => TPort) | undefined,
): ((context: TContext) => TPort) | undefined => {
  if (factory === undefined) return undefined
  if (typeof factory !== "function") {
    throw new TypeError(`WizRpgMechanics ${name} factory must be a function`)
  }
  return Object.freeze(factory.bind(undefined))
}

const captureBattleExecutor = <TStatus, TCustom, TReason extends string>(
  executor: WizEngineBattleExecutor<TStatus, TCustom, TReason>,
): WizEngineBattleExecutor<TStatus, TCustom, TReason> => {
  if (typeof executor !== "object" || executor === null || typeof executor.execute !== "function") {
    throw new TypeError("WizRpgMechanics battleExecutor factory returned an invalid port")
  }
  return Object.freeze({
    execute: Object.freeze(executor.execute.bind(executor)),
  })
}

const captureTurnOrderPolicy = <TStatus, TCustom>(
  policy: WizEngineBattleTurnOrderPolicy<TStatus, TCustom>,
): WizEngineBattleTurnOrderPolicy<TStatus, TCustom> => {
  if (typeof policy !== "object" || policy === null || typeof policy.order !== "function") {
    throw new TypeError("WizRpgMechanics turnOrderPolicy factory returned an invalid port")
  }
  return Object.freeze({
    order: Object.freeze(policy.order.bind(policy)),
  })
}

const captureEnemyAI = <TStatus, TCustom>(
  enemyAI: WizEngineBattleEnemyAI<TStatus, TCustom>,
): WizEngineBattleEnemyAI<TStatus, TCustom> => {
  if (
    typeof enemyAI !== "object" ||
    enemyAI === null ||
    typeof enemyAI.selectAction !== "function"
  ) {
    throw new TypeError("WizRpgMechanics enemyAI factory returned an invalid port")
  }
  return Object.freeze({
    selectAction: Object.freeze(enemyAI.selectAction.bind(enemyAI)),
  })
}

const captureRewardCalculator = <TStatus, TCustom, TRewardCustom>(
  calculator: WizEngineBattleRewardCalculator<TStatus, TCustom, TRewardCustom>,
): WizEngineBattleRewardCalculator<TStatus, TCustom, TRewardCustom> => {
  if (
    typeof calculator !== "object" ||
    calculator === null ||
    typeof calculator.calculate !== "function"
  ) {
    throw new TypeError("WizRpgMechanics rewardCalculator factory returned an invalid port")
  }
  return Object.freeze({
    calculate: Object.freeze(calculator.calculate.bind(calculator)),
  })
}

const captureRewardSettlement = <TStatus, TCustom, TRewardCustom, TReason extends string>(
  settlement: WizSceneBattleRewardSettlement<TStatus, TCustom, TRewardCustom, TReason>,
): WizSceneBattleRewardSettlement<TStatus, TCustom, TRewardCustom, TReason> => {
  if (
    typeof settlement !== "object" ||
    settlement === null ||
    typeof settlement.settle !== "function"
  ) {
    throw new TypeError("WizRpgMechanics rewardSettlement factory returned an invalid port")
  }
  return Object.freeze({
    settle: Object.freeze(settlement.settle.bind(settlement)),
  })
}

const captureExplorationReducer = <TReason extends string>(
  reducer: WizSceneExplorationReducerPort<TReason>,
): WizSceneExplorationReducerPort<TReason> => {
  if (typeof reducer !== "object" || reducer === null || typeof reducer.reduce !== "function") {
    throw new TypeError("WizRpgMechanics explorationReducer factory returned an invalid port")
  }
  return Object.freeze({
    reduce: Object.freeze(reducer.reduce.bind(reducer)),
  })
}

const captureDefeatPolicy = (policy: WizRuntimeDefeatPolicy): WizRuntimeDefeatPolicy => {
  if (typeof policy !== "object" || policy === null || typeof policy.check !== "function") {
    throw new TypeError("WizRpgMechanics defeatPolicy factory returned an invalid port")
  }
  const check = Object.freeze(policy.check.bind(policy))
  return Object.freeze({
    check: Object.freeze(<TState extends WizRuntimeVaultState<TState>>(state: TState) => {
      const result: unknown = check(state)
      const defeated =
        typeof result === "object" && result !== null && "defeated" in result
          ? result.defeated
          : undefined
      if (
        typeof result !== "object" ||
        result === null ||
        !("state" in result) ||
        (defeated !== undefined && typeof defeated !== "boolean")
      ) {
        throw new TypeError(
          "WizRpgMechanics defeatPolicy check must return state and an optional boolean defeated",
        )
      }
      return Object.freeze({
        defeated,
        state: result.state as TState,
      })
    }),
  })
}

const captureHungerService = (service: WizHungerServicePort): WizHungerServicePort => {
  if (
    typeof service !== "object" ||
    service === null ||
    typeof service.getHungerState !== "function" ||
    typeof service.getHungerImpact !== "function"
  ) {
    throw new TypeError("WizRpgMechanics hungerService factory returned an invalid port")
  }
  return Object.freeze({
    getHungerState: Object.freeze(service.getHungerState.bind(service)),
    getHungerImpact: Object.freeze(service.getHungerImpact.bind(service)),
  })
}

const captureAffinitySystem = (
  system: WizConversationAffinityPort,
): WizConversationAffinityPort => {
  if (
    typeof system !== "object" ||
    system === null ||
    typeof system.acceptsAffinity !== "function" ||
    typeof system.changeAffinity !== "function" ||
    typeof system.getAffinityLevel !== "function" ||
    typeof system.getProgressToNextLevel !== "function" ||
    typeof system.getGiftAffinityChange !== "function" ||
    typeof system.resolveGift !== "function"
  ) {
    throw new TypeError("WizRpgMechanics affinitySystem factory returned an invalid port")
  }
  return Object.freeze({
    acceptsAffinity: Object.freeze(system.acceptsAffinity.bind(system)),
    changeAffinity: Object.freeze(system.changeAffinity.bind(system)),
    getAffinityLevel: Object.freeze(system.getAffinityLevel.bind(system)),
    getProgressToNextLevel: Object.freeze(system.getProgressToNextLevel.bind(system)),
    getGiftAffinityChange: Object.freeze(system.getGiftAffinityChange.bind(system)),
    resolveGift: Object.freeze(system.resolveGift.bind(system)),
  })
}

const captureInnService = (service: WizEngineInnPort): WizEngineInnPort => {
  if (
    typeof service !== "object" ||
    service === null ||
    typeof service.evaluateStay !== "function" ||
    typeof service.stay !== "function"
  ) {
    throw new TypeError("WizRpgMechanics innService factory returned an invalid port")
  }
  return Object.freeze({
    evaluateStay: Object.freeze(service.evaluateStay.bind(service)),
    stay: Object.freeze(service.stay.bind(service)),
  })
}

const captureStandardActionReducer = <
  TTypes extends WizTypes,
  TRewardCustom,
  TReason extends string,
>(
  reducer: WizRpgStandardActionReducerPort<TTypes, TRewardCustom, TReason>,
): WizRpgStandardActionReducerPort<TTypes, TRewardCustom, TReason> => {
  if (typeof reducer !== "object" || reducer === null || typeof reducer.reduce !== "function") {
    throw new TypeError("WizRpgMechanics standardActionReducer factory returned an invalid port")
  }
  return Object.freeze({
    reduce: Object.freeze(reducer.reduce.bind(reducer)),
  })
}

const captureEquipmentRules = <TReason extends string>(
  rules: WizRpgEquipmentRules<WizStandardInventoryEntry, TReason>,
): WizRpgEquipmentRules<WizStandardInventoryEntry, TReason> => {
  WizRpgEquipmentRules.require(rules, "WizRpgMechanics equipmentRules factory result")
  return rules
}

const capturePartyLevelUp = (partyLevelUp: WizPartyLevelUpPort): WizPartyLevelUpPort => {
  if (
    typeof partyLevelUp !== "object" ||
    partyLevelUp === null ||
    typeof partyLevelUp.applyPartyLevelUp !== "function"
  ) {
    throw new TypeError("WizRpgMechanics partyLevelUp factory returned an invalid port")
  }
  return Object.freeze({
    applyPartyLevelUp: Object.freeze(partyLevelUp.applyPartyLevelUp.bind(partyLevelUp)),
  })
}

/**
 * 標準RPG featureの差し替え可能なmechanics factoryを保持するimmutable definition。
 *
 * factoryは信頼済みの純粋依存として扱い、resolve時に返されたportのmethodを捕捉する。
 */
export class WizRpgMechanics<
  TTypes extends WizTypes = WizDefaultTypes,
  TRewardCustom = undefined,
  TArrays extends WorldContentArrays = WorldContentArrays,
  TMechanicsReason extends string = never,
> {
  readonly #definition: WizRpgMechanicsStoredDefinition<
    TTypes,
    TRewardCustom,
    TArrays,
    TMechanicsReason
  >

  private constructor(
    token: typeof wizRpgMechanicsConstructionToken,
    definition: WizRpgMechanicsStoredDefinition<TTypes, TRewardCustom, TArrays, TMechanicsReason>,
  ) {
    if (token !== wizRpgMechanicsConstructionToken) {
      throw new TypeError("WizRpgMechanics must be created with WizRpgMechanics.define()")
    }
    const rewardCalculator = definition.rewardCalculator
    const rewardSettlement = definition.rewardSettlement
    if (rewardCalculator === undefined && rewardSettlement !== undefined) {
      throw new TypeError("WizRpgMechanics reward settlement requires a reward calculator")
    }
    const baseDefinition = {
      battleExecutor: captureFactory("battleExecutor", definition.battleExecutor),
      turnOrderPolicy: captureFactory("turnOrderPolicy", definition.turnOrderPolicy),
      enemyAI: captureFactory("enemyAI", definition.enemyAI),
      explorationReducer: captureFactory("explorationReducer", definition.explorationReducer),
      defeatPolicy: captureFactory("defeatPolicy", definition.defeatPolicy),
      hungerService: captureFactory("hungerService", definition.hungerService),
      affinitySystem: captureFactory("affinitySystem", definition.affinitySystem),
      innService: captureFactory("innService", definition.innService),
      standardActionReducer: captureFactory(
        "standardActionReducer",
        definition.standardActionReducer,
      ),
      equipmentRules: captureFactory("equipmentRules", definition.equipmentRules),
      partyLevelUp: captureFactory("partyLevelUp", definition.partyLevelUp),
    }
    this.#definition =
      rewardCalculator === undefined
        ? Object.freeze({
            ...baseDefinition,
            rewardCalculator: undefined,
            rewardSettlement: undefined,
          })
        : Object.freeze({
            ...baseDefinition,
            rewardCalculator: captureFactory("rewardCalculator", rewardCalculator),
            rewardSettlement: captureFactory("rewardSettlement", rewardSettlement),
          })
    authenticWizRpgMechanics.add(this)
    Object.freeze(this)
  }

  static define<
    TTypes extends WizTypes = WizDefaultTypes,
    TRewardCustom = undefined,
    TArrays extends WorldContentArrays = WorldContentArrays,
    const TMechanicsReason extends string = never,
  >(
    ...args: [TRewardCustom] extends [undefined]
      ? [
          definition?: WizRpgMechanicsDefinition<TTypes, TRewardCustom, TArrays, TMechanicsReason> &
            (string extends TMechanicsReason ? never : unknown),
        ]
      : [
          definition: WizRpgMechanicsDefinition<TTypes, TRewardCustom, TArrays, TMechanicsReason> &
            (string extends TMechanicsReason ? never : unknown),
        ]
  ): WizRpgMechanics<TTypes, TRewardCustom, TArrays, TMechanicsReason> {
    return new WizRpgMechanics(wizRpgMechanicsConstructionToken, args[0] ?? {})
  }

  static defineForContent<const TArrays extends WorldContentArrays>(
    _content: WorldContent<TArrays>,
  ): WizRpgMechanics<WizDefaultTypes, undefined, TArrays, never>
  static defineForContent<
    const TArrays extends WorldContentArrays,
    TRewardCustom,
    TTypes extends WizTypes = WizDefaultTypes,
    const TMechanicsReason extends string = never,
  >(
    _content: WorldContent<TArrays>,
    definition: WizRpgMechanicsBaseDefinition<TTypes, TRewardCustom, TArrays, TMechanicsReason> &
      WizRpgMechanicsWithRewardDefinition<TTypes, TRewardCustom, TArrays, TMechanicsReason> &
      (string extends TMechanicsReason ? never : unknown),
  ): WizRpgMechanics<TTypes, TRewardCustom, TArrays, TMechanicsReason>
  static defineForContent<
    const TArrays extends WorldContentArrays,
    TTypes extends WizTypes = WizDefaultTypes,
    const TMechanicsReason extends string = never,
  >(
    _content: WorldContent<TArrays>,
    definition: WizRpgMechanicsBaseDefinition<TTypes, undefined, TArrays, TMechanicsReason> &
      WizRpgMechanicsWithoutRewardDefinition &
      (string extends TMechanicsReason ? never : unknown),
  ): WizRpgMechanics<TTypes, undefined, TArrays, TMechanicsReason>
  static defineForContent<
    const TArrays extends WorldContentArrays,
    TTypes extends WizTypes = WizDefaultTypes,
    TRewardCustom = undefined,
    TMechanicsReason extends string = never,
  >(
    _content: WorldContent<TArrays>,
    definition: WizRpgMechanicsStoredDefinition<
      TTypes,
      TRewardCustom,
      TArrays,
      TMechanicsReason
    > = {},
  ): WizRpgMechanics<TTypes, TRewardCustom, TArrays, TMechanicsReason> {
    WorldContent.require(_content, "RPG mechanics content")
    return new WizRpgMechanics(wizRpgMechanicsConstructionToken, definition)
  }

  /** @internal standard world composition boundary only. */
  static require(value: unknown, label: string): void {
    if (typeof value !== "object" || value === null || !authenticWizRpgMechanics.has(value)) {
      throw new TypeError(
        `${label} must be created with WizRpgMechanics.define() or defineForContent()`,
      )
    }
  }

  with<const TPatchReason extends string = never>(
    definition: WizRpgMechanicsPatchDefinition<TTypes, TRewardCustom, TArrays, TPatchReason> &
      (string extends TPatchReason ? never : unknown),
  ): WizRpgMechanics<TTypes, TRewardCustom, TArrays, TMechanicsReason | TPatchReason> {
    assertAuthenticWizRpgMechanics(this)
    const baseDefinition = {
      ...this.#definition,
      ...definition,
    }
    if (
      Object.hasOwn(definition, "rewardCalculator") &&
      definition.rewardCalculator === undefined
    ) {
      throw new TypeError("WizRpgMechanics.with() cannot remove a reward calculator")
    }
    const rewardCalculator = definition.rewardCalculator ?? this.#definition.rewardCalculator
    const rewardSettlement = Object.hasOwn(definition, "rewardSettlement")
      ? definition.rewardSettlement
      : this.#definition.rewardSettlement
    if (rewardCalculator === undefined && rewardSettlement !== undefined) {
      throw new TypeError("WizRpgMechanics reward settlement requires a reward calculator")
    }
    return new WizRpgMechanics(wizRpgMechanicsConstructionToken, {
      ...baseDefinition,
      rewardCalculator,
      rewardSettlement,
    })
  }

  /** @internal standard world composition only. */
  resolve(
    context: WizRpgMechanicsContext<TTypes, TArrays>,
  ): WizRpgMechanicsResolution<TTypes, TRewardCustom, TMechanicsReason>
  resolve(context: WizRpgMechanicsContext<TTypes, TArrays>): WizRpgMechanicsBaseResolution<
    TTypes,
    TRewardCustom,
    TMechanicsReason
  > &
    Readonly<{
      readonly rewardCalculator?: WizEngineBattleRewardCalculator<
        WizRpgMechanicsBattleStatus<TTypes>,
        WizRpgMechanicsBattleMonsterCustom<TTypes>,
        TRewardCustom
      >
      readonly rewardSettlement?: WizSceneBattleRewardSettlement<
        WizRpgMechanicsBattleStatus<TTypes>,
        WizRpgMechanicsBattleMonsterCustom<TTypes>,
        TRewardCustom,
        TMechanicsReason
      >
    }> {
    assertAuthenticWizRpgMechanics(this)
    const factoryContext = Object.freeze({
      preset: WizPresetValue.from(context.preset),
      content: context.content,
      battleContent: context.battleContent,
      environment: context.environment,
    }) satisfies WizRpgMechanicsFactoryContext<TTypes, TArrays>

    const battleExecutor = this.#definition.battleExecutor?.(factoryContext)
    const turnOrderPolicy = this.#definition.turnOrderPolicy?.(factoryContext)
    const enemyAI = this.#definition.enemyAI?.(factoryContext)
    const explorationReducer = this.#definition.explorationReducer?.(factoryContext)
    const defeatPolicy = this.#definition.defeatPolicy?.(factoryContext)
    const hungerService = this.#definition.hungerService?.(factoryContext)
    const affinitySystem = this.#definition.affinitySystem?.(factoryContext)
    const innService = this.#definition.innService?.(factoryContext)
    const standardActionReducer = this.#definition.standardActionReducer?.(factoryContext)
    const equipmentRules = this.#definition.equipmentRules?.(factoryContext)
    const partyLevelUp = this.#definition.partyLevelUp?.(factoryContext)
    const baseResolution = {
      battleExecutor:
        battleExecutor === undefined ? undefined : captureBattleExecutor(battleExecutor),
      turnOrderPolicy:
        turnOrderPolicy === undefined ? undefined : captureTurnOrderPolicy(turnOrderPolicy),
      enemyAI: enemyAI === undefined ? undefined : captureEnemyAI(enemyAI),
      explorationReducer:
        explorationReducer === undefined
          ? undefined
          : captureExplorationReducer(explorationReducer),
      defeatPolicy: defeatPolicy === undefined ? undefined : captureDefeatPolicy(defeatPolicy),
      hungerService: hungerService === undefined ? undefined : captureHungerService(hungerService),
      affinitySystem:
        affinitySystem === undefined ? undefined : captureAffinitySystem(affinitySystem),
      innService: innService === undefined ? undefined : captureInnService(innService),
      standardActionReducer:
        standardActionReducer === undefined
          ? undefined
          : captureStandardActionReducer(standardActionReducer),
      equipmentRules:
        equipmentRules === undefined ? undefined : captureEquipmentRules(equipmentRules),
      partyLevelUp: partyLevelUp === undefined ? undefined : capturePartyLevelUp(partyLevelUp),
    }
    if (this.#definition.rewardCalculator === undefined) {
      return Object.freeze({
        ...baseResolution,
        rewardCalculator: undefined,
        rewardSettlement: undefined,
      })
    }
    const rewardCalculator = this.#definition.rewardCalculator(factoryContext)
    const rewardSettlement = this.#definition.rewardSettlement?.(factoryContext)
    return Object.freeze({
      ...baseResolution,
      rewardCalculator: captureRewardCalculator(rewardCalculator),
      rewardSettlement:
        rewardSettlement === undefined ? undefined : captureRewardSettlement(rewardSettlement),
    })
  }
}

Object.freeze(WizRpgMechanics.prototype)
Object.freeze(WizRpgMechanics)
