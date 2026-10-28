import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import {
  WizStandardSchema,
  type WizStandardSchemaDefinition,
  type WizStandardSchemaInput,
  type WizStandardSchemaOutput,
  WizStandardSchemaValidationError,
} from "@/lib/wiz/core/standard-schema"
import { assertRpgCommandSurface } from "@/lib/wiz/core/rpg/commands"
import { WizRpgComponentIdentity } from "@/lib/wiz/core/rpg/component-identity"
import type { WizRpgDispatchResult } from "@/lib/wiz/core/rpg/world"
import type {
  WizRpgFeatureStates,
  WizRpgWorldState,
} from "@/lib/wiz/core/rpg/world-state"

const featureConstructionToken = Symbol("WizRpgFeature.constructor")
const featureCodecConstructionToken = Symbol("WizRpgFeatureCodec.constructor")
const featureFactoryConstructionToken = Symbol(
  "WizRpgFeatureFactory.constructor"
)
const affordanceConstructionToken = Symbol("WizRpgAffordance.constructor")
const featureOwnership = new WizObjectService()
const authenticFeatureCodecs = new WeakSet<object>()
const authenticFeatures = new WeakSet<object>()
const authenticAffordances = new WeakSet<object>()

export type WizRpgFeatureAcceptedResult<TState, TEvent = never> = Readonly<{
  accepted: true
  state: WizDeepReadonly<TState>
  events?: readonly WizDeepReadonly<TEvent>[]
}>

export type WizRpgFeatureRejectedResult<TReason extends string> = Readonly<{
  accepted: false
  reason: TReason
}>

export type WizRpgFeatureResult<
  TState,
  TEvent = never,
  TReason extends string = never,
> =
  | WizRpgFeatureAcceptedResult<TState, TEvent>
  | WizRpgFeatureRejectedResult<TReason>

const normalizeFeatureResult = <TState, TEvent, TReason extends string>(
  result: unknown,
  label: string
): WizRpgFeatureResult<TState, TEvent, TReason> => {
  if (
    typeof result !== "object" ||
    result === null ||
    !("accepted" in result)
  ) {
    throw new TypeError(
      `${label} must return an accepted or rejected result object`
    )
  }
  if (result.accepted === false) {
    if (
      !("reason" in result) ||
      typeof result.reason !== "string" ||
      result.reason.trim().length === 0 ||
      result.reason !== result.reason.trim()
    ) {
      throw new TypeError(
        `${label} rejected result must have a stable non-blank reason`
      )
    }
    return Object.freeze({
      accepted: false,
      reason: result.reason as TReason,
    })
  }
  if (result.accepted !== true || !("state" in result)) {
    throw new TypeError(
      `${label} accepted result must have accepted true and a state`
    )
  }
  const events =
    "events" in result && result.events !== undefined ? result.events : []
  if (!Array.isArray(events)) {
    throw new TypeError(`${label} accepted result events must be an array`)
  }
  return Object.freeze({
    accepted: true,
    events: featureOwnership.ownImmutable<readonly TEvent[]>(
      events as readonly TEvent[]
    ),
    state: featureOwnership.ownImmutable<TState>(result.state as TState),
  })
}

export type WizRpgFeatureContext<
  TScene,
  TState,
  TFeatures extends WizRpgFeatureStates,
> = Readonly<{
  scene: WizDeepReadonly<TScene>
  state: WizDeepReadonly<TState>
  features: WizDeepReadonly<TFeatures>
}>

export type WizRpgFeatureReactionContext<
  TScene,
  TState,
  TFeatures extends WizRpgFeatureStates,
  TObservedEvent,
> = WizRpgFeatureContext<TScene, TState, TFeatures> &
  Readonly<{
    event: WizDeepReadonly<TObservedEvent>
  }>

export type WizRpgFeatureCodecDefinition<
  TState,
  TInput extends object,
  TOutput extends object = TInput,
