import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import {
  WizStandardSchema,
  type WizStandardSchemaDefinition,
  type WizStandardSchemaInput,
  type WizStandardSchemaOutput,
} from "@/lib/wiz/core/standard-schema"

export const WIZ_WORLD_SAVE_SCHEMA_VERSION = 1

export type WizWorldSaveEnvelope<TSnapshot = unknown> = Readonly<{
  schemaVersion: number
  contentVersion: string
  snapshot: WizDeepReadonly<TSnapshot>
}>

export type WizWorldSaveJsonPrimitive = string | number | boolean | null
export type WizWorldSaveJsonValue =
  | WizWorldSaveJsonPrimitive
  | readonly WizWorldSaveJsonValue[]
  | { readonly [key: string]: WizWorldSaveJsonValue }

export type WizWorldSaveCodecDefinition<TInput, TOutput = TInput> = Readonly<{
  contentVersion: string
  schemaVersion?: number
  /**
   * 構築後に変更しない、信頼済みの純粋なvalidation dependency。
   * codecはStandard Schemaのvalidator参照を構築時に捕捉する。
   */
  schema: WizStandardSchemaDefinition<TInput, TOutput>
}>

type UnknownWorldSaveEnvelope = Readonly<{
  schemaVersion: number
  contentVersion: string
  snapshot: unknown
}>

const worldSavePath = (parent: string, key: string | number): string =>
  typeof key === "number"
    ? `${parent}[${key}]`
    : /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
      ? `${parent}.${key}`
      : `${parent}[${JSON.stringify(key)}]`

const worldSaveValueType = (value: unknown): string => {
  if (value === null) return "null"
  if (typeof value !== "object") return typeof value
  try {
    if (Array.isArray(value)) return "Array"
    const prototype = Object.getPrototypeOf(value)
    const constructor = prototype
      ? Object.getOwnPropertyDescriptor(prototype, "constructor")?.value
      : undefined
    const name =
      typeof constructor === "function"
        ? Object.getOwnPropertyDescriptor(constructor, "name")?.value
        : undefined
    return typeof name === "string" && name.length > 0 ? name : "Object"
  } catch {
    return "Object"
  }
}

export class WizWorldSaveSerializationError extends TypeError {
  override readonly name = "WizWorldSaveSerializationError"
  readonly code = "NON_JSON_VALUE"
  readonly path: string
  readonly valueType: string
  readonly reason: string

  constructor(path: string, value: unknown, reason: string) {
    const valueType = worldSaveValueType(value)
    super(`World save value at ${path} (${valueType}) is not JSON-safe: ${reason}`)
    this.path = path
    this.valueType = valueType
    this.reason = reason
    Object.freeze(this)
  }
}

const ownJsonValue = (
  value: unknown,
  path: string,
  firstPaths: WeakMap<object, string>,
  active: WeakSet<object>,
): WizWorldSaveJsonValue => {
  try {
    return ownJsonValueUnchecked(value, path, firstPaths, active)
  } catch (error) {
    if (error instanceof WizWorldSaveSerializationError) {
      throw error
    }
    throw new WizWorldSaveSerializationError(path, value, "value could not be inspected safely")
  }
}

const ownJsonValueUnchecked = (
  value: unknown,
  path: string,
  firstPaths: WeakMap<object, string>,
  active: WeakSet<object>,
): WizWorldSaveJsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new WizWorldSaveSerializationError(path, value, "numbers must be finite")
    }
    if (Object.is(value, -0)) {
      throw new WizWorldSaveSerializationError(
        path,
        value,
        "negative zero does not survive a JSON round-trip",
      )
    }
    return value
  }
  if (typeof value !== "object") {
    throw new WizWorldSaveSerializationError(
      path,
      value,
      "only null, booleans, finite numbers, strings, arrays, and plain objects are supported",
    )
  }
  if (active.has(value)) {
    throw new WizWorldSaveSerializationError(path, value, "cyclic references are not supported")
  }
  const firstPath = firstPaths.get(value)
  if (firstPath !== undefined) {
    throw new WizWorldSaveSerializationError(
      path,
      value,
      `shared object references are not supported; first encountered at ${firstPath}`,
    )
  }
  firstPaths.set(value, path)

  active.add(value)
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new WizWorldSaveSerializationError(
        path,
        value,
        "array subclasses and arrays from another realm must be converted to plain arrays first",
      )
    }
    const copy: WizWorldSaveJsonValue[] = []
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
        throw new WizWorldSaveSerializationError(
          worldSavePath(path, index),
          descriptor?.value,
          "array entries must be enumerable data properties",
        )
      }
      copy.push(ownJsonValue(descriptor.value, worldSavePath(path, index), firstPaths, active))
    }
    const extraKey = Reflect.ownKeys(value).find(
      (key) =>
        key !== "length" &&
        (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length),
    )
    if (extraKey !== undefined) {
      throw new WizWorldSaveSerializationError(
        path,
        value,
        `array property ${String(extraKey)} would be discarded by JSON`,
      )
    }
    active.delete(value)
    return Object.freeze(copy)
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new WizWorldSaveSerializationError(
      path,
      value,
      "class and built-in instances must be converted to plain data first",
    )
  }

  const copy = Object.create(Object.prototype) as Record<string, WizWorldSaveJsonValue>
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") {
      throw new WizWorldSaveSerializationError(path, value, "symbol keys are not supported")
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !descriptor.enumerable) {
      throw new WizWorldSaveSerializationError(
        worldSavePath(path, key),
        descriptor?.value,
        "non-enumerable properties would be discarded by JSON",
      )
    }
    if (!("value" in descriptor)) {
      throw new WizWorldSaveSerializationError(
        worldSavePath(path, key),
        value,
        "accessor properties are not supported",
      )
    }
    Object.defineProperty(copy, key, {
      configurable: false,
      enumerable: true,
      value: ownJsonValue(descriptor.value, worldSavePath(path, key), firstPaths, active),
      writable: false,
    })
  }
  active.delete(value)
  return Object.freeze(copy)
}

