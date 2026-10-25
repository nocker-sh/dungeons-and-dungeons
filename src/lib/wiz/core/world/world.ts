import type { WizWorldSliceModule } from "@/lib/wiz/core/world/world-slice-module"
import { requireWizWorldSliceModule } from "@/lib/wiz/core/world/world-slice-registry"
import {
  WizStandardSchema,
  type WizStandardSchemaDefinition,
  type WizStandardSchemaInput,
  type WizStandardSchemaIssue,
  type WizStandardSchemaOutput,
  WizStandardSchemaValidationError,
} from "@/lib/wiz/core/standard-schema"
import {
  isMutableBuiltInValue,
  isPlainArrayValue,
  type WizDeepReadonly,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { ownWizDiagnosticValue } from "@/lib/wiz/core/diagnostic-value"
import { describeWizValueType } from "@/lib/wiz/core/value-type"

export type WizWorldRuleAcceptedResult<TState, TEvent> = Readonly<{
  accepted: true
  state: TState | WizDeepReadonly<TState>
  events?: readonly (TEvent | WizDeepReadonly<TEvent>)[]
}>

export type WizWorldRuleRejectedResult<TReason extends string> = Readonly<{
  accepted: false
  /**
   * UI文言ではなく、呼び出し側が分岐・翻訳できる安定したsemantic reason。
   */
  reason: TReason
}>

export type WizWorldRuleResult<TState, TEvent, TReason extends string = never> =
  | WizWorldRuleAcceptedResult<TState, TEvent>
  | WizWorldRuleRejectedResult<TReason>

export type WizWorldRule<TState, TAction, TEvent, TReason extends string = never> = (
  state: WizDeepReadonly<TState>,
  action: WizDeepReadonly<TAction>,
  environment: WizWorldEnvironment,
) => WizWorldRuleResult<TState, TEvent, TReason>

export type WizWorldModuleDefinition<
  TState,
  TAction,
  TEvent = never,
  TReason extends string = never,
> = Readonly<{
  name: string
  accepts: (action: unknown) => action is TAction
  reduce: WizWorldRule<TState, TAction, TEvent, TReason>
}>

export type WizWorldSchemaModuleDefinition<
  TState,
  TSchema extends WizStandardSchemaDefinition,
  TEvent = never,
  TReason extends string = never,
> = Readonly<{
  name: string
  schema: TSchema
  reduce: WizWorldRule<TState, WizStandardSchemaOutput<TSchema>, TEvent, TReason>
}>

type WizErasedWorldModule = Readonly<{
  name: string
}>

type WizErasedWorldRule = (
  state: unknown,
  action: unknown,
  environment: WizWorldEnvironment,
) => WizWorldRuleResult<unknown, unknown, string>

const unmatchedWorldAction = Symbol("unmatched-world-action")
const worldConstructionToken = Symbol("WizWorldConstruction")

const assertWorldConstructionToken = (token: symbol): void => {
  if (token !== worldConstructionToken) {
    throw new TypeError("World values must be created by their public factories")
  }
}

type WizErasedWorldActionMatch =
  | typeof unmatchedWorldAction
  | Readonly<{
      kind: "matched"
      action: unknown
    }>
  | Readonly<{
      kind: "invalid"
      diagnostic:
        | Readonly<{
            kind: "schema"
            issues: readonly WizStandardSchemaIssue[]
          }>
        | Readonly<{
            kind: "ownership"
            path: string
            reason: string
            valueType: string
          }>
    }>

type WizErasedWorldActionMatcher = (action: unknown) => WizErasedWorldActionMatch

type WizErasedWorldModuleBehavior = Readonly<{
  match: WizErasedWorldActionMatcher
  reduce: WizErasedWorldRule
}>

const worldModuleBehaviors = new WeakMap<object, WizErasedWorldModuleBehavior>()

function assertStableWorldRejectionReason(
  reason: unknown,
  source: string,
): asserts reason is string {
  if (typeof reason !== "string") {
    throw new TypeError(`${source} reason must be a string`)
  }
  if (reason.trim().length === 0 || reason !== reason.trim()) {
    throw new RangeError(`${source} reason must not be blank or have surrounding whitespace`)
  }
}

const normalizeWorldRuleResult = <TState, TEvent, TReason extends string>(
  result: unknown,
  source: string,
): WizWorldRuleResult<TState, TEvent, TReason> => {
  if (typeof result !== "object" || result === null || !("accepted" in result)) {
    throw new TypeError(`${source} must return an accepted or rejected result object`)
  }
  if (result.accepted === false) {
    if (!("reason" in result)) {
      throw new TypeError(`${source} rejected result must have a reason`)
    }
    assertStableWorldRejectionReason(result.reason, `${source} rejected result`)
    return Object.freeze({
      accepted: false,
      reason: result.reason as TReason,
    })
  }
  if (result.accepted !== true || !("state" in result)) {
    throw new TypeError(`${source} accepted result must have accepted true and a state`)
  }
  const events = "events" in result && result.events !== undefined ? result.events : []
  if (!Array.isArray(events)) {
    throw new TypeError(`${source} accepted result events must be an array`)
  }
  return Object.freeze({
    accepted: true,
    events: Object.freeze([...events]) as readonly TEvent[],
    state: result.state as TState,
  })
}

const normalizeWorldPredicate = (result: unknown, source: string): boolean => {
  if (typeof result !== "boolean") {
    throw new TypeError(`${source} must return a boolean`)
  }
  return result
}

const requireWorldModuleBehavior = (module: WizErasedWorldModule): WizErasedWorldModuleBehavior => {
  const behavior = worldModuleBehaviors.get(module)
  if (!behavior) {
    throw new TypeError("World module must be created with WizWorldModule.define() or fromSchema()")
  }

  return behavior
}

const matchWorldModule = (
  module: WizErasedWorldModule,
  action: unknown,
): WizErasedWorldActionMatch => {
  return requireWorldModuleBehavior(module).match(action)
}

const reduceWorldModule = <TState, TReason extends string>(
  module: WizErasedWorldModule,
  state: TState | WizDeepReadonly<TState>,
  action: unknown,
  environment: WizWorldEnvironment,
): WizWorldRuleResult<TState, unknown, TReason> => {
  const behavior = requireWorldModuleBehavior(module)
  return normalizeWorldRuleResult<TState, unknown, TReason>(
    behavior.reduce(state, action, environment),
    `World module "${module.name}" reducer`,
  )
}

export type WizWorldEnvironmentDefinition = Readonly<{
  now?: () => number
  random?: () => number
  nextId?: () => string
}>

export type WizWorldEnvironmentSource = "nextId" | "now" | "random"

type WizWorldEnvironmentReading =
  | Readonly<{
      source: "nextId"
      value: string
    }>
  | Readonly<{
      source: "now" | "random"
      value: number
    }>

type WizWorldEnvironmentBehavior = {
  readonly sources: Readonly<{
    nextId: () => string
    now: () => number
    random: () => number
  }>
  readonly replay: {
    nextId: string[]
    now: number[]
    random: number[]
  }
  readonly transactions: WizWorldEnvironmentReading[][]
}

type WizWorldEnvironmentTransaction = Readonly<{
  commit: () => void
  environment: WizWorldEnvironment
  rollback: () => void
}>

const authenticWorldEnvironments = new WeakSet<object>()
const worldEnvironmentBehaviors = new WeakMap<object, WizWorldEnvironmentBehavior>()

export class WizWorldEnvironmentValueError extends RangeError {
  override readonly name = "WizWorldEnvironmentValueError"
  readonly source: WizWorldEnvironmentSource
  readonly value: unknown

  constructor(source: WizWorldEnvironmentSource, value: unknown, expectation: string) {
    super(`World environment ${source}() must return ${expectation}`)
    this.source = source
    this.value = ownWizDiagnosticValue(value)
    Object.freeze(this)
  }
}

export type WizWorldStateOwnershipDefinition<TState> = Readonly<{
  /**
   * World境界でstateの所有権を取得する。
   *
   * 戻り値はWizのdeep immutable contractを満たさなければならない。
   */
  ownState: (state: TState | WizDeepReadonly<TState>) => TState | WizDeepReadonly<TState>
}>

const authenticWorldStateOwnershipStrategies = new WeakSet<object>()

const isPlainObject = (value: object): boolean => {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export class WizWorldValueOwnershipError extends TypeError {
  override readonly name = "WizWorldValueOwnershipError"
  readonly path: string
  readonly valueType: string
  readonly reason: string

  constructor(path: string, value: unknown, reason: string) {
    const valueType = describeWizValueType(value)
    super(`Cannot own world value at ${path} (${valueType}): ${reason}`)
    this.path = path
    this.valueType = valueType
    this.reason = reason
    Object.freeze(this)
  }
}

const propertyPath = (parent: string, key: PropertyKey): string => {
  if (typeof key === "symbol") {
    return `${parent}[${String(key)}]`
  }
  const stringKey = String(key)
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(stringKey)
    ? `${parent}.${stringKey}`
    : `${parent}[${JSON.stringify(stringKey)}]`
}

const assertDeepImmutableWorldValueUnchecked = (
  input: unknown,
  path: string,
  visited: WeakSet<object>,
): void => {
  if (typeof input === "function") {
    throw new WizWorldValueOwnershipError(path, input, "function properties are not immutable data")
  }
  if (typeof input !== "object" || input === null) {
    return
  }

  if (visited.has(input)) {
    return
  }
  visited.add(input)

  if (!isPlainArrayValue(input) && !isPlainObject(input) && isMutableBuiltInValue(input)) {
    throw new WizWorldValueOwnershipError(
      path,
      input,
      "mutable built-in instances are not immutable data",
    )
  }
  if (!isPlainArrayValue(input) && !isPlainObject(input) && !WizImmutableValue.is(input)) {
    throw new WizWorldValueOwnershipError(
      path,
      input,
      "class instances must declare the WizImmutableValue contract",
    )
  }
  if (!Object.isFrozen(input)) {
    throw new WizWorldValueOwnershipError(
      path,
      input,
      "class instances and their nested values must be deeply immutable",
    )
  }

  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key)
    if (!descriptor) {
      continue
    }
    if (!("value" in descriptor)) {
      throw new WizWorldValueOwnershipError(
        propertyPath(path, key),
        input,
        "accessor properties are not supported by deep immutable ownership",
      )
    }
    assertDeepImmutableWorldValue(descriptor.value, propertyPath(path, key), visited)
  }
}

