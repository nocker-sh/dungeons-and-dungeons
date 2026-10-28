import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import { assertFiniteNumberValue } from "@/lib/wiz/core/assert-finite-number-value"
import { assertRecordValue } from "@/lib/wiz/core/assert-record-value"
import { assertTrimmedNonEmptyStringValue } from "@/lib/wiz/core/assert-trimmed-non-empty-string-value"
import {
  WizAbility,
  WizAbilityBook,
  WizAbilityReadiness,
} from "@/lib/wiz/core/domain/values/ability"
import {
  WizResourceOperationError,
  WizResourceSet,
} from "@/lib/wiz/core/domain/values/resource-set"

const abilityExecutionOwnership = new WizObjectService()
const abilityActivationConstructionToken = Symbol(
  "WizAbilityActivation.constructor"
)
const abilityExecutionAcceptedConstructionToken = Symbol(
  "WizAbilityExecutionAccepted.constructor"
)
const abilityExecutionRejectedConstructionToken = Symbol(
  "WizAbilityExecutionRejected.constructor"
)
const authenticAbilityActivations = new WeakSet<object>()

export type WizAbilityExecutionPolicyDecision<TReason> =
  | Readonly<{ allowed: true }>
  | Readonly<{ allowed: false; reason: TReason }>

export type WizAbilityExecutionPolicyContext<
  TAbilityId extends string,
  TEffect,
  TCustom,
  TResourceId extends string,
  TTarget,
> = Readonly<{
  ability: WizAbility<TAbilityId, TEffect, TCustom, TResourceId>
  resources: WizResourceSet<TResourceId>
  readiness: WizAbilityReadiness<string>
  atMs: number
  target: WizDeepReadonly<TTarget>
}>

export type WizAbilityExecutionPolicy<
  TAbilityId extends string,
  TEffect,
  TCustom,
  TResourceId extends string,
  TTarget,
  TReason,
> = Readonly<{
  authorize: (
    context: WizAbilityExecutionPolicyContext<
      TAbilityId,
      TEffect,
      TCustom,
      TResourceId,
      TTarget
    >
  ) => WizAbilityExecutionPolicyDecision<TReason>
}>

export type WizAbilityExecutionRejection<TReason = unknown> =
  | Readonly<{
      code: "ABILITY_NOT_LEARNED"
      abilityId: string
    }>
  | Readonly<{
      code: "ABILITY_NOT_READY"
      abilityId: string
      readyInMs: number
    }>
  | Readonly<{
      code: "RESOURCE_INSUFFICIENT"
      resourceId: string
      available: number
      required: number
    }>
  | Readonly<{
      code: "POLICY_REJECTED"
      reason: TReason
    }>

/**
 * Abilityの入力から得られる、外部runtimeへ渡す不変の発動記録。
 *
 * hitbox、collision、animationはhostが担い、engineはeffectと時刻だけを確定する。
 */
