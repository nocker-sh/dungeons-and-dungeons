import {
  WIZ_IMMUTABLE_VALUE,
  type WizDeepReadonly,
  type WizImmutableValueContract,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizSceneTransition } from "@/lib/wiz/core/runtime/scene-transition"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"

const sceneResultConstructorToken = Symbol("WizSceneResult.constructor")
const authenticSceneResults = new WeakSet<object>()
const sceneResultOwnership = new WizObjectService()

export class WizSceneAcceptedResultValue<TState extends WizImmutableValueContract, TEvent = never> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly #resultKind = "accepted"
  readonly accepted = true
  readonly state: TState
  readonly transition?: WizSceneTransition
  readonly events: readonly WizDeepReadonly<TEvent>[]

  protected constructor(
    token: typeof sceneResultConstructorToken,
    state: TState,
    transition?: WizSceneTransition,
    events: readonly TEvent[] = [],
  ) {
    if (token !== sceneResultConstructorToken) {
      throw new TypeError(
        "WizSceneAcceptedResultValue must be created with WizSceneResultFactory.accept()",
      )
    }
    void this.#resultKind
    this.state = sceneResultOwnership.ownImmutable(state)
    if (transition !== undefined) {
      this.transition = sceneResultOwnership.ownImmutable(transition)
    }
    this.events = sceneResultOwnership.ownImmutable(events)
    authenticSceneResults.add(this)
    WizImmutableValue.freeze(this)
  }
}

export class WizSceneRejectedResultValue<
  TState extends WizImmutableValueContract,
  TReason extends string = string,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly #resultKind = "rejected"
  readonly accepted = false
  readonly reason: TReason
  readonly state: TState
  readonly transition?: never

  protected constructor(token: typeof sceneResultConstructorToken, state: TState, reason: TReason) {
    if (token !== sceneResultConstructorToken) {
      throw new TypeError(
        "WizSceneRejectedResultValue must be created with WizSceneResultFactory.reject()",
      )
    }
    void this.#resultKind
    this.reason = reason
    this.state = sceneResultOwnership.ownImmutable(state)
    authenticSceneResults.add(this)
    WizImmutableValue.freeze(this)
  }
}

class WizSceneAcceptedResult<
  TState extends WizImmutableValueContract,
  TEvent,
> extends WizSceneAcceptedResultValue<TState, TEvent> {
  constructor(state: TState, transition?: WizSceneTransition, events?: readonly TEvent[]) {
    super(sceneResultConstructorToken, state, transition, events)
  }
}

class WizSceneRejectedResult<
  TState extends WizImmutableValueContract,
  TReason extends string,
> extends WizSceneRejectedResultValue<TState, TReason> {
  constructor(state: TState, reason: TReason) {
    super(sceneResultConstructorToken, state, reason)
  }
}

/**
 * シーン reducer の状態型をそのまま保持する不変な戻り値。
 *
 * 値は {@link WizSceneResultFactory} だけが生成するため、raw object literalや
 * prototype偽装をscene resultとして扱えない。`accepted`で安全に判別できる。
 */
export type WizSceneResult<
  TState extends WizImmutableValueContract,
  TEvent = never,
  TReason extends string = string,
> = WizSceneAcceptedResultValue<TState, TEvent> | WizSceneRejectedResultValue<TState, TReason>

/**
 * accepted/rejectedの双方を同じownership境界で生成する唯一のfactory。
 *
 * scene stateはimmutable value contractを検証してidentityを維持し、
 * result固有のtransitionとeventsは呼び出し元からdeep-copyしてfreezeする。
 */
export class WizSceneResultFactory {
  private constructor() {
    throw new TypeError("WizSceneResultFactory is a static-only factory")
  }

  static accept<
    TState extends WizImmutableValueContract,
    const TEvents extends readonly unknown[] = readonly [],
  >(
    state: TState,
    transition?: WizSceneTransition,
    events?: TEvents,
  ): WizSceneAcceptedResultValue<TState, TEvents[number]> {
    return new WizSceneAcceptedResult<TState, TEvents[number]>(state, transition, events)
  }

  static reject<TState extends WizImmutableValueContract, const TReason extends string = string>(
    state: TState,
    reason: TReason,
  ): WizSceneRejectedResultValue<TState, TReason> {
    if (reason.trim().length === 0 || reason !== reason.trim()) {
      throw new RangeError(
        "Scene rejection reason must not be blank or have surrounding whitespace",
      )
    }
    return new WizSceneRejectedResult<TState, TReason>(state, reason)
  }

  /** @internal runtime authority boundaries only. */
  static assertAuthentic<TState extends WizImmutableValueContract, TEvent, TReason extends string>(
    result: WizSceneResult<TState, TEvent, TReason>,
  ): asserts result is WizSceneResult<TState, TEvent, TReason>
  /** @internal runtime authority boundaries only. */
  static assertAuthentic(
    result: unknown,
  ): asserts result is WizSceneResult<WizImmutableValueContract, unknown, string>
  static assertAuthentic(result: unknown): void {
    if (typeof result !== "object" || result === null || !authenticSceneResults.has(result)) {
      throw new TypeError("Scene reducer must return an authentic WizSceneResult")
    }
  }
}

Object.freeze(WizSceneAcceptedResultValue.prototype)
Object.freeze(WizSceneAcceptedResultValue)
Object.freeze(WizSceneRejectedResultValue.prototype)
Object.freeze(WizSceneRejectedResultValue)
Object.freeze(WizSceneAcceptedResult.prototype)
Object.freeze(WizSceneAcceptedResult)
Object.freeze(WizSceneRejectedResult.prototype)
Object.freeze(WizSceneRejectedResult)
Object.freeze(WizSceneResultFactory.prototype)
Object.freeze(WizSceneResultFactory)
