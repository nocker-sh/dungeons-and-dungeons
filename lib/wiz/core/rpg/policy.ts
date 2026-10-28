import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizRpgComponentIdentity } from "@/lib/wiz/core/rpg/component-identity"
import { WizRpgAffordance } from "@/lib/wiz/core/rpg/feature"

const policyConstructionToken = Symbol("WizRpgPolicy.constructor")
const authenticPolicies = new WeakSet<object>()

export type WizRpgAuthorization<TReason extends string> =
  | Readonly<{ allowed: true }>
  | Readonly<{ allowed: false; reason: TReason }>

const normalizeAuthorization = <TReason extends string>(
  authorization: unknown,
  label: string
): WizRpgAuthorization<TReason> => {
  if (
    typeof authorization !== "object" ||
    authorization === null ||
    !("allowed" in authorization)
  ) {
    throw new TypeError(`${label} must return an authorization object`)
  }
  if (authorization.allowed === true) {
    return Object.freeze({ allowed: true })
  }
  if (
    authorization.allowed !== false ||
    !("reason" in authorization) ||
    typeof authorization.reason !== "string" ||
    authorization.reason.trim().length === 0 ||
    authorization.reason !== authorization.reason.trim()
  ) {
    throw new TypeError(
      `${label} rejection must have a stable non-blank reason`
    )
  }
  return Object.freeze({
    allowed: false,
    reason: authorization.reason as TReason,
  })
}

export type WizRpgPolicyDefinition<
  TState,
  TAction,
  TReason extends string,
> = Readonly<{
  name: string
  identity: WizRpgComponentIdentity
  authorize: (
    state: WizDeepReadonly<TState>,
    action: WizDeepReadonly<TAction>
  ) => WizRpgAuthorization<TReason>
  affordances?: (
    state: WizDeepReadonly<TState>
  ) => readonly WizRpgAffordance<string, TAction, TReason>[]
}>

/**
 * UI commandの可視性とruntime action認可を一つの規則へ集約する。
 */
export class WizRpgPolicy<TState, TAction, TReason extends string = never> {
  readonly name: string
  readonly identity: WizRpgComponentIdentity
  readonly authorize: (
    state: WizDeepReadonly<TState>,
    action: WizDeepReadonly<TAction>
  ) => WizRpgAuthorization<TReason>
  readonly affordances: (
    state: WizDeepReadonly<TState>
  ) => readonly WizRpgAffordance<string, TAction, TReason>[]

  private constructor(
    token: symbol,
    definition: WizRpgPolicyDefinition<TState, TAction, TReason>
  ) {
    if (token !== policyConstructionToken) {
      throw new TypeError("WizRpgPolicy must be created with define()")
    }
    if (
      definition.name.trim().length === 0 ||
      definition.name !== definition.name.trim()
    ) {
      throw new RangeError(
        "RPG policy name must be a non-blank string without surrounding whitespace"
      )
    }
    this.name = definition.name
    this.identity = WizRpgComponentIdentity.require(
      definition.identity,
      `RPG policy "${definition.name}" identity`
    )
    const authorize = Object.freeze(definition.authorize.bind(undefined))
    this.authorize = Object.freeze(
      (state: WizDeepReadonly<TState>, action: WizDeepReadonly<TAction>) =>
        normalizeAuthorization<TReason>(
          authorize(state, action),
          `RPG policy "${definition.name}" authorize`
        )
    )
    const affordances = definition.affordances
      ? Object.freeze(definition.affordances.bind(undefined))
      : null
    this.affordances = Object.freeze((state: WizDeepReadonly<TState>) => {
      const result = affordances?.(state) ?? []
      if (!Array.isArray(result)) {
        throw new TypeError(
          `RPG policy "${definition.name}" affordances must return an array`
        )
      }
      return Object.freeze([...result])
    })
    authenticPolicies.add(this)
    Object.freeze(this)
  }

  static define<TState, TAction, TReason extends string = never>(
    definition: WizRpgPolicyDefinition<TState, TAction, TReason>
  ): WizRpgPolicy<TState, TAction, TReason> {
    return new WizRpgPolicy(policyConstructionToken, definition)
  }

  /** @internal world composition boundary only. */
  static require(value: unknown, label: string): void {
    if (
      typeof value !== "object" ||
      value === null ||
      !authenticPolicies.has(value)
    ) {
      throw new TypeError(`${label} must be created with WizRpgPolicy.define()`)
    }
  }
}

Object.freeze(WizRpgPolicy.prototype)
Object.freeze(WizRpgPolicy)