> = Readonly<{
  schema: WizStandardSchemaDefinition<TInput, TOutput>
  capture: (state: WizDeepReadonly<TState>) => TInput
  restore: (data: WizDeepReadonly<TOutput>) => TState
}>

/** feature stateの保存境界。featureごとに必須となる。 */
export class WizRpgFeatureCodec<
  TState,
  TInput extends object,
  TOutput extends object = TInput,
> {
  readonly capture: (state: WizDeepReadonly<TState>) => WizDeepReadonly<TInput>
  /** @internal root save composition only. */
  readonly decode: (input: unknown) => WizDeepReadonly<TOutput>
  readonly restore: (input: unknown) => WizDeepReadonly<TState>
  /** @internal root save composition only. */
  readonly restoreDecoded: (
    data: WizDeepReadonly<TOutput>
  ) => WizDeepReadonly<TState>

  private constructor(
    token: symbol,
    definition: WizRpgFeatureCodecDefinition<TState, TInput, TOutput>
  ) {
    if (token !== featureCodecConstructionToken) {
      throw new TypeError("WizRpgFeatureCodec must be created with define()")
    }
    const schema = WizStandardSchema.capture(
      definition.schema,
      "RPG feature state"
    )
    const captureState = Object.freeze(definition.capture.bind(undefined))
    const restoreState = Object.freeze(definition.restore.bind(undefined))
    this.capture = Object.freeze((state: WizDeepReadonly<TState>) =>
      featureOwnership.ownImmutable<TInput>(captureState(state))
    )
    this.decode = Object.freeze((input: unknown): WizDeepReadonly<TOutput> =>
      featureOwnership.ownImmutable<TOutput>(schema.validate(input))
    )
    this.restoreDecoded = Object.freeze((data: WizDeepReadonly<TOutput>) =>
      featureOwnership.ownImmutable<TState>(restoreState(data))
    )
    this.restore = Object.freeze((input: unknown) =>
      this.restoreDecoded(this.decode(input))
    )
    authenticFeatureCodecs.add(this)
    Object.freeze(this)
  }

  static define<TState, TInput extends object, TOutput extends object = TInput>(
    definition: WizRpgFeatureCodecDefinition<TState, TInput, TOutput>
  ): WizRpgFeatureCodec<TState, TInput, TOutput> {
    return new WizRpgFeatureCodec(featureCodecConstructionToken, definition)
  }

  /** @internal feature composition boundary only. */
  static require(value: unknown, label: string): void {
    if (
      typeof value !== "object" ||
      value === null ||
      !authenticFeatureCodecs.has(value)
    ) {
      throw new TypeError(
        `${label} must be created with WizRpgFeatureCodec.define()`
      )
    }
  }
}

export type WizRpgFeatureDefinition<
  TScene,
  TFeatures extends WizRpgFeatureStates,
  TKey extends string,
  TState,
  TActionSchema extends WizStandardSchemaDefinition,
  TObservedEvent,
  TEvent,
  TReason extends string,
  TInput extends object,
  TOutput extends object,
  TCommands,
> = Readonly<{
  key: TKey
  identity: WizRpgComponentIdentity
  initialState: TState
  commands: TCommands
  codec: WizRpgFeatureCodec<TState, TInput, TOutput>
  action: TActionSchema
  reduce: (
    context: WizRpgFeatureContext<TScene, TState, TFeatures>,
    action: WizDeepReadonly<WizStandardSchemaOutput<TActionSchema>>
  ) => WizRpgFeatureResult<TState, TEvent, TReason>
  react?: (
    context: WizRpgFeatureReactionContext<
      TScene,
      TState,
      TFeatures,
      TObservedEvent | TEvent
    >
  ) => WizRpgFeatureResult<TState, TEvent, TReason> | null
}>

type WizRpgCommandSurfaceForAction<TCommands, TAction> = Readonly<{
  [
    TKey in keyof TCommands as TKey extends typeof WIZ_IMMUTABLE_VALUE
      ? never
      : TKey
  ]: TCommands[TKey] extends (...arguments_: infer TArguments) => infer TResult
    ? TResult extends TAction
      ? (...arguments_: TArguments) => TResult
      : never
    : never
}>