/**
 * JSON round-tripで意味を失わない値だけを所有する内部境界。
 *
 * world save本体だけでなく、合成codecのwire値も同じ規則で検証する。
 *
 * @internal
 */
export class WizWorldSaveJsonOwnership {
  private constructor() {
    throw new TypeError("WizWorldSaveJsonOwnership is a static-only authority")
  }

  static own<const TValue>(value: TValue): WizDeepReadonly<TValue> {
    return ownJsonValue(value, "$", new WeakMap(), new WeakSet()) as WizDeepReadonly<TValue>
  }
}

Object.freeze(WizWorldSaveJsonOwnership)

const validateSchemaVersion = (schemaVersion: number): number => {
  if (!Number.isSafeInteger(schemaVersion) || schemaVersion < 1) {
    throw new RangeError("schemaVersion must be a positive safe integer")
  }
  return schemaVersion
}

const validateContentVersion = (contentVersion: string): string => {
  if (contentVersion.trim().length === 0 || contentVersion !== contentVersion.trim()) {
    throw new RangeError("contentVersion must not be blank or have surrounding whitespace")
  }
  return contentVersion
}

const readEnvelopeDataProperty = (
  input: object,
  key: "schemaVersion" | "contentVersion" | "snapshot",
): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(input, key)
  if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
    throw new TypeError(`World save envelope property "${key}" must be an enumerable data property`)
  }
  return descriptor.value
}

const validateUnknownWorldSaveEnvelope = (input: unknown): UnknownWorldSaveEnvelope => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TypeError("World save envelope must be a plain object")
  }
  const prototype = Object.getPrototypeOf(input)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("World save envelope must be a plain object")
  }
  const keys = Reflect.ownKeys(input)
  const expectedKeys = new Set<PropertyKey>(["schemaVersion", "contentVersion", "snapshot"])
  if (keys.length !== expectedKeys.size || keys.some((key) => !expectedKeys.has(key))) {
    throw new TypeError(
      'World save envelope must contain exactly "schemaVersion", "contentVersion", and "snapshot"',
    )
  }

  const schemaVersion = readEnvelopeDataProperty(input, "schemaVersion")
  const contentVersion = readEnvelopeDataProperty(input, "contentVersion")
  const snapshot = readEnvelopeDataProperty(input, "snapshot")
  if (typeof schemaVersion !== "number") {
    throw new TypeError("World save envelope schemaVersion must be a number")
  }
  if (!Number.isSafeInteger(schemaVersion) || schemaVersion < 1) {
    throw new TypeError("World save envelope schemaVersion must be a positive safe integer")
  }
  if (typeof contentVersion !== "string") {
    throw new TypeError("World save envelope contentVersion must be a string")
  }
  if (contentVersion.trim().length === 0 || contentVersion !== contentVersion.trim()) {
    throw new TypeError(
      "World save envelope contentVersion must not be blank or have surrounding whitespace",
    )
  }

  return Object.freeze({ schemaVersion, contentVersion, snapshot })
}

export class WizWorldSaveSchemaVersionError extends Error {
  override readonly name = "WizWorldSaveSchemaVersionError"
  readonly code = "SCHEMA_VERSION_MISMATCH"
  readonly actualSchemaVersion: number
  readonly supportedSchemaVersion: number

  constructor(actualSchemaVersion: number, supportedSchemaVersion: number) {
    super(
      `Unsupported world save schema version ${actualSchemaVersion}; expected ${supportedSchemaVersion}`,
    )
    this.actualSchemaVersion = actualSchemaVersion
    this.supportedSchemaVersion = supportedSchemaVersion
    Object.freeze(this)
  }
}

