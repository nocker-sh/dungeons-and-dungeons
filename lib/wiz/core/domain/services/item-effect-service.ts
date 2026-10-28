import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizItemEffectDefinition } from "@/lib/wiz/core/types/item-effect"
import { assertBooleanValue } from "@/lib/wiz/core/assert-boolean-value"
import { assertFiniteNumberValue } from "@/lib/wiz/core/assert-finite-number-value"
import { assertRecordValue } from "@/lib/wiz/core/assert-record-value"
import { assertTrimmedNonEmptyStringValue } from "@/lib/wiz/core/assert-trimmed-non-empty-string-value"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

/**
 * Item effects are represented as semantic events. Presentation adapters can
 * translate these events without putting locale-specific text in the core.
 */
export type WizItemEffectEvent =
  | Readonly<{ type: "hp_restored"; amount: number }>
  | Readonly<{ type: "mp_restored"; amount: number }>
  | Readonly<{ type: "hunger_restored"; amount: number }>
  | Readonly<{
      type: "temporary_stat_increased"
      stat: string
      amount: number
      duration: number
    }>
  | Readonly<{ type: "revived"; hp: number }>
  | Readonly<{ type: "status_cured"; effectId?: string }>
  | Readonly<{
      type: "teleport_requested"
      targetId?: string
      destination?: string
    }>
  | Readonly<{ type: "light_activated" }>
  | Readonly<{ type: "poison_requested"; potency?: number }>
  | Readonly<{ type: "trap_requested"; power?: number }>
  | Readonly<{ type: "fuel_requested"; amount?: number }>
  | Readonly<{ type: "unlock_requested"; targetId?: string }>

export type WizItemEffectRejection =
  | Readonly<{ type: "missing_effect" }>
  | Readonly<{ type: "target_not_defeated" }>
  | Readonly<{
      type: "no_change"
      effectType: "heal" | "restore_mp" | "food" | "revive"
    }>
  | Readonly<{
      type: "unsupported_effect"
      effectType: WizItemEffectDefinition["type"]
      target: string
    }>
  | Readonly<{
      type: "context_required"
      effectType: "damage" | "escape"
      context: "battle"
    }>
  | Readonly<{
      type: "invalid_value"
      effectType: WizItemEffectDefinition["type"]
      field: string
      value: string
    }>

export type WizItemEffectResult<TTarget> =
  | Readonly<{
      applied: true
      target: WizDeepReadonly<TTarget>
      events: readonly WizItemEffectEvent[]
    }>
  | Readonly<{
      applied: false
      target: WizDeepReadonly<TTarget>
      rejection: WizItemEffectRejection
    }>

export type WizItemEffectTargetSnapshotDefinition = Readonly<{
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  hunger: number
  maxHunger: number
  defeated: boolean
}>

const itemEffectTargetSnapshotConstructorToken = Symbol(
  "item-effect-target-snapshot"
)
const authenticItemEffectTargetSnapshots =
  new WeakSet<WizItemEffectTargetSnapshot>()

/**
 * adapterのinspect出力を検証・所有したcanonical snapshot。
 */
export class WizItemEffectTargetSnapshot {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly hp: number
  readonly maxHp: number
  readonly mp: number
  readonly maxMp: number
  readonly hunger: number
  readonly maxHunger: number
  readonly defeated: boolean

  private constructor(
    token: typeof itemEffectTargetSnapshotConstructorToken,
    definition: WizItemEffectTargetSnapshotDefinition
  ) {
    if (token !== itemEffectTargetSnapshotConstructorToken) {
      throw new TypeError(
        "WizItemEffectTargetSnapshot must be created with create() or fromUnknown()"
      )
    }
    this.hp = definition.hp
    this.maxHp = definition.maxHp
    this.mp = definition.mp
    this.maxMp = definition.maxMp
    this.hunger = definition.hunger
    this.maxHunger = definition.maxHunger
    this.defeated = definition.defeated
    authenticItemEffectTargetSnapshots.add(this)
    WizImmutableValue.freeze(this)
  }

