import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import {
  WizRpgCommands,
  WizRpgFeatureAction,
  type WizRpgFeatureCommands,
  type WizRpgFeatureCommandSurface,
} from "@/lib/wiz/core/rpg/commands"
import { WizRpgCompositionManifest } from "@/lib/wiz/core/rpg/composition-manifest"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import { WizRpgAffordance, WizRpgFeature } from "@/lib/wiz/core/rpg/feature"
import { WizRpgPolicy } from "@/lib/wiz/core/rpg/policy"
import { WizRpgSceneRuntime } from "@/lib/wiz/core/rpg/scene-runtime"
import { WizRpgWorldIdentity } from "@/lib/wiz/core/rpg/world-identity"
import {
  type WizRpgFeatureStates,
  WizRpgWorldState,
} from "@/lib/wiz/core/rpg/world-state"
import {
  WizWorldSaveCodec,
  type WizWorldSaveEnvelope,
} from "@/lib/wiz/core/save/world-save-codec"
import type {
  WizStandardSchemaDefinition,
  WizStandardSchemaIssue,
} from "@/lib/wiz/core/standard-schema"
import type { WizWorldDispatchError } from "@/lib/wiz/core/world/world"

const rpgWorldConstructionToken = Symbol("WizRpgWorld.constructor")
const rpgEventRecordConstructionToken = Symbol("WizRpgEventRecord.constructor")
const rpgWorldOwnership = new WizObjectService()
const WIZ_RPG_WORLD_SCHEMA_VERSION = 1
const MAXIMUM_FEATURE_REACTION_STEPS = 1_024

type WizRpgCompositionPhase = "features" | "policies"

type AnyFeature = WizRpgFeature<
  unknown,
  WizRpgFeatureStates,
  string,
  unknown,
  unknown,
  unknown,
  unknown,
  unknown,
  string,
  object,
  object,
  unknown
>

type AnyPolicy = WizRpgPolicy<
  WizRpgWorldState<unknown, WizRpgFeatureStates>,
  unknown,
  string
>

type WizRpgActionResolution<TSceneAction = unknown> =
  | Readonly<{
      accepted: true
      action: WizDeepReadonly<TSceneAction>
      kind: "scene"
    }>
  | Readonly<{
      accepted: true
      action: unknown
      feature: AnyFeature
      kind: "feature"
      payload: unknown
    }>
  | Readonly<{
      accepted: false
      error:
        | Readonly<{
            actionType: string
            code: "FEATURE_ACTION_INVALID"
            featureKey: string
          }>
        | Readonly<{
            actionType: string
            code: "UNHANDLED_ACTION"
          }>
    }>

type WizRpgWorldSnapshot = Readonly<{
  scene: object
  features: Readonly<Record<string, object>>
}>

export type WizRpgDispatchError<TReason extends string> =
  | WizWorldDispatchError<TReason>
  | Readonly<{
      code: "FEATURE_REJECTED"
      featureKey: string
      reason: TReason
    }>
  | Readonly<{
      actionType: string
      code: "FEATURE_ACTION_INVALID"
      featureKey: string
    }>
  | Readonly<{
      code: "POLICY_REJECTED"
      policyName: string
      reason: TReason
    }>
  | Readonly<{
      code: "FEATURE_REACTION_LIMIT_EXCEEDED"
      featureKey: string
      causedBy: number
      maximumReactionSteps: number
    }>
  | Readonly<{
      code: "FEATURE_REACTION_REJECTED"
      featureKey: string
      causedBy: number
      reason: TReason
    }>

export type WizRpgEventSource =
  | Readonly<{ kind: "scene" }>
  | Readonly<{ featureKey: string; kind: "feature" }>

