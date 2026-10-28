import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { isMutableBuiltInValue } from "@/lib/wiz/core/is-mutable-built-in-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"

const commandsConstructionToken = Symbol("WizRpgCommands.constructor")
const featureActionConstructionToken = Symbol("WizRpgFeatureAction.constructor")
const featureCommandOwnership = new WizObjectService()

export type WizRpgFeatureCommands = Readonly<Record<string, unknown>>

export type WizRpgFeatureCommandSurface<
  TKey extends string,
  TCommands,
> = Readonly<{
  [
    TCommand in keyof TCommands as TCommand extends typeof WIZ_IMMUTABLE_VALUE
      ? never
      : TCommand
  ]: TCommands[TCommand] extends (
    ...arguments_: infer TArguments
  ) => infer TAction
    ? (...arguments_: TArguments) => WizRpgFeatureAction<TKey, TAction>
    : never
}>

const assertCommandValue = (
  value: unknown,
  label: string,
  path: readonly PropertyKey[],
  visited: WeakSet<object>
): void => {
  if (typeof value === "function") return
  if (typeof value !== "object" || value === null) return
  if (visited.has(value)) return
  if (!Object.isFrozen(value)) {
    const location =
      path.length === 0 ? "" : ` at ${path.map(String).join(".")}`
    throw new TypeError(
      `${label} command surface must be deeply immutable${location}`
    )
  }
  if (isMutableBuiltInValue(value)) {
    const location =
      path.length === 0 ? "" : ` at ${path.map(String).join(".")}`
    throw new TypeError(
      `${label} command surface cannot contain mutable built-in${location}`
    )
  }
  const prototype = Object.getPrototypeOf(value)
  if (
    prototype !== null &&
    prototype !== Object.prototype &&
    prototype !== Array.prototype &&
    !Object.isFrozen(prototype)
  ) {
    throw new TypeError(`${label} command class prototype must be immutable`)
  }
  visited.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError(
        `${label} command surface cannot contain accessor "${String(key)}"`
      )
    }
    assertCommandValue(descriptor.value, label, [...path, key], visited)
  }
}