const assertDeepImmutableWorldValue = (
  input: unknown,
  path: string,
  visited: WeakSet<object>,
): void => {
  try {
    assertDeepImmutableWorldValueUnchecked(input, path, visited)
  } catch (error) {
    if (error instanceof WizWorldValueOwnershipError) {
      throw error
    }
    throw new WizWorldValueOwnershipError(path, input, "value could not be inspected safely")
  }
}

const createDeepImmutableStateOwner = <TState>(): ((
  state: TState | WizDeepReadonly<TState>,
) => WizDeepReadonly<TState>) => {
  /**
   * このownerが生成済みの値だけを再利用する。
   *
   * 呼び出し側がfreezeしたplain objectも初回はcopyするため、Worldが所有するstateと
   * 呼び出し側のstateが同一参照にならない。一方、dispatchへWorld自身のstateを渡した
   * 場合は同一の不変値を安全に再利用できる。
   */
  const ownedObjects = new WeakSet<object>()

  const own = (input: unknown, path: string, clones: WeakMap<object, object>): unknown => {
    try {
      return ownUnchecked(input, path, clones)
    } catch (error) {
      if (error instanceof WizWorldValueOwnershipError) {
        throw error
      }
      throw new WizWorldValueOwnershipError(path, input, "value could not be inspected safely")
    }
  }

  // 所有済みの子と素の値はそのまま返す。経路の文字列は検査するときだけ作る
  // （状態の大半は前の状態と共有されるので、要素ごとに経路を組むと重くなる）。
  const ownChild = (
    child: unknown,
    path: string,
    key: PropertyKey,
    clones: WeakMap<object, object>,
  ): unknown => {
    if (child === null || (typeof child !== "object" && typeof child !== "function")) {
      return child
    }
    if (typeof child === "object" && ownedObjects.has(child)) {
      return child
    }
    return own(child, propertyPath(path, key), clones)
  }

  const ownUnchecked = (input: unknown, path: string, clones: WeakMap<object, object>): unknown => {
    if (typeof input === "function") {
      throw new WizWorldValueOwnershipError(
        path,
        input,
        "function properties are not immutable data",
      )
    }
    if (typeof input !== "object" || input === null) {
      return input
    }

    const value = input as object
    if (ownedObjects.has(value)) {
      return value
    }

    const existingClone = clones.get(value)
    if (existingClone) {
      return existingClone
    }

    if (isPlainArrayValue(value)) {
      const clone: unknown[] = []
      clone.length = value.length
      clones.set(value, clone)

      for (const key of Reflect.ownKeys(value)) {
        if (key === "length") {
          continue
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key)
        if (!descriptor) {
          continue
        }
        if (!("value" in descriptor)) {
          throw new WizWorldValueOwnershipError(
            propertyPath(path, key),
            value,
            "accessor properties are not supported by deep immutable ownership",
          )
        }
        Object.defineProperty(clone, key, {
          configurable: false,
          enumerable: descriptor.enumerable,
          value: ownChild(descriptor.value, path, key, clones),
          writable: false,
        })
      }

      Object.freeze(clone)
      ownedObjects.add(clone)
      return clone
    }

    if (isPlainObject(value)) {
      const clone = Object.create(Object.getPrototypeOf(value)) as Record<PropertyKey, unknown>
      clones.set(value, clone)

      for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)
        if (!descriptor) {
          continue
        }
        if (!("value" in descriptor)) {
          throw new WizWorldValueOwnershipError(
            propertyPath(path, key),
            value,
            "accessor properties are not supported by deep immutable ownership",
          )
        }
        Object.defineProperty(clone, key, {
          configurable: false,
          enumerable: descriptor.enumerable,
          value: ownChild(descriptor.value, path, key, clones),
          writable: false,
        })
      }

      Object.freeze(clone)
      ownedObjects.add(clone)
      return clone
    }

    if (isMutableBuiltInValue(value)) {
      throw new WizWorldValueOwnershipError(
        path,
        value,
        "mutable built-in instances are not immutable data",
      )
    }

    if (!Object.isFrozen(value)) {
      throw new WizWorldValueOwnershipError(path, value, "class instances must be deeply immutable")
    }
    if (!WizImmutableValue.is(value)) {
      throw new WizWorldValueOwnershipError(
        path,
        value,
        "class instances must declare the WizImmutableValue contract",
      )
    }

    // 宣言済みの不変クラスはprototypeを壊すcloneを行わず、
    // deep immutable atomとして扱う。
    assertDeepImmutableWorldValue(value, path, new WeakSet())
    ownedObjects.add(value)
    return value
  }

  return (state): WizDeepReadonly<TState> =>
    own(state, "$", new WeakMap()) as WizDeepReadonly<TState>
}

