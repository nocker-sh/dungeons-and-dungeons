const standardSchemaConstructionToken = Symbol("WizStandardSchema.constructor")

export type WizStandardSchemaPathSegment =
  | PropertyKey
  | Readonly<{
      key: PropertyKey
    }>

export type WizStandardSchemaIssue = Readonly<{
  message: string
  path?: readonly WizStandardSchemaPathSegment[]
}>

type WizStandardSchemaSuccess<TOutput> = Readonly<{
  value: TOutput
  issues?: undefined
}>

type WizStandardSchemaFailure = Readonly<{
  issues: readonly WizStandardSchemaIssue[]
}>

export type WizStandardSchemaResult<TOutput> =
  | WizStandardSchemaSuccess<TOutput>
  | WizStandardSchemaFailure

/**
 * Standard Schema V1のlibrary非依存protocol。
 *
 * `types`は型推論専用で、runtimeに実在する必要はない。
 */
export type WizStandardSchemaDefinition<TInput = unknown, TOutput = TInput> = Readonly<{
  "~standard": Readonly<{
    version: 1
    vendor: string
    validate: (
      value: unknown,
    ) => WizStandardSchemaResult<TOutput> | PromiseLike<WizStandardSchemaResult<TOutput>>
    types?:
      | Readonly<{
          input: TInput
          output: TOutput
        }>
      | undefined
  }>
}>

export type WizStandardSchemaInput<TSchema extends WizStandardSchemaDefinition> = NonNullable<
  TSchema["~standard"]["types"]
>["input"]

export type WizStandardSchemaOutput<TSchema extends WizStandardSchemaDefinition> = NonNullable<
  TSchema["~standard"]["types"]
>["output"]

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  (typeof value === "object" || typeof value === "function") &&
  value !== null &&
  "then" in value &&
  typeof value.then === "function"

const isPropertyKey = (value: unknown): value is PropertyKey =>
  typeof value === "string" || typeof value === "number" || typeof value === "symbol"

const ownPathSegment = (segment: unknown): WizStandardSchemaPathSegment => {
  if (isPropertyKey(segment)) {
    return segment
  }
  if (
    typeof segment === "object" &&
    segment !== null &&
    "key" in segment &&
    isPropertyKey(segment.key)
  ) {
    return Object.freeze({ key: segment.key })
  }

  throw new TypeError("Standard Schema returned an invalid issue path segment")
}

const ownIssue = (issue: unknown): WizStandardSchemaIssue => {
  if (
    typeof issue !== "object" ||
    issue === null ||
    !("message" in issue) ||
    typeof issue.message !== "string"
  ) {
    throw new TypeError("Standard Schema returned an invalid issue")
  }
  if (!("path" in issue) || issue.path === undefined) {
    return Object.freeze({ message: issue.message })
  }
  if (!Array.isArray(issue.path)) {
    throw new TypeError("Standard Schema returned an invalid issue path")
  }

  return Object.freeze({
    message: issue.message,
    path: Object.freeze(issue.path.map(ownPathSegment)),
  })
}

const ownIssues = (issues: unknown): readonly WizStandardSchemaIssue[] => {
  if (!Array.isArray(issues)) {
    throw new TypeError("Standard Schema returned invalid issues")
  }
  return Object.freeze(issues.map(ownIssue))
}

export class WizStandardSchemaValidationError extends TypeError {
  override readonly name = "WizStandardSchemaValidationError"
  readonly code = "STANDARD_SCHEMA_VALIDATION_FAILED"
  readonly source: string
  readonly issues: readonly WizStandardSchemaIssue[]

  constructor(source: string, issues: readonly WizStandardSchemaIssue[]) {
    const ownedIssues = Object.freeze(issues.map(ownIssue))
    super(
      `${source} validation failed with ${ownedIssues.length} issue${
        ownedIssues.length === 1 ? "" : "s"
      }`,
    )
    this.source = source
    this.issues = ownedIssues
    Object.freeze(this)
  }
}

/**
 * Standard Schema V1 validatorを同期・不変なvalidation dependencyとして捕捉する。
 *
 * schema objectそのものは保持せず、構築時のvalidator参照だけを固定する。
 */
export class WizStandardSchema<TInput, TOutput> {
  readonly source: string
  readonly validate: (input: unknown) => TOutput
  readonly vendor: string
  readonly #validateValue: WizStandardSchemaDefinition<TInput, TOutput>["~standard"]["validate"]

  private constructor(
    token: typeof standardSchemaConstructionToken,
    schema: WizStandardSchemaDefinition<TInput, TOutput>,
    source: string,
  ) {
    if (token !== standardSchemaConstructionToken) {
      throw new TypeError("WizStandardSchema must be created with WizStandardSchema.capture()")
    }
    if (source.trim().length === 0 || source !== source.trim()) {
      throw new RangeError(
        "Standard Schema source must not be empty or have surrounding whitespace",
      )
    }
    if (typeof schema !== "object" || schema === null || !("~standard" in schema)) {
      throw new TypeError("Expected a valid Standard Schema V1 definition")
    }
    const standard = schema["~standard"]
    if (
      typeof standard !== "object" ||
      standard === null ||
      standard.version !== 1 ||
      typeof standard.vendor !== "string" ||
      standard.vendor.trim().length === 0 ||
      typeof standard.validate !== "function"
    ) {
      throw new TypeError("Expected a valid Standard Schema V1 definition")
    }

    this.source = source
    this.vendor = standard.vendor
    this.#validateValue = Object.freeze(standard.validate.bind(standard))
    this.validate = Object.freeze((input: unknown): TOutput => {
      const validationResult = this.#validateValue(input)
      if (isPromiseLike(validationResult)) {
        void Promise.resolve(validationResult).catch(() => undefined)
        throw new TypeError(`${this.source} must validate synchronously`)
      }
      if (typeof validationResult !== "object" || validationResult === null) {
        throw new TypeError(`${this.source} returned an invalid Standard Schema result`)
      }
      if ("issues" in validationResult && validationResult.issues !== undefined) {
        throw new WizStandardSchemaValidationError(this.source, ownIssues(validationResult.issues))
      }
      if (!("value" in validationResult)) {
        throw new TypeError(`${this.source} returned an invalid Standard Schema result`)
      }

      return validationResult.value
    })
    Object.freeze(this)
  }

  static readonly capture = <TSchema extends WizStandardSchemaDefinition>(
    schema: TSchema,
    source = "Standard Schema",
  ): WizStandardSchema<WizStandardSchemaInput<TSchema>, WizStandardSchemaOutput<TSchema>> =>
    new WizStandardSchema(standardSchemaConstructionToken, schema, source)
}

Object.freeze(WizStandardSchema.prototype)
Object.freeze(WizStandardSchema)
Object.freeze(WizStandardSchemaValidationError.prototype)
Object.freeze(WizStandardSchemaValidationError)