/** @internal command composition boundary only. */
export const assertRpgCommandSurface: (
  value: unknown,
  label: string
) => asserts value is object = (value, label) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} command surface must be an immutable object`)
  }
  assertCommandValue(value, label, [], new WeakSet())
}

const readonlyCommandSurface = <TCommands>(
  commands: TCommands | WizDeepReadonly<TCommands>
): WizDeepReadonly<TCommands> => commands as WizDeepReadonly<TCommands>

const commandMethodEntries = (
  commands: object,
  label: string
): readonly (readonly [
  PropertyKey,
  (...arguments_: readonly unknown[]) => unknown,
])[] => {
  const entries = new Map<
    PropertyKey,
    (...arguments_: readonly unknown[]) => unknown
  >()
  let current: object | null = commands
  while (
    current !== null &&
    current !== Object.prototype &&
    current !== Function.prototype
  ) {
    for (const key of Reflect.ownKeys(current)) {
      if (
        key === "constructor" ||
        key === WIZ_IMMUTABLE_VALUE ||
        entries.has(key)
      )
        continue
      const descriptor = Object.getOwnPropertyDescriptor(current, key)
      if (descriptor === undefined || !("value" in descriptor)) {
        throw new TypeError(
          `${label} command "${String(key)}" must be a method`
        )
      }
      if (typeof descriptor.value !== "function") {
        throw new TypeError(
          `${label} command "${String(key)}" must be a method`
        )
      }
      entries.set(key, descriptor.value)
    }
    current = Object.getPrototypeOf(current)
  }
  return Object.freeze([...entries.entries()])
}

const bindFeatureCommands = <const TKey extends string, TCommands>(
  featureKey: TKey,
  commands: TCommands
): WizRpgFeatureCommandSurface<TKey, TCommands> => {
  assertRpgCommandSurface(commands, `RPG feature "${featureKey}"`)
  const source = commands
  const surface: Record<PropertyKey, unknown> = Object.create(null)
  for (const [key, command] of commandMethodEntries(
    source,
    `RPG feature "${featureKey}"`
  )) {
    Object.defineProperty(surface, key, {
      configurable: false,
      enumerable: true,
      value: Object.freeze((...arguments_: readonly unknown[]) =>
        WizRpgFeatureAction.create(
          featureKey,
          Reflect.apply(command, source, arguments_)
        )
      ),
      writable: false,
    })
  }
  return Object.freeze(surface) as WizRpgFeatureCommandSurface<TKey, TCommands>
}

/**
 * feature keyとschema入力を不可分にする不変action。
 *
 * worldのcommand surfaceが生成するため、別featureやsceneのactionと構造が同じでも
 * routingが衝突しない。
 */
export class WizRpgFeatureAction<TKey extends string, TAction> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly featureKey: TKey
  readonly payload: WizDeepReadonly<TAction>

  private constructor(token: symbol, featureKey: TKey, payload: TAction) {
    if (token !== featureActionConstructionToken) {
      throw new TypeError("WizRpgFeatureAction must be created with create()")
    }
    if (featureKey.trim().length === 0 || featureKey !== featureKey.trim()) {
      throw new RangeError(
        "RPG feature action key must be a non-blank string without surrounding whitespace"
      )
    }
    this.featureKey = featureKey
    this.payload = featureCommandOwnership.ownImmutable(payload)
    WizImmutableValue.freeze(this)
  }

  static create<const TKey extends string, TAction>(
    featureKey: TKey,
    payload: TAction
  ): WizRpgFeatureAction<TKey, TAction> {
    return new WizRpgFeatureAction(
      featureActionConstructionToken,
      featureKey,
      payload
    )
  }
}

/**
 * scene runtimeと追加featureのcommand factoryを型安全に束ねる不変command surface。
 *
 * scene側とfeature側を別namespaceに保つため、同名commandを安全に共存できる。
 */
export class WizRpgCommands<
  TSceneCommands,
  TFeatures extends WizRpgFeatureCommands = Readonly<Record<never, never>>,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly scene: WizDeepReadonly<TSceneCommands>
  readonly #features: TFeatures

  private constructor(
    token: symbol,
    scene: TSceneCommands | WizDeepReadonly<TSceneCommands>,
    features: TFeatures
  ) {
    if (token !== commandsConstructionToken) {
      throw new TypeError("WizRpgCommands must be created with forScene()")
    }
    assertRpgCommandSurface(scene, "RPG scene")
    for (const [key, commands] of Object.entries(features)) {
      assertRpgCommandSurface(commands, `RPG feature "${key}"`)
    }
    this.scene = readonlyCommandSurface<TSceneCommands>(scene)
    this.#features = Object.freeze({ ...features }) as TFeatures
    WizImmutableValue.freeze(this)
  }

  static forScene<TSceneCommands>(
    scene: TSceneCommands
  ): WizRpgCommands<TSceneCommands> {
    return new WizRpgCommands(
      commandsConstructionToken,
      scene,
      Object.freeze({})
    )
  }

  feature<TKey extends keyof TFeatures>(key: TKey): TFeatures[TKey] {
    return this.#features[key]
  }

  withFeature<const TKey extends string, TCommands>(
    key: TKey,
    commands: TCommands
  ): WizRpgCommands<
    TSceneCommands,
    TFeatures &
      Readonly<Record<TKey, WizRpgFeatureCommandSurface<TKey, TCommands>>>
  > {
    if (key.trim().length === 0 || key !== key.trim()) {
      throw new RangeError(
        "RPG feature key must be a non-blank string without surrounding whitespace"
      )
    }
    if (Object.hasOwn(this.#features, key)) {
      throw new RangeError(`Duplicate RPG feature command key "${key}"`)
    }
    return new WizRpgCommands<
      TSceneCommands,
      TFeatures &
        Readonly<Record<TKey, WizRpgFeatureCommandSurface<TKey, TCommands>>>
    >(commandsConstructionToken, this.scene, {
      ...this.#features,
      [key]: bindFeatureCommands(key, commands),
    })
  }
}

Object.freeze(WizRpgFeatureAction.prototype)
Object.freeze(WizRpgFeatureAction)
Object.freeze(WizRpgCommands.prototype)
Object.freeze(WizRpgCommands)