const ownWorldBoundaryValue = createDeepImmutableStateOwner<unknown>()

/**
 * World境界におけるstate所有権取得を表す、不変なstrategy。
 *
 * 既定strategyはplain object/arrayを再帰的にcopy + freezeする。
 * `WizImmutableValue` contractを宣言したclassだけprototypeを保って共有する。
 */
export class WizWorldStateOwnership<TState> {
  readonly own: (state: TState | WizDeepReadonly<TState>) => WizDeepReadonly<TState>
  readonly #ownState: (state: TState | WizDeepReadonly<TState>) => TState | WizDeepReadonly<TState>

  private constructor(
    token: symbol,
    definition: WizWorldStateOwnershipDefinition<TState>,
    hasIndependentOutputValidation: boolean,
  ) {
    assertWorldConstructionToken(token)
    if (typeof definition.ownState !== "function") {
      throw new TypeError("World state ownership ownState must be a function")
    }
    const ownState = definition.ownState
    this.#ownState = Object.freeze(
      (state: TState | WizDeepReadonly<TState>): TState | WizDeepReadonly<TState> => {
        const ownedState = ownState(state)
        if (hasIndependentOutputValidation) {
          assertDeepImmutableWorldValue(ownedState, "$", new WeakSet())
        }

        return ownedState
      },
    )
    this.own = Object.freeze((state: TState | WizDeepReadonly<TState>): WizDeepReadonly<TState> => {
      if (!authenticWorldStateOwnershipStrategies.has(this)) {
        throw new TypeError(
          "World state ownership must be created with WizWorldStateOwnership.deepImmutable() or define()",
        )
      }

      return this.#ownState(state) as WizDeepReadonly<TState>
    })
    authenticWorldStateOwnershipStrategies.add(this)
    Object.freeze(this)
  }

  static readonly deepImmutable = <TState>(): WizWorldStateOwnership<TState> =>
    new WizWorldStateOwnership(
      worldConstructionToken,
      {
        ownState: createDeepImmutableStateOwner<TState>(),
      },
      false,
    )

  static readonly define = <TState>(
    definition: WizWorldStateOwnershipDefinition<TState>,
  ): WizWorldStateOwnership<TState> =>
    new WizWorldStateOwnership(worldConstructionToken, definition, true)
}

/**
 * world state ownershipのfactory identityを検証する内部境界。
 *
 * @internal
 */
export function assertAuthenticWizWorldStateOwnership(
  stateOwnership: unknown,
): asserts stateOwnership is WizWorldStateOwnership<unknown> {
  if (
    typeof stateOwnership !== "object" ||
    stateOwnership === null ||
    !authenticWorldStateOwnershipStrategies.has(stateOwnership)
  ) {
    throw new TypeError(
      "World state ownership must be created with WizWorldStateOwnership.deepImmutable() or define()",
    )
  }
}

Object.freeze(WizWorldStateOwnership.prototype)
Object.freeze(WizWorldStateOwnership)

const ownWorldState = <TState>(
  stateOwnership: WizWorldStateOwnership<TState>,
  state: TState | WizDeepReadonly<TState>,
): WizDeepReadonly<TState> => {
  assertAuthenticWizWorldStateOwnership(stateOwnership)
  return stateOwnership.own(state)
}

/**
 * 実行時依存を一か所へ集約した不変オブジェクト。
 *
 * reducer 自身は純粋関数のまま保ち、テストでは決定論的な関数を注入する。
 */
export class WizWorldEnvironment {
  declare private readonly worldEnvironmentType: true
  readonly now: () => number
  readonly random: () => number
  readonly nextId: () => string

  private constructor(token: symbol, definition: WizWorldEnvironmentDefinition) {
    assertWorldConstructionToken(token)
    worldEnvironmentBehaviors.set(this, {
      replay: {
        nextId: [],
        now: [],
        random: [],
      },
      sources: Object.freeze({
        nextId: definition.nextId ?? (() => crypto.randomUUID()),
        now: definition.now ?? Date.now,
        random: definition.random ?? Math.random,
      }),
      transactions: [],
    })
    this.now = Object.freeze(() => readWorldEnvironmentNumber(this, "now"))
    this.random = Object.freeze(() => readWorldEnvironmentNumber(this, "random"))
    this.nextId = Object.freeze(() => readWorldEnvironmentId(this))
    authenticWorldEnvironments.add(this)
    Object.freeze(this)
  }

  static create(definition: WizWorldEnvironmentDefinition = {}): WizWorldEnvironment {
    return new WizWorldEnvironment(worldConstructionToken, definition)
  }

  /** @internal world composition boundary only. */
  static require(value: unknown, label: string): void {
    if (typeof value !== "object" || value === null || !authenticWorldEnvironments.has(value)) {
      throw new TypeError(`${label} must be created with WizWorldEnvironment.create()`)
    }
  }
}

const requireWorldEnvironmentBehavior = (
  environment: WizWorldEnvironment,
): WizWorldEnvironmentBehavior => {
  if (!authenticWorldEnvironments.has(environment)) {
    throw new TypeError("World environment must be created with WizWorldEnvironment.create()")
  }
  const behavior = worldEnvironmentBehaviors.get(environment)
  if (!behavior) {
    throw new TypeError("World environment behavior is unavailable")
  }

  return behavior
}

const recordWorldEnvironmentReading = (
  behavior: WizWorldEnvironmentBehavior,
  reading: WizWorldEnvironmentReading,
): void => {
  behavior.transactions.at(-1)?.push(Object.freeze(reading))
}

const readWorldEnvironmentNumber = (
  environment: WizWorldEnvironment,
  source: "now" | "random",
): number => {
  const behavior = requireWorldEnvironmentBehavior(environment)
  const replayed = behavior.replay[source].shift()
  const value = replayed ?? behavior.sources[source]()
  if (!Number.isFinite(value) || (source === "random" && (value < 0 || value >= 1))) {
    throw new WizWorldEnvironmentValueError(
      source,
      value,
      source === "random" ? "a finite number in the range 0 <= value < 1" : "a finite number",
    )
  }
  recordWorldEnvironmentReading(behavior, { source, value })

  return value
}