export class WizAbilityActivation<
  TAbilityId extends string = string,
  TEffect = unknown,
  TTarget = unknown,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  declare private readonly wizAbilityActivationType: readonly [
    TAbilityId,
    TEffect,
    TTarget,
  ]
  readonly abilityId: TAbilityId
  readonly effect: WizDeepReadonly<TEffect>
  readonly target: WizDeepReadonly<TTarget>
  readonly startedAtMs: number
  readonly resolvesAtMs: number
  readonly recoversAtMs: number

  private constructor(
    token: symbol,
    definition: Readonly<{
      abilityId: TAbilityId
      effect: TEffect | WizDeepReadonly<TEffect>
      target: TTarget | WizDeepReadonly<TTarget>
      startedAtMs: number
      resolvesAtMs: number
      recoversAtMs: number
    }>
  ) {
    if (token !== abilityActivationConstructionToken) {
      throw new TypeError("WizAbilityActivation must be created with create()")
    }
    assertRecordValue("ability-execution", "activation", definition)
    assertTrimmedNonEmptyStringValue(
      "ability-execution",
      "activation.abilityId",
      definition.abilityId
    )
    for (const [path, value] of [
      ["activation.startedAtMs", definition.startedAtMs],
      ["activation.resolvesAtMs", definition.resolvesAtMs],
      ["activation.recoversAtMs", definition.recoversAtMs],
    ] as const) {
      assertFiniteNumberValue("ability-execution", path, value, {
        minimum: 0,
        safeInteger: true,
      })
    }
    if (
      definition.resolvesAtMs < definition.startedAtMs ||
      definition.recoversAtMs < definition.resolvesAtMs
    ) {
      throw new RangeError("Ability activation times must be monotonic")
    }
    this.abilityId = definition.abilityId
    this.effect = abilityExecutionOwnership.ownImmutable<TEffect>(
      definition.effect
    )
    this.target = abilityExecutionOwnership.ownImmutable<TTarget>(
      definition.target
    )
    this.startedAtMs = definition.startedAtMs
    this.resolvesAtMs = definition.resolvesAtMs
    this.recoversAtMs = definition.recoversAtMs
    authenticAbilityActivations.add(this)
    WizImmutableValue.freeze(this)
  }

  static create<
    const TAbilityId extends string,
    TEffect,
    TCustom,
    TResourceId extends string,
    TTarget,
  >(
    ability: WizAbility<TAbilityId, TEffect, TCustom, TResourceId>,
    target: TTarget | WizDeepReadonly<TTarget>,
    startedAtMs: number
  ): WizAbilityActivation<TAbilityId, TEffect, TTarget> {
    WizAbility.require(ability)
    assertFiniteNumberValue("ability-execution", "startedAtMs", startedAtMs, {
      minimum: 0,
      safeInteger: true,
    })
    const resolvesAtMs = startedAtMs + ability.castTimeMs
    const recoversAtMs = resolvesAtMs + ability.recoveryTimeMs
    return new WizAbilityActivation(abilityActivationConstructionToken, {
      abilityId: ability.id,
      effect: ability.effect,
      target,
      startedAtMs,
      resolvesAtMs,
      recoversAtMs,
    })
  }

  canResolve(atMs: number): boolean {
    assertFiniteNumberValue("ability-execution", "atMs", atMs, {
      minimum: 0,
      safeInteger: true,
    })
    return atMs >= this.resolvesAtMs
  }

  canAct(atMs: number): boolean {
    assertFiniteNumberValue("ability-execution", "atMs", atMs, {
      minimum: 0,
      safeInteger: true,
    })
    return atMs >= this.recoversAtMs
  }

  /** @internal composition boundary only. */
  static assertAuthentic(value: unknown, label = "Ability activation"): void {
    if (
      typeof value !== "object" ||
      value === null ||
      !authenticAbilityActivations.has(value)
    ) {
      throw new TypeError(
        `${label} must be created with WizAbilityActivation.create()`
      )
    }
  }
}

export class WizAbilityExecutionAccepted<
  TResourceId extends string = string,
  TAbilityId extends string = string,
  TEffect = unknown,
  TTarget = unknown,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly accepted = true
  readonly resources: WizResourceSet<TResourceId>
  readonly readiness: WizAbilityReadiness<string>
  readonly activation: WizAbilityActivation<TAbilityId, TEffect, TTarget>

  private constructor(
    token: symbol,
    resources: WizResourceSet<TResourceId>,
    readiness: WizAbilityReadiness<string>,
    activation: WizAbilityActivation<TAbilityId, TEffect, TTarget>
  ) {
    if (token !== abilityExecutionAcceptedConstructionToken) {
      throw new TypeError(
        "WizAbilityExecutionAccepted must be created by WizAbilityExecutor"
      )
    }
    WizResourceSet.require(resources)
    WizAbilityReadiness.assertAuthentic(readiness)
    WizAbilityActivation.assertAuthentic(activation)
    this.resources = resources
    this.readiness = readiness
    this.activation = activation
    WizImmutableValue.freeze(this)
  }

  /** @internal composition boundary only. */
  static create<
    TResourceId extends string,
    TAbilityId extends string,
    TEffect,
    TTarget,
  >(
    resources: WizResourceSet<TResourceId>,
    readiness: WizAbilityReadiness<string>,
    activation: WizAbilityActivation<TAbilityId, TEffect, TTarget>
  ): WizAbilityExecutionAccepted<TResourceId, TAbilityId, TEffect, TTarget> {
    return new WizAbilityExecutionAccepted(
      abilityExecutionAcceptedConstructionToken,
      resources,
      readiness,
      activation
    )
  }
}

export class WizAbilityExecutionRejected<
  TResourceId extends string = string,
  TReason = unknown,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly accepted = false
  readonly resources: WizResourceSet<TResourceId>
  readonly readiness: WizAbilityReadiness<string>
  readonly rejection: WizDeepReadonly<WizAbilityExecutionRejection<TReason>>

  private constructor(
    token: symbol,
    resources: WizResourceSet<TResourceId>,
    readiness: WizAbilityReadiness<string>,
    rejection: WizAbilityExecutionRejection<TReason>
  ) {
    if (token !== abilityExecutionRejectedConstructionToken) {
      throw new TypeError(
        "WizAbilityExecutionRejected must be created by WizAbilityExecutor"
      )
    }
    WizResourceSet.require(resources)
    WizAbilityReadiness.assertAuthentic(readiness)
    this.resources = resources
    this.readiness = readiness
    this.rejection =
      abilityExecutionOwnership.ownImmutable<
        WizAbilityExecutionRejection<TReason>
      >(rejection)
    WizImmutableValue.freeze(this)
  }

  /** @internal composition boundary only. */
  static create<TResourceId extends string, TReason>(
    resources: WizResourceSet<TResourceId>,
    readiness: WizAbilityReadiness<string>,
    rejection: WizAbilityExecutionRejection<TReason>
  ): WizAbilityExecutionRejected<TResourceId, TReason> {
    return new WizAbilityExecutionRejected(
      abilityExecutionRejectedConstructionToken,
      resources,
      readiness,
      rejection
    )
  }
}

