import {
  WIZ_IMMUTABLE_VALUE,
  type WizDeepReadonly,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import {
  assertArrayValue,
  assertFiniteNumberValue,
  assertRecordValue,
  assertTrimmedNonEmptyStringValue,
  WizValueValidationError,
} from "@/lib/wiz/core/value-validation"

export type WizEffectLifetime =
  | Readonly<{ type: "permanent" }>
  | Readonly<{ type: "time"; expiresAtMs: number }>
  | Readonly<{ type: "turns"; remaining: number }>
  | Readonly<{ type: "uses"; remaining: number }>

export type WizEffectDefinition<
  TInstanceId extends string = string,
  TEffectId extends string = string,
  TSourceId extends string = string,
  TPayload = unknown,
> = Readonly<{
  instanceId: TInstanceId
  effectId: TEffectId
  sourceId: TSourceId
  tags?: readonly string[]
  stacks?: number
  maximumStacks?: number
  lifetime: WizEffectLifetime
  payload: TPayload | WizDeepReadonly<TPayload>
}>

export type WizEffectProperties<
  TInstanceId extends string = string,
  TEffectId extends string = string,
  TSourceId extends string = string,
  TPayload = unknown,
> = Readonly<{
  instanceId: TInstanceId
  effectId: TEffectId
  sourceId: TSourceId
  tags: readonly string[]
  stacks: number
  maximumStacks: number
  lifetime: WizEffectLifetime
  payload: WizDeepReadonly<TPayload>
}>

type AnyWizEffect = WizEffect<string, string, string, unknown>

export type WizEffectStackingRule<TEffect extends AnyWizEffect = AnyWizEffect> = Readonly<{
  combine: (current: readonly TEffect[], incoming: TEffect) => readonly TEffect[]
}>

const effectConstructionToken = Symbol("WizEffect.constructor")
const effectSetConstructionToken = Symbol("WizEffectSet.constructor")
const authenticEffects = new WeakSet<object>()
const authenticEffectSets = new WeakSet<object>()
const effectOwnership = new WizObjectService()

const assertLifetime: (lifetime: unknown) => asserts lifetime is WizEffectLifetime = (lifetime) => {
  assertRecordValue("effect", "lifetime", lifetime)
  if (lifetime.type === "permanent") return
  if (lifetime.type === "time") {
    assertFiniteNumberValue("effect", "lifetime.expiresAtMs", lifetime.expiresAtMs, {
      minimum: 0,
      safeInteger: true,
    })
    return
  }
  if (lifetime.type === "turns" || lifetime.type === "uses") {
    assertFiniteNumberValue("effect", "lifetime.remaining", lifetime.remaining, {
      minimum: 1,
      safeInteger: true,
    })
    return
  }
  throw new WizValueValidationError(
    "effect",
    "lifetime.type",
    lifetime.type,
    "permanent, time, turns, or uses",
  )
}

const assertTags = (tags: readonly unknown[]): void => {
  assertArrayValue("effect", "tags", tags)
  const seen = new Set<string>()
  for (const [index, tag] of tags.entries()) {
    assertTrimmedNonEmptyStringValue("effect", `tags[${index}]`, tag)
    if (seen.has(tag)) {
      throw new RangeError(`Duplicate effect tag "${tag}"`)
    }
    seen.add(tag)
  }
}

/**
 * 時間、使用回数、永続のいずれかで寿命を表す汎用effect instance。
 */
export class WizEffect<
  TInstanceId extends string = string,
  TEffectId extends string = string,
  TSourceId extends string = string,
  TPayload = unknown,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly instanceId: TInstanceId
  readonly effectId: TEffectId
  readonly sourceId: TSourceId
  readonly tags: readonly string[]
  readonly stacks: number
  readonly maximumStacks: number
  readonly lifetime: WizEffectLifetime
  readonly payload: WizDeepReadonly<TPayload>

  private constructor(
    token: typeof effectConstructionToken,
    definition: WizEffectDefinition<TInstanceId, TEffectId, TSourceId, TPayload>,
  ) {
    if (token !== effectConstructionToken) {
      throw new TypeError("WizEffect must be created with define()")
    }
    assertRecordValue("effect", "$", definition)
    assertTrimmedNonEmptyStringValue("effect", "instanceId", definition.instanceId)
    assertTrimmedNonEmptyStringValue("effect", "effectId", definition.effectId)
    assertTrimmedNonEmptyStringValue("effect", "sourceId", definition.sourceId)
    assertTags(definition.tags ?? [])
    assertFiniteNumberValue("effect", "maximumStacks", definition.maximumStacks ?? 1, {
      minimum: 1,
      safeInteger: true,
    })
    assertFiniteNumberValue("effect", "stacks", definition.stacks ?? 1, {
      maximum: definition.maximumStacks ?? 1,
      minimum: 1,
      safeInteger: true,
    })
    assertLifetime(definition.lifetime)
    this.instanceId = definition.instanceId
    this.effectId = definition.effectId
    this.sourceId = definition.sourceId
    this.tags = effectOwnership.ownImmutable(definition.tags ?? [])
    this.stacks = definition.stacks ?? 1
    this.maximumStacks = definition.maximumStacks ?? 1
    this.lifetime = effectOwnership.ownImmutable(definition.lifetime)
    this.payload = effectOwnership.ownImmutable<TPayload>(definition.payload)
    authenticEffects.add(this)
    WizImmutableValue.freeze(this)
  }

  static define<
    const TInstanceId extends string,
    const TEffectId extends string,
    const TSourceId extends string,
    TPayload,
  >(
    definition: WizEffectDefinition<TInstanceId, TEffectId, TSourceId, TPayload>,
  ): WizEffect<TInstanceId, TEffectId, TSourceId, TPayload> {
    return new WizEffect(effectConstructionToken, definition)
  }

  static require(value: unknown, label = "Effect"): asserts value is WizEffect {
    if (typeof value !== "object" || value === null || !authenticEffects.has(value)) {
      throw new TypeError(`${label} must be created with WizEffect.define()`)
    }
  }

  isActive(atMs: number): boolean {
    assertFiniteNumberValue("effect", "atMs", atMs, { minimum: 0, safeInteger: true })
    if (this.lifetime.type === "time") return this.lifetime.expiresAtMs > atMs
    if (this.lifetime.type === "turns" || this.lifetime.type === "uses") {
      return this.lifetime.remaining > 0
    }
    return true
  }

  withStacks(stacks: number): WizEffect<TInstanceId, TEffectId, TSourceId, TPayload> {
    return WizEffect.define({
      ...this.toProperties(),
      stacks,
    })
  }

  withLifetime(
    lifetime: WizEffectLifetime,
  ): WizEffect<TInstanceId, TEffectId, TSourceId, TPayload> {
    return WizEffect.define({
      ...this.toProperties(),
      lifetime,
    })
  }

  consumeUse(): WizEffect<TInstanceId, TEffectId, TSourceId, TPayload> | null {
    if (this.lifetime.type !== "uses") return this
    if (this.lifetime.remaining === 1) return null
    return this.withLifetime({
      remaining: this.lifetime.remaining - 1,
      type: "uses",
    })
  }

  advanceTurn(): WizEffect<TInstanceId, TEffectId, TSourceId, TPayload> | null {
    if (this.lifetime.type !== "turns") return this
    if (this.lifetime.remaining === 1) return null
    return this.withLifetime({
      remaining: this.lifetime.remaining - 1,
      type: "turns",
    })
  }

  toProperties(): WizEffectProperties<TInstanceId, TEffectId, TSourceId, TPayload> {
    return {
      effectId: this.effectId,
      instanceId: this.instanceId,
      lifetime: this.lifetime,
      maximumStacks: this.maximumStacks,
      payload: this.payload,
      sourceId: this.sourceId,
      stacks: this.stacks,
      tags: this.tags,
    }
  }
}

