import {
  WIZ_IMMUTABLE_VALUE,
  type WizDeepReadonly,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import {
  assertFiniteNumberValue,
  assertRecordValue,
  assertTrimmedNonEmptyStringValue,
  WizValueValidationError,
} from "@/lib/wiz/core/value-validation"

export type WizWalletState<TCurrencyId extends string = string> = Readonly<
  Record<TCurrencyId, number>
>

export type WizWalletAmounts<TCurrencyId extends string = string> = Readonly<
  Partial<Record<TCurrencyId, number>>
>

export type WizWalletOperationErrorCode = "CURRENCY_INSUFFICIENT" | "CURRENCY_NOT_FOUND"

const walletConstructionToken = Symbol("WizWallet.constructor")
const authenticWallets = new WeakSet<object>()
const walletOwnership = new WizObjectService()

const assertCurrencyAmount = (path: string, amount: unknown): void => {
  assertFiniteNumberValue("wallet", path, amount, {
    minimum: 0,
    safeInteger: true,
  })
}

const parseWalletState = <TCurrencyId extends string>(
  input: WizWalletState<TCurrencyId>,
): WizWalletState<TCurrencyId> => {
  assertRecordValue("wallet", "$", input)
  for (const [currencyId, amount] of Object.entries(input)) {
    assertTrimmedNonEmptyStringValue("wallet", "currencyId", currencyId)
    assertCurrencyAmount(currencyId, amount)
  }
  return input
}

const parseAmounts = <TCurrencyId extends string>(
  input: WizWalletAmounts<TCurrencyId>,
): WizWalletAmounts<TCurrencyId> => {
  assertRecordValue("wallet", "amounts", input)
  for (const [currencyId, amount] of Object.entries(input)) {
    assertTrimmedNonEmptyStringValue("wallet", "amounts.currencyId", currencyId)
    assertCurrencyAmount(`amounts.${currencyId}`, amount)
  }
  return input
}

export class WizWalletOperationError extends Error {
  override readonly name = "WizWalletOperationError"
  readonly code: WizWalletOperationErrorCode
  readonly currencyId: string
  readonly available: number
  readonly required: number

  constructor(
    code: WizWalletOperationErrorCode,
    currencyId: string,
    available: number,
    required: number,
  ) {
    if (code !== "CURRENCY_INSUFFICIENT" && code !== "CURRENCY_NOT_FOUND") {
      throw new WizValueValidationError(
        "wallet",
        "operation.code",
        code,
        "a known wallet operation error code",
      )
    }
    assertTrimmedNonEmptyStringValue("wallet", "operation.currencyId", currencyId)
    assertCurrencyAmount("operation.available", available)
    assertCurrencyAmount("operation.required", required)
    super(`${code}: "${currencyId}" requires ${required}, available ${available}`)
    this.code = code
    this.currencyId = currencyId
    this.available = available
    this.required = required
    Object.freeze(this)
  }
}

/**
 * 複数通貨を一括で増減する不変wallet。
 */
export class WizWallet<TCurrencyId extends string = string> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly #state: WizWalletState<TCurrencyId>

  private constructor(token: typeof walletConstructionToken, state: WizWalletState<TCurrencyId>) {
    if (token !== walletConstructionToken) {
      throw new TypeError("WizWallet must be created with create() or fromUnknown()")
    }
    this.#state = walletOwnership.ownImmutable(parseWalletState(state))
    authenticWallets.add(this)
    WizImmutableValue.freeze(this)
  }

  static create<const TCurrencyId extends string>(
    state: WizWalletState<TCurrencyId>,
  ): WizWallet<TCurrencyId> {
    return new WizWallet<TCurrencyId>(walletConstructionToken, state)
  }

  static fromUnknown<const TCurrencyIds extends readonly string[]>(
    currencyIds: TCurrencyIds,
    input: unknown,
  ): WizWallet<TCurrencyIds[number]> {
    if (!Array.isArray(currencyIds)) {
      throw new TypeError("Currency IDs must be an array")
    }
    const expectedIds = new Set<string>()
    for (const [index, currencyId] of currencyIds.entries()) {
      assertTrimmedNonEmptyStringValue("wallet", `currencyIds[${index}]`, currencyId)
      if (expectedIds.has(currencyId)) {
        throw new RangeError(`Duplicate currency id "${currencyId}"`)
      }
      expectedIds.add(currencyId)
    }
    assertRecordValue("wallet", "$", input)
    const actualIds = Reflect.ownKeys(input)
    if (
      actualIds.length !== expectedIds.size ||
      actualIds.some((currencyId) => typeof currencyId !== "string" || !expectedIds.has(currencyId))
    ) {
      throw new RangeError("Wallet state must contain exactly the declared currency IDs")
    }
    return new WizWallet(walletConstructionToken, input as WizWalletState<TCurrencyIds[number]>)
  }

  static require(value: unknown, label = "Wallet"): asserts value is WizWallet {
    if (typeof value !== "object" || value === null || !authenticWallets.has(value)) {
      throw new TypeError(`${label} must be created with WizWallet.create() or fromUnknown()`)
    }
  }

  has(currencyId: string): currencyId is TCurrencyId {
    return Object.hasOwn(this.#state, currencyId)
  }

  balance(currencyId: TCurrencyId): number {
    if (!this.has(currencyId)) {
      throw new WizWalletOperationError("CURRENCY_NOT_FOUND", currencyId, 0, 0)
    }
    return this.#state[currencyId]
  }

  canDebit(amounts: WizWalletAmounts<TCurrencyId>): boolean {
    parseAmounts(amounts)
    return (Object.entries(amounts) as [TCurrencyId, number][]).every(
      ([currencyId, amount]) => this.has(currencyId) && this.balance(currencyId) >= (amount ?? 0),
    )
  }

  credit(amounts: WizWalletAmounts<TCurrencyId>): WizWallet<TCurrencyId> {
    parseAmounts(amounts)
    const next: Record<string, number> = { ...this.#state }
    for (const [currencyId, amount] of Object.entries(amounts) as [TCurrencyId, number][]) {
      if (!this.has(currencyId)) {
        throw new WizWalletOperationError("CURRENCY_NOT_FOUND", currencyId, 0, amount ?? 0)
      }
      next[currencyId] = this.balance(currencyId) + (amount ?? 0)
      assertCurrencyAmount(currencyId, next[currencyId])
    }
    return new WizWallet<TCurrencyId>(walletConstructionToken, next as WizWalletState<TCurrencyId>)
  }

  debit(amounts: WizWalletAmounts<TCurrencyId>): WizWallet<TCurrencyId> {
    parseAmounts(amounts)
    for (const [currencyId, amount] of Object.entries(amounts) as [TCurrencyId, number][]) {
      const required = amount ?? 0
      if (!this.has(currencyId)) {
        throw new WizWalletOperationError("CURRENCY_NOT_FOUND", currencyId, 0, required)
      }
      const available = this.balance(currencyId)
      if (available < required) {
        throw new WizWalletOperationError("CURRENCY_INSUFFICIENT", currencyId, available, required)
      }
    }
    return new WizWallet<TCurrencyId>(
      walletConstructionToken,
      Object.fromEntries(
        (Object.entries(this.#state) as [TCurrencyId, number][]).map(([currencyId, amount]) => [
          currencyId,
          amount - (amounts[currencyId] ?? 0),
        ]),
      ) as WizWalletState<TCurrencyId>,
    )
  }

  toPlain(): WizDeepReadonly<WizWalletState<TCurrencyId>> {
    return this.#state as WizDeepReadonly<WizWalletState<TCurrencyId>>
  }
}

Object.freeze(WizWalletOperationError.prototype)
Object.freeze(WizWalletOperationError)
Object.freeze(WizWallet.prototype)
Object.freeze(WizWallet)