  static create(
    definition: WizItemEffectTargetSnapshotDefinition
  ): WizItemEffectTargetSnapshot {
    return WizItemEffectTargetSnapshot.fromUnknown(definition)
  }

  static fromUnknown(input: unknown): WizItemEffectTargetSnapshot {
    if (
      input instanceof WizItemEffectTargetSnapshot &&
      authenticItemEffectTargetSnapshots.has(input)
    ) {
      return input
    }

    const owned = new WizObjectService().ownImmutable(input)
    assertRecordValue("item-effect", "targetSnapshot", owned)
    assertFiniteNumberValue(
      "item-effect",
      "targetSnapshot.maxHp",
      owned.maxHp,
      {
        minimum: 0,
      }
    )
    assertFiniteNumberValue("item-effect", "targetSnapshot.hp", owned.hp, {
      maximum: owned.maxHp,
      minimum: 0,
    })
    assertFiniteNumberValue(
      "item-effect",
      "targetSnapshot.maxMp",
      owned.maxMp,
      {
        minimum: 0,
      }
    )
    assertFiniteNumberValue("item-effect", "targetSnapshot.mp", owned.mp, {
      maximum: owned.maxMp,
      minimum: 0,
    })
    assertFiniteNumberValue(
      "item-effect",
      "targetSnapshot.maxHunger",
      owned.maxHunger,
      {
        minimum: 0,
      }
    )
    assertFiniteNumberValue(
      "item-effect",
      "targetSnapshot.hunger",
      owned.hunger,
      {
        maximum: owned.maxHunger,
        minimum: 0,
      }
    )
    assertBooleanValue("item-effect", "targetSnapshot.defeated", owned.defeated)

    return new WizItemEffectTargetSnapshot(
      itemEffectTargetSnapshotConstructorToken,
      {
        hp: owned.hp,
        maxHp: owned.maxHp,
        mp: owned.mp,
        maxMp: owned.maxMp,
        hunger: owned.hunger,
        maxHunger: owned.maxHunger,
        defeated: owned.defeated,
      }
    )
  }
}

Object.freeze(WizItemEffectTargetSnapshot.prototype)
Object.freeze(WizItemEffectTargetSnapshot)

/**
 * Bridges an application's immutable character value to item-effect semantics.
 * `applyEvent` should return a new target instead of mutating its argument.
 */
export type WizItemEffectTargetAdapter<TTarget> = Readonly<{
  inspect: (
    target: WizDeepReadonly<TTarget>
  ) => WizItemEffectTargetSnapshotDefinition
  applyEvent: (
    target: WizDeepReadonly<TTarget>,
    event: WizItemEffectEvent
  ) => TTarget | WizDeepReadonly<TTarget>
}>

export type WizItemEffectApplicationService<TTarget> = Readonly<{
  apply: (
    target: TTarget | WizDeepReadonly<TTarget>,
    effect: WizItemEffectDefinition | undefined
  ) => WizItemEffectResult<TTarget>
}>

/**
 * Pure, locale-independent item-effect application service.
 *
 * Target storage is deliberately injected so the same semantics can be used
 * with a built-in player value or an application's own immutable character.
 */
export class WizItemEffectService<
  TTarget,