/** dispatch内で発生したeventの出自と因果関係を保持する不変record。 */
export class WizRpgEventRecord<TEvent> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly event: WizDeepReadonly<TEvent>
  readonly source: WizRpgEventSource
  readonly causedBy: number | null

  private constructor(
    token: symbol,
    event: TEvent | WizDeepReadonly<TEvent>,
    source: WizRpgEventSource,
    causedBy: number | null
  ) {
    if (token !== rpgEventRecordConstructionToken) {
      throw new TypeError(
        "WizRpgEventRecord must be created with scene() or feature()"
      )
    }
    if (
      causedBy !== null &&
      (!Number.isSafeInteger(causedBy) || causedBy < 0)
    ) {
      throw new RangeError(
        "RPG event causedBy must be a non-negative safe integer or null"
      )
    }
    this.event = rpgWorldOwnership.ownImmutable<TEvent>(event)
    this.source = rpgWorldOwnership.ownImmutable(source)
    this.causedBy = causedBy
    WizImmutableValue.freeze(this)
  }

  static scene<TEvent>(event: TEvent): WizRpgEventRecord<TEvent> {
    return new WizRpgEventRecord(
      rpgEventRecordConstructionToken,
      event,
      { kind: "scene" },
      null
    )
  }

  static feature<TEvent>(
    featureKey: string,
    event: TEvent,
    causedBy: number | null = null
  ): WizRpgEventRecord<TEvent> {
    if (featureKey.trim().length === 0 || featureKey !== featureKey.trim()) {
      throw new RangeError(
        "RPG event feature key must be a non-blank string without surrounding whitespace"
      )
    }
    return new WizRpgEventRecord(
      rpgEventRecordConstructionToken,
      event,
      { featureKey, kind: "feature" },
      causedBy
    )
  }
}

export class WizRpgDispatchResult<TState, TEvent, TReason extends string> {
  readonly accepted: boolean
  readonly state: WizDeepReadonly<TState>
  readonly events: readonly WizDeepReadonly<TEvent>[]
  readonly eventRecords: readonly WizRpgEventRecord<TEvent>[]
  readonly error: WizDeepReadonly<WizRpgDispatchError<TReason>> | undefined

  private constructor(definition: {
    accepted: boolean
    state: TState | WizDeepReadonly<TState>
    eventRecords?: readonly WizRpgEventRecord<TEvent>[]
    error?: WizRpgDispatchError<TReason>
  }) {
    this.accepted = definition.accepted
    this.state = rpgWorldOwnership.ownImmutable<TState>(definition.state)
    this.eventRecords = rpgWorldOwnership.ownImmutable<
      readonly WizRpgEventRecord<TEvent>[]
    >(definition.eventRecords ?? [])
    this.events = Object.freeze(this.eventRecords.map((record) => record.event))
    this.error = definition.error
      ? rpgWorldOwnership.ownImmutable<WizRpgDispatchError<TReason>>(
          definition.error
        )
      : undefined
    Object.freeze(this)
  }

  isAccepted(): this is this & Readonly<{ accepted: true; error: undefined }> {
    return this.accepted
  }

  isRejected(): this is this &
    Readonly<{
      accepted: false
      error: WizDeepReadonly<WizRpgDispatchError<TReason>>
    }> {
    return !this.accepted
  }

  static accepted<TState, TEvent, TReason extends string>(
    state: TState | WizDeepReadonly<TState>,
    eventRecords: readonly WizRpgEventRecord<TEvent>[] = []
  ): WizRpgDispatchResult<TState, TEvent, TReason> {
    return new WizRpgDispatchResult({ accepted: true, eventRecords, state })
  }

  static rejected<TState, TEvent, TReason extends string>(
    state: TState | WizDeepReadonly<TState>,
    error: WizRpgDispatchError<TReason>
  ): WizRpgDispatchResult<TState, TEvent, TReason> {
    return new WizRpgDispatchResult({ accepted: false, error, state })
  }
}

const isPlainRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype

const ownSchemaIssue = (
  message: string,
  path: readonly PropertyKey[]
): WizStandardSchemaIssue =>
  Object.freeze({ message, path: Object.freeze([...path]) })

const createSnapshotSchema = <
  TScene,
  TAction,
  TEvent,
  TReason extends string,
  TActions,
