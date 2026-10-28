import { ownWizDiagnosticValue } from "@/lib/wiz/core/diagnostic-value"
import { describeValue } from "@/lib/wiz/core/describe-value"

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

export type NumericConstraints = Readonly<{
  integer?: boolean
  maximum?: number
  minimum?: number
  safeInteger?: boolean
}>

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

  constructor(
    source: WizValueValidationSource,
    path: string,
    value: unknown,
    expectation: string
  ) {
    super(
      `Invalid value from ${source} at ${path}: expected ${expectation}, received ${describeValue(value)}`
    )
    this.source = source
    this.path = path
    this.value = ownWizDiagnosticValue(value)
    this.expectation = expectation
    Object.freeze(this)
  }
}

Object.freeze(WizValueValidationError.prototype)

Object.freeze(WizValueValidationError)
