import {
  WizWorldModule,
  type WizWorldRule,
  type WizWorldRuleResult,
  WizWorldStateOwnership,
} from "@/lib/wiz/core/world/world"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import {
  WIZ_WORLD_SLICE_MODULE,
  type WizWorldSliceModuleCarrier,
} from "@/lib/wiz/core/world/world-slice-registry"
import type {
  WizStandardSchemaDefinition,
  WizStandardSchemaInput,
  WizStandardSchemaOutput,
} from "@/lib/wiz/core/standard-schema"
import { describeWizValueType } from "@/lib/wiz/core/value-type"

const worldSliceConstructionToken = Symbol("WizWorldSliceConstruction")

export type WizWorldSliceSelector<TRootState, TSliceState> = (
  rootState: WizDeepReadonly<TRootState>
) => TSliceState | WizDeepReadonly<TSliceState>

export type WizWorldSliceUpdater<TRootState, TSliceState> = (
  rootState: WizDeepReadonly<TRootState>,
  sliceState: WizDeepReadonly<TSliceState>
) => TRootState | WizDeepReadonly<TRootState>

export type WizWorldSliceModuleDefinition<
  TRootState,
  TSliceState,
  TAction,
  TEvent = never,
  TReason extends string = never,
> = Readonly<{
  name: string
  select: WizWorldSliceSelector<TRootState, TSliceState>
  update: WizWorldSliceUpdater<TRootState, TSliceState>
  accepts: (action: unknown) => action is TAction
  reduce: WizWorldRule<TSliceState, TAction, TEvent, TReason>
  sliceOwnership?: WizWorldStateOwnership<TSliceState>
}>

export type WizWorldSliceSchemaModuleDefinition<
  TRootState,
  TSliceState,
  TSchema extends WizStandardSchemaDefinition,
  TEvent = never,
  TReason extends string = never,
> = Readonly<{
  name: string
  select: WizWorldSliceSelector<TRootState, TSliceState>
  update: WizWorldSliceUpdater<TRootState, TSliceState>
  schema: TSchema
  reduce: WizWorldRule<
    TSliceState,
    WizStandardSchemaOutput<TSchema>,
    TEvent,
    TReason
  >
  sliceOwnership?: WizWorldStateOwnership<TSliceState>
}>

export type WizWorldPropertySliceModuleDefinition<
  TSliceState,
  TAction,
  TEvent = never,
  TReason extends string = never,
> = Readonly<{
  name?: string
  accepts: (action: unknown) => action is TAction
  reduce: WizWorldRule<TSliceState, TAction, TEvent, TReason>
  sliceOwnership?: WizWorldStateOwnership<TSliceState>
}>

export type WizWorldPropertySliceSchemaModuleDefinition<
  TSliceState,
  TSchema extends WizStandardSchemaDefinition,
  TEvent = never,
  TReason extends string = never,
> = Readonly<{
  name?: string
  schema: TSchema
  reduce: WizWorldRule<
    TSliceState,
    WizStandardSchemaOutput<TSchema>,
    TEvent,
    TReason
  >
  sliceOwnership?: WizWorldStateOwnership<TSliceState>
}>

type WizWorldSliceRuleDefinition<
  TRootState,
  TSliceState,
  TAction,
  TEvent,
  TReason extends string,
> = Readonly<{
  select: WizWorldSliceSelector<TRootState, TSliceState>
  update: WizWorldSliceUpdater<TRootState, TSliceState>
  reduce: WizWorldRule<TSliceState, TAction, TEvent, TReason>
  sliceOwnership?: WizWorldStateOwnership<TSliceState>
}>

const createWorldSliceRule = <
  TRootState,
  TSliceState,
  TAction,
  TEvent,
  TReason extends string,