> implements WizItemEffectApplicationService<TTarget> {
  private readonly targetAdapter: WizItemEffectTargetAdapter<TTarget>

  constructor(targetAdapter: WizItemEffectTargetAdapter<TTarget>) {
    this.targetAdapter = Object.freeze({
      inspect: targetAdapter.inspect.bind(targetAdapter),
      applyEvent: targetAdapter.applyEvent.bind(targetAdapter),
    })
    Object.freeze(this)
  }

  readonly apply = (
    target: TTarget | WizDeepReadonly<TTarget>,
    effect: WizItemEffectDefinition | undefined
  ): WizItemEffectResult<TTarget> => {
    const targetOwnership = new WizObjectService()
    const immutableTarget = targetOwnership.ownImmutable<TTarget>(target)
    if (!effect) {
      return rejected<TTarget>(immutableTarget, { type: "missing_effect" })
    }

    const snapshot = WizItemEffectTargetSnapshot.fromUnknown(
      this.targetAdapter.inspect(immutableTarget)
    )

    switch (effect.type) {
      case "heal": {
        const invalid = invalidValue(effect.type, "value", effect.value)
        if (invalid) return rejected<TTarget>(immutableTarget, invalid)
        const amount = restoredAmount(snapshot.hp, snapshot.maxHp, effect.value)
        if (amount === 0) {
          return rejected<TTarget>(immutableTarget, {
            type: "no_change",
            effectType: effect.type,
          })
        }
        return this.applied(immutableTarget, [
          {
            type: "hp_restored",
            amount,
          },
        ])
      }
      case "restore_mp": {
        const invalid = invalidValue(effect.type, "value", effect.value)
        if (invalid) return rejected<TTarget>(immutableTarget, invalid)
        const amount = restoredAmount(snapshot.mp, snapshot.maxMp, effect.value)
        if (amount === 0) {
          return rejected<TTarget>(immutableTarget, {
            type: "no_change",
            effectType: effect.type,
          })
        }
        return this.applied(immutableTarget, [
          {
            type: "mp_restored",
            amount,
          },
        ])
      }
      case "food": {
        const invalidHunger = invalidValue(
          effect.type,
          "hungerRestore",
          effect.hungerRestore
        )
        if (invalidHunger)
          return rejected<TTarget>(immutableTarget, invalidHunger)
        const invalidHeal =
          effect.healValue === undefined
            ? undefined
            : invalidValue(effect.type, "healValue", effect.healValue)
        if (invalidHeal) return rejected<TTarget>(immutableTarget, invalidHeal)

        const events: WizItemEffectEvent[] = []
        const hungerAmount = restoredAmount(
          snapshot.hunger,
          snapshot.maxHunger,
          effect.hungerRestore
        )
        if (hungerAmount > 0) {
          events.push({
            type: "hunger_restored",
            amount: hungerAmount,
          })
        }
        const hpAmount =
          effect.healValue === undefined
            ? 0
            : restoredAmount(snapshot.hp, snapshot.maxHp, effect.healValue)
        if (hpAmount > 0) {
          events.push({
            type: "hp_restored",
            amount: hpAmount,
          })
        }
        if (events.length === 0) {
          return rejected<TTarget>(immutableTarget, {
            type: "no_change",
            effectType: effect.type,
          })
        }
        return this.applied(immutableTarget, events)
      }
      case "buff": {
        const invalidValueResult = invalidValue(
          effect.type,
          "value",
          effect.value,
          {
            positive: true,
          }
        )
        if (invalidValueResult) {
          return rejected<TTarget>(immutableTarget, invalidValueResult)
        }
        const invalidDuration = invalidValue(
          effect.type,
          "duration",
          effect.duration,
          {
            positive: true,
            safeInteger: true,
          }
        )
        if (invalidDuration) {
          return rejected<TTarget>(immutableTarget, invalidDuration)
        }
        return this.applied(immutableTarget, [
          {
            type: "temporary_stat_increased",
            stat: effect.stat,
            amount: effect.value,
            duration: effect.duration,
          },
        ])
      }
      case "revive": {
        if (!snapshot.defeated) {
          return rejected<TTarget>(immutableTarget, {
            type: "target_not_defeated",
          })
        }
        if (snapshot.maxHp === 0) {
          return rejected<TTarget>(immutableTarget, {
            type: "no_change",
            effectType: effect.type,
          })
        }
        const percentage = effect.value ?? 50
        const invalid = invalidValue(effect.type, "value", percentage, {
          positive: true,
        })
        if (invalid) return rejected<TTarget>(immutableTarget, invalid)
        const hp = Math.max(
          1,
          Math.min(
            snapshot.maxHp,
            Math.floor(snapshot.maxHp * (percentage / 100))
          )
        )
        return this.applied(immutableTarget, [{ type: "revived", hp }])
      }
      case "cure":
        return this.applied(immutableTarget, [
          {
            type: "status_cured",
            ...(effect.effectId === undefined
              ? {}
              : { effectId: effect.effectId }),
          },
        ])
      case "damage":
      case "escape":
        return rejected<TTarget>(immutableTarget, {
          type: "context_required",
          effectType: effect.type,
          context: "battle",
        })
      case "teleport":
        return this.applied(immutableTarget, [
          {
            type: "teleport_requested",
            targetId: effect.targetId,
            destination: effect.destination,
          },
        ])
      case "torch":
        return this.applied(immutableTarget, [{ type: "light_activated" }])
      case "poison":
        if (effect.value !== undefined) {
          const invalid = invalidValue(effect.type, "value", effect.value)
          if (invalid) return rejected<TTarget>(immutableTarget, invalid)
        }
        return this.applied(immutableTarget, [
          { type: "poison_requested", potency: effect.value },
        ])
      case "trap":
        if (effect.value !== undefined) {
          const invalid = invalidValue(effect.type, "value", effect.value)
          if (invalid) return rejected<TTarget>(immutableTarget, invalid)
        }
        return this.applied(immutableTarget, [
          { type: "trap_requested", power: effect.value },
        ])
      case "fuel":
        if (effect.value !== undefined) {
          const invalid = invalidValue(effect.type, "value", effect.value)
          if (invalid) return rejected<TTarget>(immutableTarget, invalid)
        }
        return this.applied(immutableTarget, [
          { type: "fuel_requested", amount: effect.value },
        ])
      case "unlock":
        return this.applied(immutableTarget, [
          {
            type: "unlock_requested",
            targetId: effect.targetId,
          },
        ])
    }
  }

  private applied(
    target: WizDeepReadonly<TTarget>,
    events: readonly WizItemEffectEvent[]
  ): WizItemEffectResult<TTarget> {
    const immutableEvents = Object.freeze(
      events.map((event, index) => ownItemEffectEvent(event, index))
    )
    const targetOwnership = new WizObjectService()
    const nextTarget = immutableEvents.reduce<WizDeepReadonly<TTarget>>(
      (current, event) => {
        const ownedNextTarget = targetOwnership.ownImmutable<TTarget>(
          this.targetAdapter.applyEvent(current, event)
        )
        WizItemEffectTargetSnapshot.fromUnknown(
          this.targetAdapter.inspect(ownedNextTarget)
        )
        return ownedNextTarget
      },
      target
    )
    return Object.freeze({
      applied: true,
      target: nextTarget,
      events: immutableEvents,
    })
  }
}