const readWorldEnvironmentId = (environment: WizWorldEnvironment): string => {
  const behavior = requireWorldEnvironmentBehavior(environment)
  const replayed = behavior.replay.nextId.shift()
  const value = replayed ?? behavior.sources.nextId()
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) {
    throw new WizWorldEnvironmentValueError(
      "nextId",
      value,
      "a non-empty string without surrounding whitespace",
    )
  }
  recordWorldEnvironmentReading(behavior, { source: "nextId", value })

  return value
}

const beginWorldEnvironmentTransaction = (
  environment: WizWorldEnvironment,
): WizWorldEnvironmentTransaction => {
  const behavior = requireWorldEnvironmentBehavior(environment)
  const readings: WizWorldEnvironmentReading[] = []
  behavior.transactions.push(readings)
  let completed = false

  const finish = (rollback: boolean): void => {
    if (completed) {
      throw new TypeError("World environment transaction is already complete")
    }
    if (behavior.transactions.at(-1) !== readings) {
      throw new TypeError("World environment transactions must complete in stack order")
    }
    behavior.transactions.pop()
    completed = true
    if (rollback) {
      for (const reading of [...readings].reverse()) {
        if (reading.source === "nextId") {
          behavior.replay.nextId.unshift(reading.value)
        } else if (reading.source === "now") {
          behavior.replay.now.unshift(reading.value)
        } else {
          behavior.replay.random.unshift(reading.value)
        }
      }
      return
    }
    const parent = behavior.transactions.at(-1)
    if (parent) {
      parent.push(...readings)
    }
  }

  return Object.freeze({
    commit: Object.freeze(() => finish(false)),
    environment,
    rollback: Object.freeze(() => finish(true)),
  })
}

/**
 * action の判定と純粋な状態遷移をまとめる、不変な拡張単位。
 */
export class WizWorldModule<
  TState,
  TAction,
  TEvent = never,
  TReason extends string = never,
> implements WizErasedWorldModule {
  declare private readonly stateType: (state: TState) => TState
  declare private readonly actionType: TAction
  declare private readonly eventType: TEvent
  declare private readonly reasonType: TReason
  readonly accepts: (action: unknown) => action is TAction
  readonly name: string

  private constructor(definition: {
    readonly token: symbol
    readonly name: string
    readonly match: WizErasedWorldActionMatcher
    readonly reduce: WizErasedWorldRule
  }) {
    assertWorldConstructionToken(definition.token)
    const match = definition.match
    const reduce = definition.reduce
    this.name = definition.name
    this.accepts = Object.freeze((action: unknown): action is TAction => {
      const actionMatch = match(action)

      return actionMatch !== unmatchedWorldAction && actionMatch.kind === "matched"
    })
    worldModuleBehaviors.set(
      this,
      Object.freeze({
        match,
        reduce,
      }),
    )
    Object.freeze(this)
  }

  static define<TState, TAction, TEvent = never, TReason extends string = never>(
    definition: WizWorldModuleDefinition<TState, TAction, TEvent, TReason>,
  ): WizWorldModule<TState, TAction, TEvent, TReason> {
    if (definition.name.trim().length === 0 || definition.name !== definition.name.trim()) {
      throw new RangeError(
        "World module name must not be empty or have leading/trailing whitespace",
      )
    }
    const accepts = definition.accepts
    const name = definition.name
    const reduce = definition.reduce
    return new WizWorldModule({
      match: (action) => {
        let ownedAction: unknown
        try {
          ownedAction = ownWorldBoundaryValue(action)
        } catch (error) {
          if (error instanceof WizWorldValueOwnershipError) {
            return Object.freeze({
              diagnostic: Object.freeze({
                kind: "ownership",
                path: error.path,
                reason: error.reason,
                valueType: error.valueType,
              }),
              kind: "invalid",
            })
          }
          throw error
        }
        return normalizeWorldPredicate(accepts(ownedAction), `World module "${name}" accepts`)
          ? Object.freeze({ action: ownedAction, kind: "matched" })
          : unmatchedWorldAction
      },
      name,
      reduce: reduce as WizErasedWorldRule,
      token: worldConstructionToken,
    })
  }

  static fromSchema<
    TState,
    TSchema extends WizStandardSchemaDefinition,
    TEvent = never,
    TReason extends string = never,
  >(
    definition: WizWorldSchemaModuleDefinition<TState, TSchema, TEvent, TReason>,
  ): WizWorldModule<TState, WizDeepReadonly<WizStandardSchemaInput<TSchema>>, TEvent, TReason> {
    if (definition.name.trim().length === 0 || definition.name !== definition.name.trim()) {
      throw new RangeError(
        "World module name must not be empty or have leading/trailing whitespace",
      )
    }
    const name = definition.name
    const reduce = definition.reduce
    const schema = WizStandardSchema.capture(
      definition.schema,
      `World action schema for module "${name}"`,
    )

    return new WizWorldModule({
      match: (action) => {
        try {
          const validatedAction = schema.validate(action)
          return Object.freeze({
            action: ownWorldBoundaryValue(validatedAction),
            kind: "matched",
          })
        } catch (error) {
          if (error instanceof WizStandardSchemaValidationError) {
            return Object.freeze({
              diagnostic: Object.freeze({
                issues: error.issues,
                kind: "schema",
              }),
              kind: "invalid",
            })
          }
          if (error instanceof WizWorldValueOwnershipError) {
            return Object.freeze({
              diagnostic: Object.freeze({
                kind: "ownership",
                path: error.path,
                reason: error.reason,
                valueType: error.valueType,
              }),
              kind: "invalid",
            })
          }

          throw error
        }
      },
      name,
      reduce: reduce as WizErasedWorldRule,
      token: worldConstructionToken,
    })
  }
}

export type WizWorldEventReactionDefinition<
  TState,
  TObservedEvent,
  TEmittedEvent = never,
  TReason extends string = never,
> = Readonly<{
  name: string
  accepts: (event: unknown) => event is TObservedEvent
  react: WizWorldRule<TState, TObservedEvent, TEmittedEvent, TReason>
}>

type WizErasedWorldEventReaction = Readonly<{
  name: string
}>

type WizErasedWorldEventReactionBehavior = Readonly<{
  accepts: (event: unknown) => boolean
  react: WizErasedWorldRule
}>

const worldEventReactionBehaviors = new WeakMap<object, WizErasedWorldEventReactionBehavior>()

const requireWorldEventReactionBehavior = (
  reaction: WizErasedWorldEventReaction,
): WizErasedWorldEventReactionBehavior => {
  const behavior = worldEventReactionBehaviors.get(reaction)
  if (!behavior) {
    throw new TypeError("World event reaction must be created with WizWorldEventReaction.define()")
  }

  return behavior
}