>(
  definition: WizWorldSliceRuleDefinition<
    TRootState,
    TSliceState,
    TAction,
    TEvent,
    TReason
  >
): WizWorldRule<TRootState, TAction, TEvent, TReason> => {
  const sliceOwnership =
    definition.sliceOwnership ??
    WizWorldStateOwnership.deepImmutable<TSliceState>()
  const reduce = definition.reduce
  const select = definition.select
  const update = definition.update

  return (
    rootState,
    action,
    environment
  ): WizWorldRuleResult<TRootState, TEvent, TReason> => {
    const currentSlice = sliceOwnership.own(select(rootState))
    const result = reduce(currentSlice, action, environment)

    if (result.accepted === false) {
      return result
    }

    const nextSlice = sliceOwnership.own(result.state)
    return {
      accepted: true,
      events: result.events,
      state: update(rootState, nextSlice),
    }
  }
}

const assertPlainRecordRoot = (rootState: object): void => {
  const prototype = Object.getPrototypeOf(rootState)
  if (prototype !== Object.prototype && prototype !== null) {
    const type = describeWizValueType(rootState)
    throw new TypeError(
      `Property slice modules require a plain root record, received ${type}; use WizWorldSliceModule.define() with an explicit update function for class state`
    )
  }
}

const replacePlainRecordProperty = <
  TRootState extends object,
  TKey extends keyof TRootState,
>(
  rootState: WizDeepReadonly<TRootState>,
  key: TKey,
  value: WizDeepReadonly<TRootState[TKey]>
): TRootState => {
  assertPlainRecordRoot(rootState)
  const nextRoot = Object.create(Object.getPrototypeOf(rootState)) as TRootState
  let replaced = false

  for (const ownKey of Reflect.ownKeys(rootState)) {
    const descriptor = Object.getOwnPropertyDescriptor(rootState, ownKey)
    if (!descriptor) {
      continue
    }
    if (!("value" in descriptor)) {
      throw new TypeError(
        `Property slice modules do not support accessor root property ${String(ownKey)}; use a custom state ownership strategy and WizWorldSliceModule.define()`
      )
    }
    const isTarget = ownKey === key
    Object.defineProperty(nextRoot, ownKey, {
      ...descriptor,
      value: isTarget ? value : descriptor.value,
    })
    replaced ||= isTarget
  }

  if (!replaced) {
    Object.defineProperty(nextRoot, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    })
  }

  return nextRoot
}

/**
 * root stateの一部分だけを見る純粋なruleを、通常のworld moduleへ適合する不変クラス。
 *
 * sliceはruleへ渡す前とrootへ戻す前の両方で所有権を取得する。module名の重複と
 * actionの曖昧性は、変換先の`WizWorldModule`と`WizWorld`が一元的に検出する。
 */
export class WizWorldSliceModule<
  TRootState,
  TSliceState,
  TAction,
  TEvent = never,
  TReason extends string = never,
> implements WizWorldSliceModuleCarrier<TRootState, TAction, TEvent, TReason> {
  readonly accepts: (action: unknown) => action is TAction
  readonly name: string
  readonly #worldModule: WizWorldModule<TRootState, TAction, TEvent, TReason>
  declare private readonly sliceType: (slice: TSliceState) => TSliceState
  declare private readonly worldType: (
    types: Readonly<{
      action: TAction
      event: TEvent
      reason: TReason
      state: TRootState
    }>
  ) => readonly [TRootState, TAction, TEvent, TReason]

  private constructor(
    token: symbol,
    name: string,
    worldModule: WizWorldModule<TRootState, TAction, TEvent, TReason>
  ) {
    if (token !== worldSliceConstructionToken) {
      throw new TypeError(
        "World slice modules must be created by their public factories"
      )
    }
    this.name = name
    this.accepts = worldModule.accepts
    this.#worldModule = worldModule
    Object.freeze(this)
  }

  [WIZ_WORLD_SLICE_MODULE](): WizWorldModule<
    TRootState,
    TAction,
    TEvent,
    TReason
  > {
    return this.#worldModule
  }

  static define<
    TRootState,
    TSliceState,
    TAction,
    TEvent = never,
    TReason extends string = never,
  >(
    definition: WizWorldSliceModuleDefinition<
      TRootState,
      TSliceState,
      TAction,
      TEvent,
      TReason
    >
  ): WizWorldSliceModule<TRootState, TSliceState, TAction, TEvent, TReason> {
    const name = definition.name
    return new WizWorldSliceModule(
      worldSliceConstructionToken,
      name,
      WizWorldModule.define({
        accepts: definition.accepts,
        name,
        reduce: createWorldSliceRule(definition),
      })
    )
  }

  static fromSchema<
    TRootState,
    TSliceState,
    TSchema extends WizStandardSchemaDefinition,
    TEvent = never,
    TReason extends string = never,
  >(
    definition: WizWorldSliceSchemaModuleDefinition<
      TRootState,
      TSliceState,
      TSchema,
      TEvent,
      TReason
    >
  ): WizWorldSliceModule<
    TRootState,
    TSliceState,
    WizDeepReadonly<WizStandardSchemaInput<TSchema>>,
    TEvent,
    TReason
  > {
    const name = definition.name
    return new WizWorldSliceModule(
      worldSliceConstructionToken,
      name,
      WizWorldModule.fromSchema({
        name,
        reduce: createWorldSliceRule(definition),
        schema: definition.schema,
      })
    )
  }

  static forRoot<TRootState extends object>(): WizWorldSliceScope<TRootState> {
    return WizWorldSliceScope.create<TRootState>()
  }
}