function ownItemEffectEvent(
  event: WizItemEffectEvent,
  index: number
): WizItemEffectEvent {
  const owned = new WizObjectService().ownImmutable(event)
  assertRecordValue("item-effect", `events[${index}]`, owned)
  const numericPath = (field: string): string => `events[${index}].${field}`
  const ownOptionalString = (
    field: string,
    value: string | undefined
  ): string | undefined => {
    if (value === undefined) return undefined
    assertTrimmedNonEmptyStringValue(
      "item-effect",
      `events[${index}].${field}`,
      value
    )
    return value
  }

  switch (owned.type) {
    case "hp_restored":
    case "mp_restored":
    case "hunger_restored":
      assertFiniteNumberValue(
        "item-effect",
        numericPath("amount"),
        owned.amount,
        {
          minimum: 0,
        }
      )
      return Object.freeze({ type: owned.type, amount: owned.amount })
    case "temporary_stat_increased":
      assertFiniteNumberValue(
        "item-effect",
        numericPath("amount"),
        owned.amount
      )
      if (owned.amount <= 0) {
        throw new WizValueValidationError(
          "item-effect",
          numericPath("amount"),
          owned.amount,
          "a positive finite number"
        )
      }
      assertFiniteNumberValue(
        "item-effect",
        numericPath("duration"),
        owned.duration,
        {
          minimum: 1,
          safeInteger: true,
        }
      )
      assertTrimmedNonEmptyStringValue(
        "item-effect",
        `events[${index}].stat`,
        owned.stat
      )
      return Object.freeze({
        type: owned.type,
        stat: owned.stat,
        amount: owned.amount,
        duration: owned.duration,
      })
    case "revived":
      assertFiniteNumberValue("item-effect", numericPath("hp"), owned.hp, {
        minimum: 0,
      })
      return Object.freeze({ type: owned.type, hp: owned.hp })
    case "poison_requested":
      if (owned.potency !== undefined) {
        assertFiniteNumberValue(
          "item-effect",
          numericPath("potency"),
          owned.potency,
          {
            minimum: 0,
          }
        )
      }
      return Object.freeze({
        type: owned.type,
        ...(owned.potency === undefined ? {} : { potency: owned.potency }),
      })
    case "trap_requested":
      if (owned.power !== undefined) {
        assertFiniteNumberValue(
          "item-effect",
          numericPath("power"),
          owned.power,
          {
            minimum: 0,
          }
        )
      }
      return Object.freeze({
        type: owned.type,
        ...(owned.power === undefined ? {} : { power: owned.power }),
      })
    case "fuel_requested":
      if (owned.amount !== undefined) {
        assertFiniteNumberValue(
          "item-effect",
          numericPath("amount"),
          owned.amount,
          {
            minimum: 0,
          }
        )
      }
      return Object.freeze({
        type: owned.type,
        ...(owned.amount === undefined ? {} : { amount: owned.amount }),
      })
    case "status_cured": {
      const effectId = ownOptionalString("effectId", owned.effectId)
      return Object.freeze({
        type: owned.type,
        ...(effectId === undefined ? {} : { effectId }),
      })
    }
    case "teleport_requested": {
      const targetId = ownOptionalString("targetId", owned.targetId)
      const destination = ownOptionalString("destination", owned.destination)
      return Object.freeze({
        type: owned.type,
        ...(targetId === undefined ? {} : { targetId }),
        ...(destination === undefined ? {} : { destination }),
      })
    }
    case "light_activated":
      return Object.freeze({ type: owned.type })
    case "unlock_requested": {
      const targetId = ownOptionalString("targetId", owned.targetId)
      return Object.freeze({
        type: owned.type,
        ...(targetId === undefined ? {} : { targetId }),
      })
    }
    default:
      throw new WizValueValidationError(
        "item-effect",
        `events[${index}].type`,
        owned,
        "a supported item effect event type"
      )
  }
}