>(
  runtime: WizRpgSceneRuntime<TScene, TAction, TEvent, TReason, TActions>,
  features: readonly AnyFeature[]
): WizStandardSchemaDefinition<WizRpgWorldSnapshot, WizRpgWorldSnapshot> =>
  Object.freeze({
    "~standard": Object.freeze({
      version: 1 as const,
      vendor: "open-wiz",
      validate: (value: unknown) => {
        const issues: WizStandardSchemaIssue[] = []
        if (!isPlainRecord(value)) {
          return { issues: [ownSchemaIssue("must be a plain object", [])] }
        }
        const keys = Object.keys(value)
        for (const key of keys) {
          if (key !== "scene" && key !== "features") {
            issues.push(ownSchemaIssue("unknown key", [key]))
          }
        }
        if (!("scene" in value)) {
          issues.push(ownSchemaIssue("is required", ["scene"]))
        }
        if (!isPlainRecord(value.features)) {
          issues.push(ownSchemaIssue("must be a plain object", ["features"]))
        }
        if (issues.length > 0 || !isPlainRecord(value.features)) {
          return { issues }
        }

        let scene: object | undefined
        try {
          scene = runtime.capture(runtime.restore(value.scene))
        } catch (error) {
          issues.push(
            ownSchemaIssue(
              error instanceof Error
                ? error.message
                : "scene validation failed",
              ["scene"]
            )
          )
        }

        const featureData: Record<string, object> = {}
        const expectedKeys = new Set(features.map((feature) => feature.key))
        for (const key of Object.keys(value.features)) {
          if (!expectedKeys.has(key)) {
            issues.push(ownSchemaIssue("unknown feature", ["features", key]))
          }
        }
        for (const feature of features) {
          if (!(feature.key in value.features)) {
            issues.push(
              ownSchemaIssue("is required", ["features", feature.key])
            )
            continue
          }
          try {
            const featureValue = value.features[feature.key]
            if (typeof featureValue !== "object" || featureValue === null) {
              throw new TypeError("feature state must be an object")
            }
            featureData[feature.key] = feature.codec.decode(featureValue)
          } catch (error) {
            issues.push(
              ownSchemaIssue(
                error instanceof Error
                  ? error.message
                  : "feature validation failed",
                ["features", feature.key]
              )
            )
          }
        }

        if (issues.length > 0 || scene === undefined) {
          return { issues }
        }
        return {
          value: Object.freeze({
            features: Object.freeze(featureData),
            scene,
          }),
        }
      },
    }),
  })

const actionType = (action: unknown): string =>
  typeof action === "object" &&
  action !== null &&
  "type" in action &&
  typeof action.type === "string"
    ? action.type
    : typeof action

const resolveRpgAction = <
  TScene,
  TAction,
  TEvent,
  TReason extends string,
  TActions,
>(
  action: unknown,
  runtime: WizRpgSceneRuntime<TScene, TAction, TEvent, TReason, TActions>,
  features: readonly AnyFeature[]
): WizRpgActionResolution<TAction> => {
  if (!(action instanceof WizRpgFeatureAction)) {
    if (runtime.ownsAction(action)) {
      const sceneAction = rpgWorldOwnership.ownImmutable<TAction>(action)
      return Object.freeze({
        accepted: true,
        action: sceneAction,
        kind: "scene",
      }) satisfies WizRpgActionResolution<TAction>
    }
    return Object.freeze({
      accepted: false,
      error: Object.freeze({
        actionType: actionType(action),
        code: "UNHANDLED_ACTION",
      }),
    }) satisfies WizRpgActionResolution<TAction>
  }
  const feature = features.find(
    (candidate) => candidate.key === action.featureKey
  )
  if (feature === undefined) {
    return Object.freeze({
      accepted: false,
      error: Object.freeze({
        actionType: actionType(action.payload),
        code: "UNHANDLED_ACTION",
      }),
    }) satisfies WizRpgActionResolution<TAction>
  }
  const payload = feature.resolveAction(action.payload)
  return payload === null
    ? (Object.freeze({
        accepted: false,
        error: Object.freeze({
          actionType: actionType(action.payload),
          code: "FEATURE_ACTION_INVALID",
          featureKey: feature.key,
        }),
      }) satisfies WizRpgActionResolution<TAction>)
    : (Object.freeze({
        accepted: true,
        action: WizRpgFeatureAction.create(feature.key, payload),
        feature,
        kind: "feature",
        payload,
      }) satisfies WizRpgActionResolution<TAction>)
}

