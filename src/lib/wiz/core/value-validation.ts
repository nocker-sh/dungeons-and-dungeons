import { ownWizDiagnosticValue } from "@/lib/wiz/core/diagnostic-value"

export type WizValueValidationSource =
  | "ability"
  | "ability-execution"
  | "affinity"
  | "attribute-set"
  | "battle-action-executor"
  | "battle-actor-state"
  | "battle-reward"
  | "damage-calculator"
  | "damage-result"
  | "effect"
  | "effect-resistance-set"
  | "effect-set"
  | "hunger"
  | "inventory"
  | "inn-plan"
  | "item"
  | "item-effect"
  | "modifier"
  | "modifier-set"
  | "party-growth"
  | "pending-attributes"
  | "player"
  | "quest-objective-progress"
  | "rank-progression"
  | "resource-set"
  | "reward-calculator"
  | "status"
  | "status-conversion"
  | "threat-table"
  | "wallet"

type NumericConstraints = Readonly<{
  integer?: boolean
  maximum?: number
  minimum?: number
  safeInteger?: boolean
}>

const describeValue = (value: unknown): string => {
  if (typeof value === "string") {
    return JSON.stringify(value)
  }
  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return "NaN"
    }
    if (value === Number.POSITIVE_INFINITY) {
      return "Infinity"
    }
    if (value === Number.NEGATIVE_INFINITY) {
      return "-Infinity"
    }
    return value.toString()
  }
  if (value === null) {
    return "null"
  }
  if (typeof value === "object") {
    return Array.isArray(value) ? "array" : "object"
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }
  if (typeof value === "bigint") {
    return `${value}n`
  }
  if (typeof value === "symbol") {
    return `Symbol(${value.description ?? ""})`
  }
  return typeof value
}

/**
 * 外部入力・注入式・value objectの境界で不正値を表す共通エラー。
 *
 * `value`は呼び出し側の参照を保持せず、plain object/arrayならdeep immutableな
 * diagnostic snapshotとして所有する。
 */
export class WizValueValidationError extends TypeError {
  override readonly name = "WizValueValidationError"
  readonly source: WizValueValidationSource
  readonly path: string
  readonly value: unknown
  readonly expectation: string

  constructor(source: WizValueValidationSource, path: string, value: unknown, expectation: string) {
    super(
      `Invalid value from ${source} at ${path}: expected ${expectation}, received ${describeValue(value)}`,
    )
    this.source = source
    this.path = path
    this.value = ownWizDiagnosticValue(value)
    this.expectation = expectation
    Object.freeze(this)
  }
}

export function assertRecordValue(
  source: WizValueValidationSource,
  path: string,
  value: unknown,
): asserts value is Readonly<Record<PropertyKey, unknown>> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    throw new WizValueValidationError(source, path, value, "a plain object")
  }
}

export function assertArrayValue(
  source: WizValueValidationSource,
  path: string,
  value: unknown,
): asserts value is readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new WizValueValidationError(source, path, value, "an array")
  }
}

export function assertBooleanValue(
  source: WizValueValidationSource,
  path: string,
  value: unknown,
): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new WizValueValidationError(source, path, value, "a boolean")
  }
}

export function assertTrimmedNonEmptyStringValue(
  source: WizValueValidationSource,
  path: string,
  value: unknown,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) {
    throw new WizValueValidationError(
      source,
      path,
      value,
      "a non-empty string without surrounding whitespace",
    )
  }
}

const numericExpectation = (constraints: NumericConstraints): string => {
  const descriptions = ["a finite number"]
  if (constraints.safeInteger) {
    descriptions.push("a safe integer")
  } else if (constraints.integer) {
    descriptions.push("an integer")
  }
  if (constraints.minimum !== undefined) {
    descriptions.push(`at least ${constraints.minimum}`)
  }
  if (constraints.maximum !== undefined) {
    descriptions.push(`at most ${constraints.maximum}`)
  }
  return descriptions.join(", ")
}

export function assertFiniteNumberValue(
  source: WizValueValidationSource,
  path: string,
  value: unknown,
  constraints: NumericConstraints = {},
): asserts value is number {
  const isInteger = constraints.safeInteger
    ? Number.isSafeInteger(value)
    : !constraints.integer || Number.isInteger(value)
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !isInteger ||
    (constraints.minimum !== undefined && value < constraints.minimum) ||
    (constraints.maximum !== undefined && value > constraints.maximum)
  ) {
    throw new WizValueValidationError(source, path, value, numericExpectation(constraints))
  }
}

const childPath = (path: string, key: PropertyKey): string => {
  if (typeof key === "symbol") {
    return `${path}[${String(key)}]`
  }
  const stringKey = String(key)
  if (/^(0|[1-9]\d*)$/.test(stringKey)) {
    return `${path}[${stringKey}]`
  }
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(stringKey)
    ? `${path}.${stringKey}`
    : `${path}[${JSON.stringify(stringKey)}]`
}

/**
 * custom status内の数値だけを再帰的に検証する。
 * 数値以外のcustom metadataのshapeや符号には制約を加えない。
 */
export function assertFiniteNumericFields(
  source: WizValueValidationSource,
  path: string,
  value: unknown,
  visited: WeakSet<object> = new WeakSet(),
): void {
  if (typeof value === "number") {
    assertFiniteNumberValue(source, path, value)
    return
  }
  if (typeof value !== "object" || value === null || visited.has(value)) {
    return
  }

  visited.add(value)
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === "length") {
      continue
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !("value" in descriptor)) {
      continue
    }
    assertFiniteNumericFields(source, childPath(path, key), descriptor.value, visited)
  }
}

Object.freeze(WizValueValidationError.prototype)
Object.freeze(WizValueValidationError)