export type WizAbilityExecutionResult<
  TResourceId extends string,
  TAbilityId extends string,
  TEffect,
  TTarget,
  TReason,
> =
  | WizAbilityExecutionAccepted<TResourceId, TAbilityId, TEffect, TTarget>
  | WizAbilityExecutionRejected<TResourceId, TReason>

/**
 * 習得、policy、cooldown、resource消費を一度に判定する純粋な計算service。
 */
export class WizAbilityExecutor {
  constructor() {
    Object.freeze(this)
  }

  execute<
    const TAbilityId extends string,
    TEffect,
    TCustom,
    TResourceId extends string,
    TTarget,
    TReason = never,
  >(
    input: Readonly<{
      ability: WizAbility<TAbilityId, TEffect, TCustom, TResourceId>
      book: WizAbilityBook<string>
      resources: WizResourceSet<TResourceId>
      readiness: WizAbilityReadiness<string>
      atMs: number
      target: TTarget | WizDeepReadonly<TTarget>
      policy?: WizAbilityExecutionPolicy<
        TAbilityId,
        TEffect,
        TCustom,
        TResourceId,
        TTarget,
        TReason
      >
    }>
  ): WizAbilityExecutionResult<
    TResourceId,
    TAbilityId,
    TEffect,
    TTarget,
    TReason
  > {
    WizAbility.require(input.ability)
    WizAbilityBook.assertAuthentic(input.book)
    WizResourceSet.require(input.resources)
    WizAbilityReadiness.assertAuthentic(input.readiness)
    assertFiniteNumberValue("ability-execution", "atMs", input.atMs, {
      minimum: 0,
      safeInteger: true,
    })
    const target = abilityExecutionOwnership.ownImmutable<TTarget>(input.target)
    if (!input.book.has(input.ability.id)) {
      return WizAbilityExecutionRejected.create(
        input.resources,
        input.readiness,
        {
          code: "ABILITY_NOT_LEARNED",
          abilityId: input.ability.id,
        }
      )
    }
    const decision = input.policy?.authorize({
      ability: input.ability,
      resources: input.resources,
      readiness: input.readiness,
      atMs: input.atMs,
      target,
    })
    if (decision?.allowed === false) {
      return WizAbilityExecutionRejected.create(
        input.resources,
        input.readiness,
        {
          code: "POLICY_REJECTED",
          reason: decision.reason,
        }
      )
    }
    const readyInMs = input.readiness.readyInMs(input.ability, input.atMs)
    if (readyInMs > 0) {
      return WizAbilityExecutionRejected.create(
        input.resources,
        input.readiness,
        {
          code: "ABILITY_NOT_READY",
          abilityId: input.ability.id,
          readyInMs,
        }
      )
    }
    let resources: WizResourceSet<TResourceId>
    try {
      resources = input.resources.spend(input.ability.costs)
    } catch (error) {
      if (!(error instanceof WizResourceOperationError)) {
        throw error
      }
      return WizAbilityExecutionRejected.create(
        input.resources,
        input.readiness,
        {
          code: "RESOURCE_INSUFFICIENT",
          resourceId: error.resourceId,
          available: error.available,
          required: error.required,
        }
      )
    }
    const readiness = input.readiness.use(input.ability, input.atMs)
    const activation = WizAbilityActivation.create<
      TAbilityId,
      TEffect,
      TCustom,
      TResourceId,
      TTarget
    >(input.ability, target, input.atMs)
    return WizAbilityExecutionAccepted.create(resources, readiness, activation)
  }
}

Object.freeze(WizAbilityActivation.prototype)
Object.freeze(WizAbilityActivation)
Object.freeze(WizAbilityExecutionAccepted.prototype)
Object.freeze(WizAbilityExecutionAccepted)
Object.freeze(WizAbilityExecutionRejected.prototype)
Object.freeze(WizAbilityExecutionRejected)
Object.freeze(WizAbilityExecutor.prototype)
Object.freeze(WizAbilityExecutor)