type WizRpgIdentityActionSchema<TSchema extends WizStandardSchemaDefinition> = [
  WizStandardSchemaInput<TSchema>,
] extends [WizStandardSchemaOutput<TSchema>]
  ? [WizStandardSchemaOutput<TSchema>] extends [WizStandardSchemaInput<TSchema>]
    ? unknown
    : never
  : never

type WizRpgSceneOf<TWorld> =
  TWorld extends Readonly<{
    initialState: WizRpgWorldState<infer TScene, WizRpgFeatureStates>
  }>
    ? TScene
    : never

type WizRpgEventOf<TWorld> =
  TWorld extends Readonly<{
    dispatch: (
      ...arguments_: never[]
    ) => WizRpgDispatchResult<unknown, infer TEvent, string>
  }>
    ? TEvent
    : never

type WizRpgFeaturesOf<TWorld> =
  TWorld extends Readonly<{
    initialState: WizRpgWorldState<unknown, infer TFeatures>
  }>
    ? TFeatures
    : never

/**
 * 永続state、action、event reaction、codecを一単位にした不変feature。
 */
export class WizRpgFeature<
  TScene,
  TFeatures extends WizRpgFeatureStates,
  TKey extends string,
  TState,
  TActionInput,
  TActionOutput,
  TObservedEvent,
  TEvent = never,
  TReason extends string = never,
  TInput extends object = object,
  TOutput extends object = TInput,
  TCommands = Readonly<Record<never, never>>,