/**
 * effect instanceを不変に保持し、寿命とstack ruleを適用するcollection。
 */
export class WizEffectSet<TEffect extends AnyWizEffect = AnyWizEffect> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly effects: readonly TEffect[]

  private constructor(token: typeof effectSetConstructionToken, effects: readonly TEffect[]) {
    if (token !== effectSetConstructionToken) {
      throw new TypeError("WizEffectSet must be created with create()")
    }
    assertArrayValue("effect-set", "$", effects)
    const seen = new Set<string>()
    for (const [index, effect] of effects.entries()) {
      WizEffect.require(effect, `Effect at index ${index}`)
      if (seen.has(effect.instanceId)) {
        throw new RangeError(`Duplicate effect instance id "${effect.instanceId}"`)
      }
      seen.add(effect.instanceId)
    }
    this.effects = Object.freeze([...effects])
    authenticEffectSets.add(this)
    WizImmutableValue.freeze(this)
  }

  static create<const TEffects extends readonly AnyWizEffect[]>(
    effects: TEffects = [] as unknown as TEffects,
  ): WizEffectSet<TEffects[number]> {
    return new WizEffectSet(effectSetConstructionToken, effects)
  }

  static require(value: unknown, label = "Effect set"): asserts value is WizEffectSet {
    if (typeof value !== "object" || value === null || !authenticEffectSets.has(value)) {
      throw new TypeError(`${label} must be created with WizEffectSet.create()`)
    }
  }

  apply<TIncoming extends AnyWizEffect>(
    incoming: TIncoming,
    rule?: WizEffectStackingRule<TEffect | TIncoming>,
  ): WizEffectSet<TEffect | TIncoming> {
    WizEffect.require(incoming)
    if (rule === undefined) {
      const withoutSameInstance = this.effects.filter(
        (effect) => effect.instanceId !== incoming.instanceId,
      )
      return new WizEffectSet(effectSetConstructionToken, [...withoutSameInstance, incoming])
    }
    assertRecordValue("effect-set", "rule", rule)
    if (typeof rule.combine !== "function") {
      throw new TypeError("Effect stacking rule combine must be a function")
    }
    const sameDefinition = this.effects.filter(
      (effect) => effect.effectId === incoming.effectId,
    ) as readonly (TEffect | TIncoming)[]
    const combined = rule.combine(Object.freeze([...sameDefinition]), incoming)
    assertArrayValue("effect-set", "rule.result", combined)
    const otherDefinitions = this.effects.filter((effect) => effect.effectId !== incoming.effectId)
    return new WizEffectSet(effectSetConstructionToken, [...otherDefinitions, ...combined])
  }

  remove(instanceId: string): WizEffectSet<TEffect> {
    return new WizEffectSet(
      effectSetConstructionToken,
      this.effects.filter((effect) => effect.instanceId !== instanceId),
    )
  }

  removeTag(tag: string): WizEffectSet<TEffect> {
    assertTrimmedNonEmptyStringValue("effect-set", "tag", tag)
    return new WizEffectSet(
      effectSetConstructionToken,
      this.effects.filter((effect) => !effect.tags.includes(tag)),
    )
  }

  active(atMs: number): readonly TEffect[] {
    return Object.freeze(this.effects.filter((effect) => effect.isActive(atMs)))
  }

  compact(atMs: number): WizEffectSet<TEffect> {
    return new WizEffectSet(effectSetConstructionToken, this.active(atMs))
  }

  consumeUse(instanceId: string): WizEffectSet<TEffect> {
    const effect = this.effects.find((candidate) => candidate.instanceId === instanceId)
    if (effect === undefined) {
      throw new RangeError(`Unknown effect instance id "${instanceId}"`)
    }
    const consumed = effect.consumeUse()
    return new WizEffectSet(
      effectSetConstructionToken,
      this.effects.flatMap((candidate) => {
        if (candidate.instanceId !== instanceId) return [candidate]
        return consumed === null ? [] : [consumed as TEffect]
      }),
    )
  }

  advanceTurn(): WizEffectSet<TEffect> {
    return new WizEffectSet(
      effectSetConstructionToken,
      this.effects.flatMap((effect) => {
        const advanced = effect.advanceTurn()
        return advanced === null ? [] : [advanced as TEffect]
      }),
    )
  }

  toPlain(): readonly WizDeepReadonly<WizEffectProperties>[] {
    return effectOwnership.ownImmutable(this.effects.map((effect) => effect.toProperties()))
  }
}

Object.freeze(WizEffect.prototype)
Object.freeze(WizEffect)
Object.freeze(WizEffectSet.prototype)
Object.freeze(WizEffectSet)