/**
 * plain record型rootのpropertyをsliceとして扱うlens builder。
 *
 * `select`と`update`を毎回書かず、property keyから型安全に生成できる。
 */
export class WizWorldSliceScope<TRootState extends object> {
  private constructor(token: symbol) {
    if (token !== worldSliceConstructionToken) {
      throw new TypeError(
        "World slice builders must be created by WizWorldSliceModule.forRoot"
      )
    }
    Object.freeze(this)
  }

  /** @internal */
  static create<TRootState extends object>(): WizWorldSliceScope<TRootState> {
    return new WizWorldSliceScope<TRootState>(worldSliceConstructionToken)
  }

  at<
    TKey extends Extract<keyof TRootState, string>,
    TAction,
    TEvent = never,
    TReason extends string = never,
  >(
    key: TKey,
    definition: WizWorldPropertySliceModuleDefinition<
      TRootState[TKey],
      TAction,
      TEvent,
      TReason
    >
  ): WizWorldSliceModule<
    TRootState,
    TRootState[TKey],
    TAction,
    TEvent,
    TReason
  > {
    return WizWorldSliceModule.define({
      accepts: definition.accepts,
      name: definition.name ?? key,
      reduce: definition.reduce,
      select: (rootState) =>
        (
          rootState as Readonly<Record<TKey, WizDeepReadonly<TRootState[TKey]>>>
        )[key],
      sliceOwnership: definition.sliceOwnership,
      update: (rootState, sliceState) =>
        replacePlainRecordProperty(rootState, key, sliceState),
    })
  }

  atSchema<
    TKey extends Extract<keyof TRootState, string>,
    TSchema extends WizStandardSchemaDefinition,
    TEvent = never,
    TReason extends string = never,
  >(
    key: TKey,
    definition: WizWorldPropertySliceSchemaModuleDefinition<
      TRootState[TKey],
      TSchema,
      TEvent,
      TReason
    >
  ): WizWorldSliceModule<
    TRootState,
    TRootState[TKey],
    WizDeepReadonly<WizStandardSchemaInput<TSchema>>,
    TEvent,
    TReason
  > {
    return WizWorldSliceModule.fromSchema({
      name: definition.name ?? key,
      reduce: definition.reduce,
      schema: definition.schema,
      select: (rootState) =>
        (
          rootState as Readonly<Record<TKey, WizDeepReadonly<TRootState[TKey]>>>
        )[key],
      sliceOwnership: definition.sliceOwnership,
      update: (rootState, sliceState) =>
        replacePlainRecordProperty(rootState, key, sliceState),
    })
  }
}

Object.freeze(WizWorldSliceModule)
Object.freeze(WizWorldSliceModule.prototype)
Object.freeze(WizWorldSliceScope)
Object.freeze(WizWorldSliceScope.prototype)