function restoredAmount(
  current: number,
  maximum: number,
  requested: number
): number {
  return Math.max(0, Math.min(maximum, current + requested) - current)
}

function invalidValue(
  effectType: WizItemEffectDefinition["type"],
  field: string,
  value: number,
  constraints: Readonly<{
    positive?: boolean
    safeInteger?: boolean
  }> = {}
): Extract<WizItemEffectRejection, { type: "invalid_value" }> | undefined {
  if (
    Number.isFinite(value) &&
    (constraints.positive === true ? value > 0 : value >= 0) &&
    (constraints.safeInteger !== true || Number.isSafeInteger(value))
  ) {
    return undefined
  }
  return Object.freeze({
    type: "invalid_value",
    effectType,
    field,
    value: Number.isNaN(value)
      ? "NaN"
      : value === Number.POSITIVE_INFINITY
        ? "Infinity"
        : value === Number.NEGATIVE_INFINITY
          ? "-Infinity"
          : value.toString(),
  })
}

Object.freeze(WizItemEffectService)
Object.freeze(WizItemEffectService.prototype)

function rejected<TTarget>(
  target: WizDeepReadonly<TTarget>,
  rejection: WizItemEffectRejection
): WizItemEffectResult<TTarget> {
  return Object.freeze({
    applied: false,
    target,
    rejection: Object.freeze({ ...rejection }),
  })
}