export class WizWorldSaveContentVersionError extends Error {
  override readonly name = "WizWorldSaveContentVersionError"
  readonly code = "CONTENT_VERSION_MISMATCH"
  readonly actualContentVersion: string
  readonly expectedContentVersion: string

  constructor(actualContentVersion: string, expectedContentVersion: string) {
    super(
      `World content version "${actualContentVersion}" does not match "${expectedContentVersion}"`,
    )
    this.actualContentVersion = actualContentVersion
    this.expectedContentVersion = expectedContentVersion
    Object.freeze(this)
  }
}

/**
 * 任意のplain snapshot向けversion envelopeとStandard Schema validationを提供する不変codec。
 */
export class WizWorldSaveCodec<TInput, TOutput = TInput> {
  readonly #schema: WizStandardSchema<TInput, TOutput>
  readonly contentVersion: string
  readonly decodeSnapshot: (input: unknown) => WizDeepReadonly<TOutput>
  readonly encode: <const TSnapshot extends TInput>(
    snapshot: TSnapshot,
  ) => WizWorldSaveEnvelope<TSnapshot>
  readonly parse: (input: unknown) => WizWorldSaveEnvelope<TOutput>
  readonly schemaVersion: number

  /** Prevents codecs with different schema input/output pairs from being interchangeable. */
  declare private readonly schemaInvariant: (input: TInput) => TOutput

  private constructor(
    definition: WizWorldSaveCodecDefinition<TInput, TOutput>,
    schema: WizStandardSchemaDefinition<TInput, TOutput>,
  ) {
    this.contentVersion = validateContentVersion(definition.contentVersion)
    this.schemaVersion = validateSchemaVersion(
      definition.schemaVersion ?? WIZ_WORLD_SAVE_SCHEMA_VERSION,
    )
    this.#schema = WizStandardSchema.capture(schema, "World save snapshot schema")
    this.decodeSnapshot = Object.freeze(
      (input: unknown): WizDeepReadonly<TOutput> => this.#parse(input).snapshot,
    )
    this.encode = Object.freeze(
      <const TSnapshot extends TInput>(snapshot: TSnapshot): WizWorldSaveEnvelope<TSnapshot> =>
        this.#encode(snapshot),
    )
    this.parse = Object.freeze(
      (input: unknown): WizWorldSaveEnvelope<TOutput> => this.#parse(input),
    )
    Object.freeze(this)
  }

  static readonly define = <const TSchema extends WizStandardSchemaDefinition>(
    definition: Omit<
      WizWorldSaveCodecDefinition<
        WizStandardSchemaInput<TSchema>,
        WizStandardSchemaOutput<TSchema>
      >,
      "schema"
    > &
      Readonly<{
        schema: TSchema
      }>,
  ): WizWorldSaveCodec<WizStandardSchemaInput<TSchema>, WizStandardSchemaOutput<TSchema>> =>
    new WizWorldSaveCodec(definition, definition.schema)

  #encode<const TSnapshot extends TInput>(snapshot: TSnapshot): WizWorldSaveEnvelope<TSnapshot> {
    const envelope = WizWorldSaveJsonOwnership.own({
      schemaVersion: this.schemaVersion,
      contentVersion: this.contentVersion,
      snapshot,
    })
    this.#schema.validate(envelope.snapshot)
    return envelope
  }

  #parse(input: unknown): WizWorldSaveEnvelope<TOutput> {
    const envelope = validateUnknownWorldSaveEnvelope(input)
    if (envelope.schemaVersion !== this.schemaVersion) {
      throw new WizWorldSaveSchemaVersionError(envelope.schemaVersion, this.schemaVersion)
    }
    if (envelope.contentVersion !== this.contentVersion) {
      throw new WizWorldSaveContentVersionError(envelope.contentVersion, this.contentVersion)
    }
    const ownedEnvelope = WizWorldSaveJsonOwnership.own(envelope)
    const snapshot = this.#schema.validate(ownedEnvelope.snapshot)

    return WizWorldSaveJsonOwnership.own({
      schemaVersion: ownedEnvelope.schemaVersion,
      contentVersion: ownedEnvelope.contentVersion,
      snapshot,
    })
  }
}

Object.freeze(WizWorldSaveCodec.prototype)
Object.freeze(WizWorldSaveCodec)
Object.freeze(WizWorldSaveSerializationError.prototype)
Object.freeze(WizWorldSaveSerializationError)
Object.freeze(WizWorldSaveSchemaVersionError.prototype)
Object.freeze(WizWorldSaveSchemaVersionError)
Object.freeze(WizWorldSaveContentVersionError.prototype)
Object.freeze(WizWorldSaveContentVersionError)