const reduceWorldEventReaction = <TState, TReason extends string>(
  reaction: WizErasedWorldEventReaction,
  state: TState | WizDeepReadonly<TState>,
  event: unknown,
  environment: WizWorldEnvironment,
): WizWorldRuleResult<TState, unknown, TReason> => {
  const behavior = requireWorldEventReactionBehavior(reaction)
  return normalizeWorldRuleResult<TState, unknown, TReason>(
    behavior.react(state, event, environment),
    `World event reaction "${reaction.name}"`,
  )
}

/**
 * command handlerが発行したsemantic eventへ反応する、不変で独立したsystem。
 *
 * 複数reactionはworldへの登録順で実行される。reactionは受け取ったstate/eventを
 * 変更せず、新しいstateと後続eventを返す。
 */
export class WizWorldEventReaction<
  TState,
  TObservedEvent,
  TEmittedEvent = never,
  TReason extends string = never,
> implements WizErasedWorldEventReaction {
  readonly accepts: (event: unknown) => event is TObservedEvent
  readonly name: string
  declare private readonly stateType: (state: TState) => TState
  declare private readonly observedEventType: TObservedEvent
  declare private readonly emittedEventType: TEmittedEvent
  declare private readonly reasonType: TReason

  private constructor(
    token: symbol,
    definition: {
      readonly name: string
      readonly accepts: (event: unknown) => event is TObservedEvent
      readonly react: WizWorldRule<TState, TObservedEvent, TEmittedEvent, TReason>
    },
  ) {
    assertWorldConstructionToken(token)
    const accepts = definition.accepts
    const react = definition.react
    const acceptsEvent = Object.freeze((event: unknown): event is TObservedEvent =>
      normalizeWorldPredicate(accepts(event), `World event reaction "${definition.name}" accepts`),
    )
    const reactToEvent = Object.freeze(
      (
        state: WizDeepReadonly<TState>,
        event: WizDeepReadonly<TObservedEvent>,
        environment: WizWorldEnvironment,
      ): WizWorldRuleResult<TState, TEmittedEvent, TReason> => react(state, event, environment),
    )
    this.name = definition.name
    this.accepts = acceptsEvent
    worldEventReactionBehaviors.set(
      this,
      Object.freeze({
        accepts: acceptsEvent,
        react: reactToEvent as WizErasedWorldRule,
      }),
    )
    Object.freeze(this)
  }

  static define<TState, TObservedEvent, TEmittedEvent = never, TReason extends string = never>(
    definition: WizWorldEventReactionDefinition<TState, TObservedEvent, TEmittedEvent, TReason>,
  ): WizWorldEventReaction<TState, TObservedEvent, TEmittedEvent, TReason> {
    if (definition.name.trim().length === 0 || definition.name !== definition.name.trim()) {
      throw new RangeError(
        "World event reaction name must not be empty or have leading/trailing whitespace",
      )
    }
    const accepts = definition.accepts
    const react = definition.react
    return new WizWorldEventReaction<TState, TObservedEvent, TEmittedEvent, TReason>(
      worldConstructionToken,
      {
        accepts,
        name: definition.name,
        react,
      },
    )
  }
}

export type WizWorldReactionPolicyDefinition = Readonly<{
  maximumReactionSteps: number
}>

const authenticWorldReactionPolicies = new WeakSet<object>()

/**
 * 一dispatch内で許可するreaction成功回数を定める、不変な安全境界。
 *
 * event typeの反復だけではcycleと見なさないため、有限のcountdownなどは正常に完走する。
 * 停止しないcascadeは上限到達時にtransaction全体をrollbackする。
 */
export class WizWorldReactionPolicy {
  declare private readonly worldReactionPolicyType: true
  readonly maximumReactionSteps: number

  private constructor(token: symbol, definition: WizWorldReactionPolicyDefinition) {
    assertWorldConstructionToken(token)
    if (
      !Number.isSafeInteger(definition.maximumReactionSteps) ||
      definition.maximumReactionSteps < 1
    ) {
      throw new RangeError("World maximum reaction steps must be a positive safe integer")
    }
    this.maximumReactionSteps = definition.maximumReactionSteps
    authenticWorldReactionPolicies.add(this)
    Object.freeze(this)
  }

  static create(
    definition: WizWorldReactionPolicyDefinition = Object.freeze({
      maximumReactionSteps: 1_024,
    }),
  ): WizWorldReactionPolicy {
    return new WizWorldReactionPolicy(worldConstructionToken, definition)
  }
}

const assertAuthenticWorldReactionPolicy = (reactionPolicy: WizWorldReactionPolicy): void => {
  if (!authenticWorldReactionPolicies.has(reactionPolicy)) {
    throw new TypeError(
      "World reaction policy must be created with WizWorldReactionPolicy.create()",
    )
  }
}

export type WizWorldActionValidationDiagnostic =
  | Readonly<{
      kind: "schema"
      moduleName: string
      issues: readonly WizStandardSchemaIssue[]
    }>
  | Readonly<{
      kind: "ownership"
      moduleName: string
      path: string
      reason: string
      valueType: string
    }>

export type WizWorldDispatchError<TReason extends string = never> =
  | Readonly<{
      code: "UNHANDLED_ACTION"
      actionType: string
    }>
  | Readonly<{
      code: "AMBIGUOUS_ACTION"
      actionType: string
      moduleNames: readonly string[]
    }>
  | Readonly<{
      code: "ACTION_REJECTED"
      actionType: string
      reason: TReason
    }>
  | Readonly<{
      code: "ACTION_VALIDATION_FAILED"
      actionType: string
      diagnostics: readonly WizWorldActionValidationDiagnostic[]
    }>
  | Readonly<{
      code: "REACTION_REJECTED"
      eventType: string
      reactionName: string
      reason: TReason
    }>
  | Readonly<{
      code: "REACTION_LIMIT_EXCEEDED"
      eventType: string
      maximumReactionSteps: number
      reactionNames: readonly string[]
    }>

export class WizWorldDispatchResult<TState, TEvent, TReason extends string = never> {
  readonly accepted: boolean
  readonly state: WizDeepReadonly<TState>
  readonly events: readonly WizDeepReadonly<TEvent>[]
  readonly error: WizWorldDispatchError<TReason> | undefined

  private constructor(
    token: symbol,
    data: {
      accepted: boolean
      state: TState | WizDeepReadonly<TState>
      events?: readonly (TEvent | WizDeepReadonly<TEvent>)[]
      error?: WizWorldDispatchError<TReason>
    },
  ) {
    assertWorldConstructionToken(token)
    this.accepted = data.accepted
    this.state = data.state as WizDeepReadonly<TState>
    this.events = ownWorldBoundaryValue(data.events ?? []) as readonly WizDeepReadonly<TEvent>[]
    this.error =
      data.error === undefined
        ? undefined
        : (ownWorldBoundaryValue(data.error) as WizWorldDispatchError<TReason>)
    Object.freeze(this)
  }

