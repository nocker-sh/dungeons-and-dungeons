import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type { WizAction } from "@/lib/wiz/core/runtime/action"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"

export type WizStandardPublicAction = Exclude<
  WizAction,
  Readonly<{ type: "BATTLE_EXECUTE_ACTION" }>
>

export type WizStandardActionValueFor<TAction extends WizStandardPublicAction> =
  TAction extends WizStandardPublicAction
    ? WizStandardActionValue<TAction> & WizDeepReadonly<TAction>
    : never

export const standardActionOrigins = new WeakMap<object, symbol>()

export const standardValueOwnership = new WizObjectService()

export const standardActionValueConstructionToken = Symbol(
  "WizStandardActionValue.constructor"
)

/**
 * standard runtimeが生成したbuilt-in actionの不変なnominal value。
 *
 * actionの発行元は外から観測できないworld固有tokenとして保持する。
 */
export class WizStandardActionValue<
  TAction extends WizStandardPublicAction = WizStandardPublicAction,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  declare readonly type: TAction["type"]
  readonly #actionKind = "standard"

  private constructor(
    token: typeof standardActionValueConstructionToken,
    origin: symbol,
    action: TAction
  ) {
    if (token !== standardActionValueConstructionToken) {
      throw new TypeError(
        "WizStandardActionValue must be created by a standard action factory"
      )
    }
    void this.#actionKind
    const ownedAction = standardValueOwnership.ownImmutable(action)
    Object.defineProperties(this, Object.getOwnPropertyDescriptors(ownedAction))
    standardActionOrigins.set(this, origin)
    WizImmutableValue.freeze(this)
  }

  /** @internal */
  static create<TAction extends WizStandardPublicAction>(
    token: typeof standardActionValueConstructionToken,
    origin: symbol,
    action: TAction
  ): WizStandardActionValueFor<TAction> {
    return new WizStandardActionValue(
      token,
      origin,
      action
    ) as WizStandardActionValueFor<TAction>
  }
}

Object.freeze(WizStandardActionValue.prototype)

Object.freeze(WizStandardActionValue)