> {
  readonly key: TKey
  readonly identity: WizRpgComponentIdentity
  readonly initialState: WizDeepReadonly<TState>
  readonly commands: WizDeepReadonly<TCommands>
  readonly codec: WizRpgFeatureCodec<TState, TInput, TOutput>
  readonly resolveAction: (
    action: unknown
  ) => WizDeepReadonly<TActionOutput> | null
  readonly reduce: (
    context: WizRpgFeatureContext<TScene, TState, TFeatures>,
    action: WizDeepReadonly<TActionOutput>
  ) => WizRpgFeatureResult<TState, TEvent, TReason>
  readonly react:
    | ((
        context: WizRpgFeatureReactionContext<
          TScene,
          TState,
          TFeatures,
          TObservedEvent | TEvent
        >
      ) => WizRpgFeatureResult<TState, TEvent, TReason> | null)
    | null

  private constructor(
    token: symbol,
    definition: WizRpgFeatureDefinition<
      TScene,
      TFeatures,
      TKey,
      TState,
      WizStandardSchemaDefinition<TActionInput, TActionOutput>,
      TObservedEvent,
      TEvent,
      TReason,
      TInput,
      TOutput,
      TCommands
    >
  ) {
    if (token !== featureConstructionToken) {
      throw new TypeError("WizRpgFeature must be created with define()")
    }
    if (
      definition.key.trim().length === 0 ||
      definition.key !== definition.key.trim()
    ) {
      throw new RangeError(
        "RPG feature key must be a non-blank string without surrounding whitespace"
      )
    }
    this.key = definition.key
    this.identity = WizRpgComponentIdentity.require(
      definition.identity,
      `RPG feature "${definition.key}" identity`
    )
    this.initialState = featureOwnership.ownImmutable<TState>(
      definition.initialState
    )
    assertRpgCommandSurface(
      definition.commands,
      `RPG feature "${definition.key}"`
    )
    this.commands = definition.commands as WizDeepReadonly<TCommands>
    WizRpgFeatureCodec.require(
      definition.codec,
      `RPG feature "${definition.key}" codec`
    )
    this.codec = definition.codec
    const actionSchema = WizStandardSchema.capture(
      definition.action,
      `RPG feature "${definition.key}" action`
    )
    this.resolveAction = Object.freeze(
      (action: unknown): WizDeepReadonly<TActionOutput> | null => {
        try {
          return featureOwnership.ownImmutable<TActionOutput>(
            actionSchema.validate(action)
          )
        } catch (error) {
          if (error instanceof WizStandardSchemaValidationError) {
            return null
          }
          throw error
        }
      }
    )
    const reduce = Object.freeze(definition.reduce.bind(undefined))
    this.reduce = Object.freeze(
      (
        context: WizRpgFeatureContext<TScene, TState, TFeatures>,
        action: WizDeepReadonly<TActionOutput>
      ) =>
        normalizeFeatureResult<TState, TEvent, TReason>(
          reduce(context, action),
          `RPG feature "${definition.key}" reducer`
        )
    )
    const react = definition.react
      ? Object.freeze(definition.react.bind(undefined))
      : null
    this.react =
      react === null
        ? null
        : Object.freeze(
            (
              context: WizRpgFeatureReactionContext<
                TScene,
                TState,
                TFeatures,
                TObservedEvent | TEvent
              >
            ) => {
              const result = react(context)
              return result === null
                ? null
                : normalizeFeatureResult<TState, TEvent, TReason>(
                    result,
                    `RPG feature "${definition.key}" reaction`
                  )
            }
          )
    authenticFeatures.add(this)
    Object.freeze(this)
  }

  /** @internal feature factory only. */
  static create<
    TScene,
    TFeatures extends WizRpgFeatureStates,
    const TKey extends string,
    TState,
    TActionInput,
    TActionOutput,
    TObservedEvent,
    TEvent,
    const TReason extends string,
    TInput extends object,
    TOutput extends object,
    TCommands,
  >(
    definition: WizRpgFeatureDefinition<
      TScene,
      TFeatures,
      TKey,
      TState,
      WizStandardSchemaDefinition<TActionInput, TActionOutput>,
      TObservedEvent,
      TEvent,
      TReason,
      TInput,
      TOutput,
      TCommands
    >
  ): WizRpgFeature<
    TScene,
    TFeatures,
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
  > {
    return new WizRpgFeature(featureConstructionToken, definition)
  }

  static forWorld<TWorld extends object>(
    world: TWorld
  ): WizRpgFeatureFactory<
    WizRpgSceneOf<TWorld>,
    WizRpgFeaturesOf<TWorld>,
    WizRpgEventOf<TWorld>
  > {
    void world
    return WizRpgFeatureFactory.create()
  }

  /** @internal world composition boundary only. */
  static require(value: unknown, label: string): void {
    if (
      typeof value !== "object" ||
      value === null ||
      !authenticFeatures.has(value)
    ) {
      throw new TypeError(
        `${label} must be created with WizRpgFeature.forWorld(...).define()`
      )
    }
  }
}

/**
 * 既存worldからscene・観測event型を取得し、feature固有型をschemaとcallbackから推論する。
 */
export class WizRpgFeatureFactory<
  TScene,
  TFeatures extends WizRpgFeatureStates,
  TObservedEvent,
> {
  private constructor(token: symbol) {
    if (token !== featureFactoryConstructionToken) {
      throw new TypeError(
        "WizRpgFeatureFactory must be created with WizRpgFeature.forWorld()"
      )
    }
    Object.freeze(this)
  }

  /** @internal feature composition root only. */
  static create<
    TScene,
    TFeatures extends WizRpgFeatureStates,
    TObservedEvent,
  >(): WizRpgFeatureFactory<TScene, TFeatures, TObservedEvent> {
    return new WizRpgFeatureFactory(featureFactoryConstructionToken)
  }

  define<
    const TKey extends string,
    TState,
    const TActionSchema extends WizStandardSchemaDefinition,
    TEvent,
    const TReason extends string,
    TInput extends object = object,
    TOutput extends object = TInput,
    TCommands = Readonly<Record<never, never>>,
  >(
    definition: WizRpgFeatureDefinition<
      TScene,
      TFeatures,
      TKey,
      TState,
      TActionSchema,
      TObservedEvent,
      TEvent,
      TReason,
      TInput,
      TOutput,
      TCommands
    > &
      Readonly<{
        commands: TCommands &
          WizRpgCommandSurfaceForAction<
            TCommands,
            WizStandardSchemaInput<TActionSchema>
          >
      }> &
      WizRpgIdentityActionSchema<TActionSchema>
  ): WizRpgFeature<
    TScene,
    TFeatures,
    TKey,
    TState,
    WizStandardSchemaInput<TActionSchema>,
    WizStandardSchemaOutput<TActionSchema>,
    TObservedEvent,
    TEvent,
    TReason,
    TInput,
    TOutput,
    TCommands
  > {
    return WizRpgFeature.create<
      TScene,
      TFeatures,
      TKey,
      TState,
      WizStandardSchemaInput<TActionSchema>,
      WizStandardSchemaOutput<TActionSchema>,
      TObservedEvent,
      TEvent,
      TReason,
      TInput,
      TOutput,
      TCommands
    >(definition)
  }
}