  isAccepted(): this is this & Readonly<{ accepted: true; error: undefined }> {
    return this.accepted
  }

  isRejected(): this is this &
    Readonly<{
      accepted: false
      error: WizWorldDispatchError<TReason>
    }> {
    return !this.accepted
  }

  static readonly accepted = <TState, TEvent, TReason extends string = never>(
    state: TState | WizDeepReadonly<TState>,
    events: readonly (TEvent | WizDeepReadonly<TEvent>)[] = [],
    stateOwnership: WizWorldStateOwnership<TState> = WizWorldStateOwnership.deepImmutable(),
  ): WizWorldDispatchResult<TState, TEvent, TReason> =>
    new WizWorldDispatchResult<TState, TEvent, TReason>(worldConstructionToken, {
      accepted: true,
      events,
      state: ownWorldState(stateOwnership, state),
    })

  static readonly rejected = <TState, TEvent, TReason extends string = never>(
    state: TState | WizDeepReadonly<TState>,
    action: unknown,
    stateOwnership: WizWorldStateOwnership<TState> = WizWorldStateOwnership.deepImmutable(),
  ): WizWorldDispatchResult<TState, TEvent, TReason> =>
    new WizWorldDispatchResult<TState, TEvent, TReason>(worldConstructionToken, {
      accepted: false,
      error: Object.freeze({
        actionType: getActionType(action),
        code: "UNHANDLED_ACTION",
      }),
      state: ownWorldState(stateOwnership, state),
    })

  static readonly ambiguous = <TState, TEvent, TReason extends string = never>(
    state: TState | WizDeepReadonly<TState>,
    action: unknown,
    moduleNames: readonly string[],
    stateOwnership: WizWorldStateOwnership<TState> = WizWorldStateOwnership.deepImmutable(),
  ): WizWorldDispatchResult<TState, TEvent, TReason> =>
    new WizWorldDispatchResult<TState, TEvent, TReason>(worldConstructionToken, {
      accepted: false,
      error: Object.freeze({
        actionType: getActionType(action),
        code: "AMBIGUOUS_ACTION",
        moduleNames: Object.freeze([...moduleNames]),
      }),
      state: ownWorldState(stateOwnership, state),
    })

  static readonly rejectedByRule = <TState, TEvent, TReason extends string>(
    state: TState | WizDeepReadonly<TState>,
    action: unknown,
    reason: TReason,
    stateOwnership: WizWorldStateOwnership<TState> = WizWorldStateOwnership.deepImmutable(),
  ): WizWorldDispatchResult<TState, TEvent, TReason> => {
    assertStableWorldRejectionReason(reason, "World dispatch rejection")
    return new WizWorldDispatchResult<TState, TEvent, TReason>(worldConstructionToken, {
      accepted: false,
      error: Object.freeze({
        actionType: getActionType(action),
        code: "ACTION_REJECTED",
        reason,
      }),
      state: ownWorldState(stateOwnership, state),
    })
  }

  static readonly invalidAction = <TState, TEvent, TReason extends string = never>(
    state: TState | WizDeepReadonly<TState>,
    action: unknown,
    diagnostics: readonly WizWorldActionValidationDiagnostic[],
    stateOwnership: WizWorldStateOwnership<TState> = WizWorldStateOwnership.deepImmutable(),
  ): WizWorldDispatchResult<TState, TEvent, TReason> =>
    new WizWorldDispatchResult<TState, TEvent, TReason>(worldConstructionToken, {
      accepted: false,
      error: Object.freeze({
        actionType: getActionType(action),
        code: "ACTION_VALIDATION_FAILED",
        diagnostics: Object.freeze([...diagnostics]),
      }),
      state: ownWorldState(stateOwnership, state),
    })

  static readonly rejectedByReaction = <TState, TEvent, TReason extends string>(
    state: TState | WizDeepReadonly<TState>,
    event: unknown,
    reactionName: string,
    reason: TReason,
    stateOwnership: WizWorldStateOwnership<TState> = WizWorldStateOwnership.deepImmutable(),
  ): WizWorldDispatchResult<TState, TEvent, TReason> => {
    assertStableWorldRejectionReason(reason, "World reaction rejection")
    return new WizWorldDispatchResult<TState, TEvent, TReason>(worldConstructionToken, {
      accepted: false,
      error: Object.freeze({
        code: "REACTION_REJECTED",
        eventType: getActionType(event),
        reactionName,
        reason,
      }),
      state: ownWorldState(stateOwnership, state),
    })
  }

  static readonly reactionLimitExceeded = <TState, TEvent, TReason extends string = never>(
    state: TState | WizDeepReadonly<TState>,
    event: unknown,
    maximumReactionSteps: number,
    reactionNames: readonly string[],
    stateOwnership: WizWorldStateOwnership<TState> = WizWorldStateOwnership.deepImmutable(),
  ): WizWorldDispatchResult<TState, TEvent, TReason> =>
    new WizWorldDispatchResult<TState, TEvent, TReason>(worldConstructionToken, {
      accepted: false,
      error: Object.freeze({
        code: "REACTION_LIMIT_EXCEEDED",
        eventType: getActionType(event),
        maximumReactionSteps,
        reactionNames: Object.freeze([...reactionNames]),
      }),
      state: ownWorldState(stateOwnership, state),
    })
}

Object.freeze(WizWorldDispatchResult.prototype)
Object.freeze(WizWorldDispatchResult)

const getActionType = (action: unknown): string => {
  if (typeof action !== "object" || action === null) {
    return typeof action
  }
  try {
    const descriptor = Object.getOwnPropertyDescriptor(action, "type")
    return descriptor && "value" in descriptor && typeof descriptor.value === "string"
      ? descriptor.value
      : typeof action
  } catch {
    return typeof action
  }
}

export class WizWorldCompositionError extends Error {
  override readonly name = "WizWorldCompositionError"
  readonly code: "DUPLICATE_MODULE_NAME" | "DUPLICATE_REACTION_NAME"
  readonly componentName: string

  constructor(code: "DUPLICATE_MODULE_NAME" | "DUPLICATE_REACTION_NAME", componentName: string) {
    const componentKind = code === "DUPLICATE_MODULE_NAME" ? "module" : "event reaction"
    super(`World ${componentKind} "${componentName}" is already registered`)
    this.code = code
    this.componentName = componentName
    Object.freeze(this)
  }
}

type WizWorldQueuedEvent = Readonly<{
  event: unknown
  reactionNames: readonly string[]
}>

type WizWorldReactionExecutionAccepted<TState> = Readonly<{
  accepted: true
  events: readonly unknown[]
  state: WizDeepReadonly<TState>
}>

type WizWorldReactionExecutionRejected<TReason extends string> = Readonly<{
  accepted: false
  event: unknown
  reactionName: string
  reason: TReason
}>

type WizWorldReactionExecutionLimit = Readonly<{
  accepted: false
  event: unknown
  reactionNames: readonly string[]
  type: "limit"
}>