const applyFeatureReactions = (
  state: WizRpgWorldState<unknown, WizRpgFeatureStates>,
  initialEventRecords: readonly WizRpgEventRecord<unknown>[],
  features: readonly AnyFeature[]
):
  | Readonly<{
      accepted: true
      state: WizRpgWorldState<unknown, WizRpgFeatureStates>
      eventRecords: readonly WizRpgEventRecord<unknown>[]
    }>
  | Readonly<{
      accepted: false
      causedBy: number
      code: "FEATURE_REACTION_LIMIT_EXCEEDED"
      featureKey: string
    }>
  | Readonly<{
      accepted: false
      causedBy: number
      code: "FEATURE_REACTION_REJECTED"
      featureKey: string
      reason: string
    }> => {
  let currentState = state
  const eventRecords = [...initialEventRecords]
  let eventIndex = 0
  let reactionSteps = 0

  while (eventIndex < eventRecords.length) {
    const event = eventRecords[eventIndex]?.event
    eventIndex += 1
    for (const feature of features) {
      if (feature.react === null) continue
      const featureState = currentState.features[feature.key]
      const reaction = feature.react({
        event,
        features: currentState.features,
        scene: currentState.scene,
        state: featureState,
      })
      if (reaction === null) continue
      if (!reaction.accepted) {
        return Object.freeze({
          accepted: false,
          causedBy: eventIndex - 1,
          code: "FEATURE_REACTION_REJECTED",
          featureKey: feature.key,
          reason: reaction.reason,
        })
      }
      reactionSteps += 1
      if (reactionSteps > MAXIMUM_FEATURE_REACTION_STEPS) {
        return Object.freeze({
          accepted: false,
          causedBy: eventIndex - 1,
          code: "FEATURE_REACTION_LIMIT_EXCEEDED",
          featureKey: feature.key,
        })
      }
      currentState = currentState.withFeature(feature.key, reaction.state)
      eventRecords.push(
        ...(reaction.events ?? []).map((emittedEvent) =>
          WizRpgEventRecord.feature(feature.key, emittedEvent, eventIndex - 1)
        )
      )
    }
  }

  return Object.freeze({
    accepted: true,
    eventRecords: rpgWorldOwnership.ownImmutable(eventRecords),
    state: currentState,
  })
}

/**
 * scene runtime、横断feature、policy、保存を合成する新しいRPG composition root。
 */
export class WizRpgWorld<
  TScene,
  TSceneAction,
  TSceneEvent,
  TSceneReason extends string,
  TActions,
  TFeatures extends WizRpgFeatureStates = Readonly<Record<never, never>>,
  TFeatureCommands extends WizRpgFeatureCommands = Readonly<
    Record<never, never>
  >,
  TFeatureAction = never,
  TFeatureEvent = never,
  TFeatureReason extends string = never,
  TPolicyReason extends string = never,
  TCompositionPhase extends WizRpgCompositionPhase = "features",
