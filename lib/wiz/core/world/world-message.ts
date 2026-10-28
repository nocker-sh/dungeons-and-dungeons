import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"

export type WizWorldMessageValue =
  | boolean
  | number
  | string
  | null
  | readonly WizWorldMessageValue[]
  | Readonly<{ readonly [key: string]: WizWorldMessageValue }>

export type WizWorldMessageDefinitions = Readonly<
  Record<string, Readonly<Record<string, WizWorldMessageValue>>>
>

export type WizWorldMessageTemplates<
  TDefinitions extends WizWorldMessageDefinitions,
> = {
  readonly [TKey in keyof TDefinitions]: (
    parameters: WizDeepReadonly<TDefinitions[TKey]>
  ) => string
}

const worldMessagePath = (parent: string, key: string | number): string =>
  typeof key === "number"
    ? `${parent}[${key}]`
    : /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
      ? `${parent}.${key}`
      : `${parent}[${JSON.stringify(key)}]`

export class WizWorldMessageValueError extends TypeError {
  override readonly name = "WizWorldMessageValueError"
  readonly path: string
  readonly reason: string

  constructor(path: string, reason: string) {
    super(`Invalid world message value at ${path}: ${reason}`)
    this.path = path
    this.reason = reason
    Object.freeze(this)
  }
}

const ownWorldMessageValue = (
  value: unknown,
  path: string,
  copies: WeakMap<object, WizWorldMessageValue>,
  active: WeakSet<object>
): WizWorldMessageValue => {
  try {
    return ownWorldMessageValueUnchecked(value, path, copies, active)
  } catch (error) {
    if (error instanceof WizWorldMessageValueError) {
      throw error
    }
    throw new WizWorldMessageValueError(
      path,
      "value could not be inspected safely"
    )
  }
}

const ownWorldMessageValueUnchecked = (
  value: unknown,
  path: string,
  copies: WeakMap<object, WizWorldMessageValue>,
  active: WeakSet<object>
): WizWorldMessageValue => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw new WizWorldMessageValueError(
        path,
        "numbers must be finite and survive a JSON round-trip"
      )
    }
    return value
  }
  if (typeof value !== "object") {
    throw new WizWorldMessageValueError(
      path,
      "only JSON-safe primitive values, arrays, and plain objects are supported"
    )
  }
  if (active.has(value)) {
    throw new WizWorldMessageValueError(
      path,
      "cyclic references are not supported"
    )
  }
  const existing = copies.get(value)
  if (existing) {
    return existing
  }

  active.add(value)
  if (Array.isArray(value)) {
    const copy: WizWorldMessageValue[] = []
    copies.set(value, copy)
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
        throw new WizWorldMessageValueError(
          worldMessagePath(path, index),
          "array entries must be enumerable data properties"
        )
      }
      copy.push(
        ownWorldMessageValue(
          descriptor.value,
          worldMessagePath(path, index),
          copies,
          active
        )
      )
    }
    const extraKey = Reflect.ownKeys(value).find(
      (key) =>
        key !== "length" &&
        (typeof key !== "string" ||
          !/^(0|[1-9][0-9]*)$/.test(key) ||
          Number(key) >= value.length)
    )
    if (extraKey !== undefined) {
      throw new WizWorldMessageValueError(
        path,
        `array property ${String(extraKey)} is not an entry index`
      )
    }
    active.delete(value)
    return Object.freeze(copy)
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new WizWorldMessageValueError(
      path,
      "only arrays and plain objects are supported"
    )
  }
  const copy = Object.create(prototype) as Record<string, WizWorldMessageValue>
  copies.set(value, copy)
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") {
      throw new WizWorldMessageValueError(
        path,
        "symbol properties are not supported"
      )
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      throw new WizWorldMessageValueError(
        worldMessagePath(path, key),
        "properties must be enumerable data properties"
      )
    }
    Object.defineProperty(copy, key, {
      configurable: false,
      enumerable: true,
      value: ownWorldMessageValue(
        descriptor.value,
        worldMessagePath(path, key),
        copies,
        active
      ),
      writable: false,
    })
  }
  active.delete(value)
  return Object.freeze(copy)
}

const ownWorldMessageParameters = <
  TParameters extends Readonly<Record<string, WizWorldMessageValue>>,
>(
  parameters: unknown
): WizDeepReadonly<TParameters> => {
  const owned = ownWorldMessageValue(
    parameters,
    "$",
    new WeakMap(),
    new WeakSet()
  )
  if (typeof owned !== "object" || owned === null || Array.isArray(owned)) {
    throw new WizWorldMessageValueError(
      "$",
      "message parameters must be a plain object"
    )
  }
  return owned as unknown as WizDeepReadonly<TParameters>
}

/**
 * headless層から表示文言を分離するための不変なmessage token。
 */
export class WizWorldMessage<
  TKey extends string,
  TParameters extends Readonly<Record<string, WizWorldMessageValue>>,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly key: TKey
  readonly parameters: WizDeepReadonly<TParameters>

  private constructor(
    key: TKey,
    parameters: TParameters | WizDeepReadonly<TParameters>
  ) {
    if (typeof key !== "string") {
      throw new TypeError("World message key must be a string")
    }
    if (key.trim().length === 0 || key !== key.trim()) {
      throw new RangeError(
        "World message key must not be blank or have surrounding whitespace"
      )
    }
    this.key = key
    this.parameters = ownWorldMessageParameters<TParameters>(parameters)
    WizImmutableValue.freeze(this)
  }

  static create<
    TKey extends string,
    TParameters extends Readonly<Record<string, WizWorldMessageValue>>,
  >(key: TKey, parameters: TParameters): WizWorldMessage<TKey, TParameters> {
    return new WizWorldMessage(key, parameters)
  }
}

/**
 * tokenを特定言語の文章へ変換する不変なcatalog。
 */
export class WizWorldMessageCatalog<
  TDefinitions extends WizWorldMessageDefinitions,
> {
  private readonly templates: WizWorldMessageTemplates<TDefinitions>

  private constructor(templates: WizWorldMessageTemplates<TDefinitions>) {
    this.templates = Object.freeze({ ...templates })
    Object.freeze(this)
  }

  static create<TDefinitions extends WizWorldMessageDefinitions>(
    templates: WizWorldMessageTemplates<TDefinitions>
  ): WizWorldMessageCatalog<TDefinitions> {
    return new WizWorldMessageCatalog(templates)
  }

  render<TKey extends Extract<keyof TDefinitions, string>>(
    message: WizWorldMessage<TKey, TDefinitions[TKey]>
  ): string {
    return this.templates[message.key](message.parameters)
  }
}

Object.freeze(WizWorldMessageValueError)
Object.freeze(WizWorldMessageValueError.prototype)
Object.freeze(WizWorldMessage)
Object.freeze(WizWorldMessage.prototype)
Object.freeze(WizWorldMessageCatalog)
Object.freeze(WizWorldMessageCatalog.prototype)