type WizWorldReactionExecution<TState, TReason extends string> =
  | WizWorldReactionExecutionAccepted<TState>
  | WizWorldReactionExecutionRejected<TReason>
  | WizWorldReactionExecutionLimit

type WizWorldReactionExecutionContext<TState> = Readonly<{
  environment: WizWorldEnvironment
  maximumReactionSteps: number
  reactions: readonly WizErasedWorldEventReaction[]
  stateOwnership: WizWorldStateOwnership<TState>
}>

type WizWorldReactionExecutionProgress<TState> = Readonly<{
  events: readonly unknown[]
  queue: readonly WizWorldQueuedEvent[]
  reactionIndex: number
  reactionSteps: number
  state: WizDeepReadonly<TState>
}>

const getWorldEventReactionBehavior = (
  reaction: WizErasedWorldEventReaction,
): WizErasedWorldEventReactionBehavior => requireWorldEventReactionBehavior(reaction)

const getReactionTrace = (
  reactionNames: readonly string[],
  reaction: WizErasedWorldEventReaction,
): readonly string[] => Object.freeze([...reactionNames, reaction.name])

const ownQueuedReactionEvents = (
  events: readonly unknown[],
  reactionNames: readonly string[],
): readonly WizWorldQueuedEvent[] =>
  Object.freeze(
    events.map((event) =>
      Object.freeze({
        event: ownWorldBoundaryValue(event),
        reactionNames,
      }),
    ),
  )

const createWorldReactionExecutionProgress = <TState>(
  context: WizWorldReactionExecutionContext<TState>,
  state: TState | WizDeepReadonly<TState>,
  events: readonly unknown[],
): WizWorldReactionExecutionProgress<TState> =>
  Object.freeze({
    events: Object.freeze([]),
    queue: ownQueuedReactionEvents(events, Object.freeze([])),
    reactionIndex: 0,
    reactionSteps: 0,
    state: ownWorldState(context.stateOwnership, state),
  })

const runWorldReactions = <TState, TReason extends string>(
  context: WizWorldReactionExecutionContext<TState>,
  state: TState | WizDeepReadonly<TState>,
  events: readonly unknown[],
): WizWorldReactionExecution<TState, TReason> => {
  let progress = createWorldReactionExecutionProgress(context, state, events)

  while (true) {
    const queuedEvent = progress.queue[0]
    if (!queuedEvent) {
      return Object.freeze({
        accepted: true,
        events: progress.events,
        state: progress.state,
      })
    }
    const reaction = context.reactions[progress.reactionIndex]
    if (!reaction) {
      progress = Object.freeze({
        ...progress,
        events: Object.freeze([...progress.events, queuedEvent.event]),
        queue: Object.freeze(progress.queue.slice(1)),
        reactionIndex: 0,
      })
      continue
    }
    const behavior = getWorldEventReactionBehavior(reaction)
    if (!behavior.accepts(queuedEvent.event)) {
      progress = Object.freeze({
        ...progress,
        reactionIndex: progress.reactionIndex + 1,
      })
      continue
    }
    if (progress.reactionSteps >= context.maximumReactionSteps) {
      const limit: WizWorldReactionExecutionLimit = Object.freeze({
        accepted: false,
        event: queuedEvent.event,
        reactionNames: getReactionTrace(queuedEvent.reactionNames, reaction),
        type: "limit",
      })

      return limit
    }
    const reactionResult = reduceWorldEventReaction<TState, TReason>(
      reaction,
      progress.state,
      queuedEvent.event,
      context.environment,
    )
    if (reactionResult.accepted === false) {
      return Object.freeze({
        accepted: false,
        event: queuedEvent.event,
        reactionName: reaction.name,
        reason: reactionResult.reason,
      })
    }
    const reactionNames = getReactionTrace(queuedEvent.reactionNames, reaction)
    const emittedEvents = ownQueuedReactionEvents(reactionResult.events ?? [], reactionNames)

    progress = Object.freeze({
      ...progress,
      queue: Object.freeze([...progress.queue, ...emittedEvents]),
      reactionIndex: progress.reactionIndex + 1,
      reactionSteps: progress.reactionSteps + 1,
      state: ownWorldState(context.stateOwnership, reactionResult.state),
    })
  }
}

/**
 * module を合成する不変なworld。
 *
 * `with()` は元のworldを変更せず、Action/Event unionが拡張された新しいworldを返す。
 */
export class WizWorld<TState, TAction = never, TEvent = never, TReason extends string = never> {
  readonly initialState: WizDeepReadonly<TState>
  readonly environment: WizWorldEnvironment
  readonly reactionPolicy: WizWorldReactionPolicy
  readonly stateOwnership: WizWorldStateOwnership<TState>
  private readonly modules: readonly WizErasedWorldModule[]
  private readonly reactions: readonly WizErasedWorldEventReaction[]

  private constructor(
    token: symbol,
    data: {
      initialState: TState
      environment: WizWorldEnvironment
      reactionPolicy: WizWorldReactionPolicy
      stateOwnership: WizWorldStateOwnership<TState>
      modules: readonly WizErasedWorldModule[]
      reactions: readonly WizErasedWorldEventReaction[]
    },
  ) {
    assertWorldConstructionToken(token)
    requireWorldEnvironmentBehavior(data.environment)
    assertAuthenticWorldReactionPolicy(data.reactionPolicy)
    assertAuthenticWizWorldStateOwnership(data.stateOwnership)
    this.stateOwnership = data.stateOwnership
    this.initialState = ownWorldState(this.stateOwnership, data.initialState)
    this.environment = data.environment
    this.modules = Object.freeze([...data.modules])
    this.reactionPolicy = data.reactionPolicy
    this.reactions = Object.freeze([...data.reactions])
    Object.freeze(this)
  }

  static create<TState>(
    initialState: TState,
    environment: WizWorldEnvironment = WizWorldEnvironment.create(),
    stateOwnership: WizWorldStateOwnership<TState> = WizWorldStateOwnership.deepImmutable(),
  ): WizWorld<TState> {
    return new WizWorld(worldConstructionToken, {
      environment,
      initialState,
      modules: [],
      reactionPolicy: WizWorldReactionPolicy.create(),
      reactions: [],
      stateOwnership,
    })
  }

  with<TNextAction, TNextEvent = never, TNextReason extends string = never>(
    module: WizWorldModule<TState, TNextAction, TNextEvent, TNextReason>,
  ): WizWorld<TState, TAction | TNextAction, TEvent | TNextEvent, TReason | TNextReason> {
    requireWorldModuleBehavior(module)
    if (this.modules.some((candidate) => candidate.name === module.name)) {
      throw new WizWorldCompositionError("DUPLICATE_MODULE_NAME", module.name)
    }

    return new WizWorld(worldConstructionToken, {
      environment: this.environment,
      initialState: this.initialState as TState,
      modules: [...this.modules, module],
      reactionPolicy: this.reactionPolicy,
      reactions: this.reactions,
      stateOwnership: this.stateOwnership,
    })
  }