> {
  readonly commands: WizRpgCommands<TActions, TFeatureCommands>
  readonly initialState: WizRpgWorldState<TScene, TFeatures>
  readonly identity: string
  readonly manifest: WizRpgCompositionManifest

  readonly #runtime: WizRpgSceneRuntime<
    TScene,
    TSceneAction,
    TSceneEvent,
    TSceneReason,
    TActions
  >
  readonly #features: readonly AnyFeature[]
  readonly #policies: readonly AnyPolicy[]
  readonly #compositionPhase: TCompositionPhase
  readonly #saveCodec: WizWorldSaveCodec<WizRpgWorldSnapshot>
  readonly #trustedStates = new WeakSet<object>()

  private constructor(
    token: symbol,
    definition: {
      runtime: WizRpgSceneRuntime<
        TScene,
        TSceneAction,
        TSceneEvent,
        TSceneReason,
        TActions
      >
      initialState: WizRpgWorldState<TScene, TFeatures>
      features: readonly AnyFeature[]
      policies: readonly AnyPolicy[]
      compositionPhase: TCompositionPhase
    }
  ) {
    if (token !== rpgWorldConstructionToken) {
      throw new TypeError("WizRpgWorld must be created with fromRuntime()")
    }
    this.#runtime = definition.runtime
    this.#features = Object.freeze([...definition.features])
    this.#policies = Object.freeze([...definition.policies])
    this.#compositionPhase = definition.compositionPhase
    let commands = WizRpgCommands.forScene(definition.runtime.actions)
    for (const feature of definition.features) {
      commands = commands.withFeature(feature.key, feature.commands)
    }
    this.commands = commands as WizRpgCommands<TActions, TFeatureCommands>
    this.initialState = definition.initialState
    const componentDefinitions = [
      ...definition.features.map((feature) => ({
        identity: feature.identity,
        key: feature.key,
        kind: "feature" as const,
      })),
      ...definition.policies.map((policy) => ({
        identity: policy.identity,
        key: policy.name,
        kind: "policy" as const,
      })),
    ]
    const identity = componentDefinitions.reduce<WizRpgWorldIdentity>(
      (current, component) =>
        component.identity.extend(current, component.kind, component.key),
      definition.runtime.identity
    )
    this.identity = identity.value
    this.manifest = WizRpgCompositionManifest.create(
      definition.runtime.identity.value,
      this.identity,
      [
        ...definition.runtime.components,
        ...componentDefinitions.map((component) =>
          component.identity.describe(component.kind, component.key)
        ),
      ]
    )
    this.#saveCodec = WizWorldSaveCodec.define({
      contentVersion: this.identity,
      schemaVersion: WIZ_RPG_WORLD_SCHEMA_VERSION,
      schema: createSnapshotSchema(definition.runtime, this.#features),
    })
    this.#trustedStates.add(this.initialState)
    Object.freeze(this)
  }

  static fromRuntime<TScene, TAction, TEvent, TReason extends string, TActions>(
    runtime: WizRpgSceneRuntime<TScene, TAction, TEvent, TReason, TActions>
  ): WizRpgWorld<TScene, TAction, TEvent, TReason, TActions> {
    WizRpgSceneRuntime.require(runtime, "RPG scene runtime")
    return new WizRpgWorld(rpgWorldConstructionToken, {
      compositionPhase: "features",
      features: [],
      initialState: WizRpgWorldState.create<TScene>(runtime.initialScene),
      policies: [],
      runtime,
    })
  }

  withFeature<
    TObservedFeatures extends WizRpgFeatureStates,
    const TKey extends string,
    TState,
    TActionInput,
    TActionOutput,
    TObservedEvent,
    TEvent,
    TReason extends string,
    TInput extends object,
    TOutput extends object,
    TCommands,
  >(
    this: WizRpgWorld<
      TScene,
      TSceneAction,
      TSceneEvent,
      TSceneReason,
      TActions,
      TFeatures,
      TFeatureCommands,
      TFeatureAction,
      TFeatureEvent,
      TFeatureReason,
      TPolicyReason,
      "features"
    >,
    feature: WizRpgFeature<
      TScene,
      TObservedFeatures,
      TKey,
      TState,
      TActionInput,
      TActionOutput,
      TObservedEvent,
      TEvent,
      TReason,
      TInput,
      TOutput,
      TCommands
    > &
      ([TFeatures] extends [TObservedFeatures] ? unknown : never)
  ): WizRpgWorld<
    TScene,
    TSceneAction,
    TSceneEvent,
    TSceneReason,
    TActions,
    TFeatures & Readonly<Record<TKey, TState>>,
    TFeatureCommands &
      Readonly<Record<TKey, WizRpgFeatureCommandSurface<TKey, TCommands>>>,
    TFeatureAction | WizRpgFeatureAction<TKey, TActionInput>,
    TFeatureEvent | TEvent,
    TFeatureReason | TReason,
    TPolicyReason,
    "features"
  > {
    if (this.#compositionPhase !== "features") {
      throw new TypeError("RPG features must be composed before policies")
    }
    WizRpgFeature.require(feature, "RPG feature")
    if (this.#features.some((candidate) => candidate.key === feature.key)) {
      throw new RangeError(`Duplicate RPG feature key "${feature.key}"`)
    }
    return new WizRpgWorld(rpgWorldConstructionToken, {
      compositionPhase: "features",
      features: [...this.#features, feature as AnyFeature],
      initialState: this.initialState.withFeature<TKey, TState>(
        feature.key,
        feature.initialState
      ),
      policies: this.#policies,
      runtime: this.#runtime,
    })
  }

  withPolicy<TReason extends string>(
    policy: WizRpgPolicy<
      WizRpgWorldState<TScene, TFeatures>,
      TSceneAction | TFeatureAction,
      TReason
    >
  ): WizRpgWorld<
    TScene,
    TSceneAction,
    TSceneEvent,
    TSceneReason,
    TActions,
    TFeatures,
    TFeatureCommands,
    TFeatureAction,
    TFeatureEvent,
    TFeatureReason,
    TPolicyReason | TReason,
    "policies"
  > {
    WizRpgPolicy.require(policy, "RPG policy")
    if (this.#policies.some((candidate) => candidate.name === policy.name)) {
      throw new RangeError(`Duplicate RPG policy name "${policy.name}"`)
    }
    return new WizRpgWorld(rpgWorldConstructionToken, {
      compositionPhase: "policies",
      features: this.#features,
      initialState: this.initialState,
      policies: [...this.#policies, policy as AnyPolicy],
      runtime: this.#runtime,
    })
  }

  affordances(
    state: WizRpgWorldState<TScene, TFeatures>
  ): readonly WizRpgAffordance<
    string,
    TSceneAction | TFeatureAction,
    TPolicyReason
  >[] {
    this.#requireState(state)
    const candidates = this.#policies.flatMap((policy) =>
      policy.affordances(state)
    )
    for (const [index, candidate] of candidates.entries()) {
      WizRpgAffordance.require(candidate, `RPG affordance at index ${index}`)
    }
    const duplicateId = candidates.find(
      (candidate, index) =>
        candidates.findIndex((other) => other.id === candidate.id) !== index
    )?.id
    if (duplicateId !== undefined) {
      throw new RangeError(`Duplicate RPG affordance id "${duplicateId}"`)
    }
    const resolved = candidates.map((candidate) => {
      const resolution = resolveRpgAction(
        candidate.action,
        this.#runtime,
        this.#features
      )
      if (!resolution.accepted) {
        const featureKey =
          resolution.error.code === "FEATURE_ACTION_INVALID"
            ? ` for feature "${resolution.error.featureKey}"`
            : ""
        throw new TypeError(
          `RPG affordance "${candidate.id}" has invalid action${featureKey}: ${resolution.error.code}`
        )
      }
      for (const policy of this.#policies) {
        const authorization = policy.authorize(state, resolution.action)
        if (!authorization.allowed) {
          return candidate.resolve(authorization)
        }
      }
      return candidate.resolve({ allowed: true })
    })
    return rpgWorldOwnership.ownImmutable(
      resolved
    ) as unknown as readonly WizRpgAffordance<
      string,
      TSceneAction | TFeatureAction,
      TPolicyReason
    >[]
  }

  dispatch(
    state: WizRpgWorldState<TScene, TFeatures>,
    action: TSceneAction | TFeatureAction
  ): WizRpgDispatchResult<
    WizRpgWorldState<TScene, TFeatures>,
    TSceneEvent | TFeatureEvent,
    TSceneReason | TFeatureReason | TPolicyReason
  > {
    this.#requireState(state)
    const ownedAction = rpgWorldOwnership.ownImmutable(action)
    type ResultEvent = TSceneEvent | TFeatureEvent
    type ResultReason = TSceneReason | TFeatureReason | TPolicyReason
    const reject = (
      error: WizRpgDispatchError<ResultReason>
    ): WizRpgDispatchResult<
      WizRpgWorldState<TScene, TFeatures>,
      ResultEvent,
      ResultReason
    > =>
      WizRpgDispatchResult.rejected<
        WizRpgWorldState<TScene, TFeatures>,
        ResultEvent,
        ResultReason
      >(state, error)

    const resolution = resolveRpgAction(
      ownedAction,
      this.#runtime,
      this.#features
    )
    if (!resolution.accepted) {
      return reject(resolution.error)
    }

    for (const policy of this.#policies) {
      const authorization = policy.authorize(state, resolution.action)
      if (!authorization.allowed) {
        return reject({
          code: "POLICY_REJECTED",
          policyName: policy.name,
          reason: authorization.reason as ResultReason,
        })
      }
    }

    let nextState: WizRpgWorldState<TScene, TFeatures>
    let emittedEventRecords: readonly WizRpgEventRecord<unknown>[]
    if (resolution.kind === "feature") {
      const featureState = state.features[resolution.feature.key]
      const result = resolution.feature.reduce(
        {
          features: state.features,
          scene: state.scene,
          state: featureState,
        },
        resolution.payload
      )
      if (!result.accepted) {
        return reject({
          code: "FEATURE_REJECTED",
          featureKey: resolution.feature.key,
          reason: result.reason as ResultReason,
        })
      }
      nextState = state.withFeature(resolution.feature.key, result.state)
      emittedEventRecords = (result.events ?? []).map((event) =>
        WizRpgEventRecord.feature(resolution.feature.key, event)
      )
    } else {
      const result = this.#runtime.dispatch(state.scene, resolution.action)
      if (!result.accepted || result.error !== undefined) {
        return reject(
          (result.error ?? {
            actionType: actionType(ownedAction),
            code: "UNHANDLED_ACTION",
          }) as WizRpgDispatchError<ResultReason>
        )
      }
      nextState = state.withScene<TScene>(result.state)
      emittedEventRecords = result.events.map((event) =>
        WizRpgEventRecord.scene(event)
      )
    }

    const reaction = applyFeatureReactions(
      nextState as WizRpgWorldState<unknown, WizRpgFeatureStates>,
      emittedEventRecords,
      this.#features
    )
    if (!reaction.accepted) {
      return reaction.code === "FEATURE_REACTION_LIMIT_EXCEEDED"
        ? reject({
            causedBy: reaction.causedBy,
            code: reaction.code,
            featureKey: reaction.featureKey,
            maximumReactionSteps: MAXIMUM_FEATURE_REACTION_STEPS,
          })
        : reject({
            causedBy: reaction.causedBy,
            code: reaction.code,
            featureKey: reaction.featureKey,
            reason: reaction.reason as ResultReason,
          })
    }
    const ownedState = reaction.state as WizRpgWorldState<TScene, TFeatures>
    this.#trustedStates.add(ownedState)
    return WizRpgDispatchResult.accepted<
      WizRpgWorldState<TScene, TFeatures>,
      ResultEvent,
      ResultReason
    >(
      ownedState,
      reaction.eventRecords as readonly WizRpgEventRecord<ResultEvent>[]
    )
  }

  save(
    state: WizRpgWorldState<TScene, TFeatures>
  ): WizWorldSaveEnvelope<WizRpgWorldSnapshot> {
    this.#requireState(state)
    const featureSnapshots: Record<string, object> = {}
    for (const feature of this.#features) {
      featureSnapshots[feature.key] = feature.codec.capture(
        state.features[feature.key]
      )
    }
    return this.#saveCodec.encode({
      features: Object.freeze(featureSnapshots),
      scene: this.#runtime.capture(state.scene),
    })
  }

  restore(input: unknown): WizRpgWorldState<TScene, TFeatures> {
    const snapshot = this.#saveCodec.decodeSnapshot(input)
    let state = WizRpgWorldState.create(
      this.#runtime.restore(snapshot.scene)
    ) as WizRpgWorldState<TScene, TFeatures>
    for (const feature of this.#features) {
      state = state.withFeature(
        feature.key,
        feature.codec.restoreDecoded(snapshot.features[feature.key])
      ) as WizRpgWorldState<TScene, TFeatures>
    }
    this.#trustedStates.add(state)
    return state
  }

  #requireState(state: WizRpgWorldState<TScene, TFeatures>): void {
    if (
      !(state instanceof WizRpgWorldState) ||
      !this.#trustedStates.has(state)
    ) {
      throw new TypeError("RPG world state was not created by this world")
    }
  }
}

Object.freeze(WizRpgEventRecord.prototype)
Object.freeze(WizRpgEventRecord)
Object.freeze(WizRpgDispatchResult.prototype)
Object.freeze(WizRpgDispatchResult)
Object.freeze(WizRpgWorld.prototype)
Object.freeze(WizRpgWorld)