export type WizRpgAffordanceDefinition<TId extends string, TAction> = Readonly<{
  id: TId
  action: TAction
  visible?: boolean
}>

/** UI表示とdispatch認可で共有するtyped command descriptor。 */
export class WizRpgAffordance<
  TId extends string,
  TAction,
  TReason extends string = never,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly id: TId
  readonly action: WizDeepReadonly<TAction>
  readonly visible: boolean
  readonly enabled: boolean
  readonly reason: TReason | null

  private constructor(
    token: symbol,
    definition: Omit<WizRpgAffordanceDefinition<TId, TAction>, "action"> &
      Readonly<{ action: TAction | WizDeepReadonly<TAction> }>,
    availability:
      | Readonly<{ enabled: true }>
      | Readonly<{ enabled: false; reason: TReason }>
  ) {
    if (token !== affordanceConstructionToken) {
      throw new TypeError("WizRpgAffordance must be created with define()")
    }
    if (
      definition.id.trim().length === 0 ||
      definition.id !== definition.id.trim()
    ) {
      throw new RangeError(
        "RPG affordance id must be a non-blank string without surrounding whitespace"
      )
    }
    this.id = definition.id
    this.action = featureOwnership.ownImmutable<TAction>(definition.action)
    this.visible = definition.visible ?? true
    this.enabled = availability.enabled
    this.reason = availability.enabled ? null : availability.reason
    authenticAffordances.add(this)
    WizImmutableValue.freeze(this)
  }

  static define<const TId extends string, TAction>(
    definition: WizRpgAffordanceDefinition<TId, TAction>
  ): WizRpgAffordance<TId, TAction> {
    return new WizRpgAffordance(affordanceConstructionToken, definition, {
      enabled: true,
    })
  }

  /** @internal policy composition boundary only. */
  static require(value: unknown, label: string): void {
    if (
      typeof value !== "object" ||
      value === null ||
      !authenticAffordances.has(value)
    ) {
      throw new TypeError(
        `${label} must be created with WizRpgAffordance.define()`
      )
    }
  }

  resolve<TNextReason extends string>(
    availability:
      | Readonly<{ allowed: true }>
      | Readonly<{ allowed: false; reason: TNextReason }>
  ): WizRpgAffordance<TId, TAction, TNextReason> {
    return new WizRpgAffordance<TId, TAction, TNextReason>(
      affordanceConstructionToken,
      {
        action: this.action,
        id: this.id,
        visible: this.visible,
      },
      availability.allowed
        ? { enabled: true }
        : { enabled: false, reason: availability.reason }
    )
  }
}

Object.freeze(WizRpgFeatureCodec.prototype)
Object.freeze(WizRpgFeatureCodec)
Object.freeze(WizRpgFeature.prototype)
Object.freeze(WizRpgFeature)
Object.freeze(WizRpgFeatureFactory.prototype)
Object.freeze(WizRpgFeatureFactory)
Object.freeze(WizRpgAffordance.prototype)
Object.freeze(WizRpgAffordance)