  withSlice<TSliceState, TNextAction, TNextEvent = never, TNextReason extends string = never>(
    module: WizWorldSliceModule<TState, TSliceState, TNextAction, TNextEvent, TNextReason>,
  ): WizWorld<TState, TAction | TNextAction, TEvent | TNextEvent, TReason | TNextReason> {
    return this.with(
      requireWizWorldSliceModule<TState, TNextAction, TNextEvent, TNextReason>(module),
    )
  }

  withReaction<
    TObservedEvent extends TEvent,
    TNextEvent = never,
    TNextReason extends string = never,
  >(
    reaction: WizWorldEventReaction<TState, TObservedEvent, TNextEvent, TNextReason>,
  ): WizWorld<TState, TAction, TEvent | TNextEvent, TReason | TNextReason> {
    requireWorldEventReactionBehavior(reaction)
    if (this.reactions.some((candidate) => candidate.name === reaction.name)) {
      throw new WizWorldCompositionError("DUPLICATE_REACTION_NAME", reaction.name)
    }

    return new WizWorld(worldConstructionToken, {
      environment: this.environment,
      initialState: this.initialState as TState,
      modules: this.modules,
      reactionPolicy: this.reactionPolicy,
      reactions: [...this.reactions, reaction],
      stateOwnership: this.stateOwnership,
    })
  }

  withReactionPolicy(
    reactionPolicy: WizWorldReactionPolicy,
  ): WizWorld<TState, TAction, TEvent, TReason> {
    assertAuthenticWorldReactionPolicy(reactionPolicy)
    return new WizWorld(worldConstructionToken, {
      environment: this.environment,
      initialState: this.initialState as TState,
      modules: this.modules,
      reactionPolicy,
      reactions: this.reactions,
      stateOwnership: this.stateOwnership,
    })
  }

  dispatch(
    state: TState | WizDeepReadonly<TState>,
    action: TAction,
  ): WizWorldDispatchResult<TState, TEvent, TReason> {
    return this.dispatchUnknown(state, action)
  }

  /**
   * 信頼できない入力を登録済みschemaで検証してdispatchする。
   *
   * 一つもschemaに一致しなかった場合、全schema moduleのdiagnosticsをmodule別に返す。
   * Standard Schemaには対象moduleを事前判定するprotocolがないため、未知のtypeも
   * schema moduleが存在するworldでは`ACTION_VALIDATION_FAILED`になる。
   */
  dispatchUnknown(
    state: TState | WizDeepReadonly<TState>,
    action: unknown,
  ): WizWorldDispatchResult<TState, TEvent, TReason> {
    const ownedState = ownWorldState(this.stateOwnership, state)
    const evaluatedModules = this.modules.map((module) => {
      const match = matchWorldModule(module, action)

      return Object.freeze({ match, module })
    })
    const matchingModules = evaluatedModules.flatMap((evaluatedModule) => {
      const match = evaluatedModule.match

      return match !== unmatchedWorldAction && match.kind === "matched"
        ? [Object.freeze({ action: match.action, module: evaluatedModule.module })]
        : []
    })
    if (matchingModules.length === 0) {
      const diagnostics = evaluatedModules.flatMap((evaluatedModule) => {
        const match = evaluatedModule.match

        return match !== unmatchedWorldAction && match.kind === "invalid"
          ? [
              Object.freeze({
                ...match.diagnostic,
                moduleName: evaluatedModule.module.name,
              }),
            ]
          : []
      })
      if (diagnostics.length > 0) {
        return WizWorldDispatchResult.invalidAction<TState, TEvent, TReason>(
          ownedState,
          action,
          diagnostics,
          this.stateOwnership,
        )
      }

      return WizWorldDispatchResult.rejected<TState, TEvent, TReason>(
        ownedState,
        action,
        this.stateOwnership,
      )
    }
    if (matchingModules.length > 1) {
      return WizWorldDispatchResult.ambiguous<TState, TEvent, TReason>(
        ownedState,
        action,
        matchingModules.map(({ module }) => module.name),
        this.stateOwnership,
      )
    }

    const matchedModule = matchingModules[0]
    const normalizedAction = ownWorldBoundaryValue(matchedModule.action)
    const environmentTransaction = beginWorldEnvironmentTransaction(this.environment)
    const execution = (() => {
      try {
        const result = reduceWorldModule<TState, TReason>(
          matchedModule.module,
          ownedState,
          normalizedAction,
          environmentTransaction.environment,
        )
        if (result.accepted === false) {
          return Object.freeze({
            commit: false,
            dispatchResult: WizWorldDispatchResult.rejectedByRule<TState, TEvent, TReason>(
              ownedState,
              action,
              result.reason,
              this.stateOwnership,
            ),
          })
        }
        const reactionExecution = runWorldReactions<TState, TReason>(
          {
            environment: environmentTransaction.environment,
            maximumReactionSteps: this.reactionPolicy.maximumReactionSteps,
            reactions: this.reactions,
            stateOwnership: this.stateOwnership,
          },
          result.state,
          result.events ?? [],
        )
        if (reactionExecution.accepted === true) {
          return Object.freeze({
            commit: true,
            dispatchResult: WizWorldDispatchResult.accepted<TState, TEvent, TReason>(
              reactionExecution.state,
              reactionExecution.events as readonly TEvent[],
              this.stateOwnership,
            ),
          })
        }
        if ("reason" in reactionExecution) {
          return Object.freeze({
            commit: false,
            dispatchResult: WizWorldDispatchResult.rejectedByReaction<TState, TEvent, TReason>(
              ownedState,
              reactionExecution.event,
              reactionExecution.reactionName,
              reactionExecution.reason,
              this.stateOwnership,
            ),
          })
        }
        return Object.freeze({
          commit: false,
          dispatchResult: WizWorldDispatchResult.reactionLimitExceeded<TState, TEvent, TReason>(
            ownedState,
            reactionExecution.event,
            this.reactionPolicy.maximumReactionSteps,
            reactionExecution.reactionNames,
            this.stateOwnership,
          ),
        })
      } catch (error) {
        environmentTransaction.rollback()
        throw error
      }
    })()

    if (execution.commit) {
      environmentTransaction.commit()
    } else {
      environmentTransaction.rollback()
    }

    return execution.dispatchResult
  }
}

Object.freeze(WizWorldEnvironmentValueError.prototype)
Object.freeze(WizWorldEnvironmentValueError)
Object.freeze(WizWorldValueOwnershipError.prototype)
Object.freeze(WizWorldValueOwnershipError)
Object.freeze(WizWorldEnvironment.prototype)
Object.freeze(WizWorldEnvironment)
Object.freeze(WizWorldModule.prototype)
Object.freeze(WizWorldModule)
Object.freeze(WizWorldEventReaction.prototype)
Object.freeze(WizWorldEventReaction)
Object.freeze(WizWorldReactionPolicy.prototype)
Object.freeze(WizWorldReactionPolicy)
Object.freeze(WizWorldCompositionError.prototype)
Object.freeze(WizWorldCompositionError)
Object.freeze(WizWorld.prototype)
Object.freeze(WizWorld)
