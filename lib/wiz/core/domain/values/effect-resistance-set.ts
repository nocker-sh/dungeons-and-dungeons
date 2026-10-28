import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { assertArrayValue } from "@/lib/wiz/core/assert-array-value"
import { assertFiniteNumberValue } from "@/lib/wiz/core/assert-finite-number-value"
import { assertRecordValue } from "@/lib/wiz/core/assert-record-value"
import { assertTrimmedNonEmptyStringValue } from "@/lib/wiz/core/assert-trimmed-non-empty-string-value"

export type WizEffectResistanceEntry<TEffectId extends string = string> =
  Readonly<{
    effectId: TEffectId
    resistance: number
  }>

export type WizEffectResistanceSetState<TEffectId extends string = string> =
  Readonly<{
    entries: readonly WizEffectResistanceEntry<TEffectId>[]
  }>

export type WizEffectDurationResolution<TEffectId extends string = string> =
  Readonly<{
    effectId: TEffectId
    baseDurationMs: number
    resistance: number
    durationMs: number
    isImmune: boolean
  }>

const effectResistanceSetConstructionToken = Symbol(
  "WizEffectResistanceSet.constructor"
)
const authenticEffectResistanceSets = new WeakSet<object>()

const parseState = <TEffectId extends string>(
  state: WizEffectResistanceSetState<TEffectId>
): WizEffectResistanceSetState<TEffectId> => {
  assertRecordValue("effect-resistance-set", "$", state)
  assertArrayValue("effect-resistance-set", "entries", state.entries)

  const effectIds = new Set<string>()
  for (const [index, entry] of state.entries.entries()) {
    assertRecordValue("effect-resistance-set", `entries[${index}]`, entry)
    assertTrimmedNonEmptyStringValue(
      "effect-resistance-set",
      `entries[${index}].effectId`,
      entry.effectId
    )
    assertFiniteNumberValue(
      "effect-resistance-set",
      `entries[${index}].resistance`,
      entry.resistance,
      { minimum: 0, maximum: 1 }
    )
    if (effectIds.has(entry.effectId)) {
      throw new RangeError(`Duplicate effect resistance id "${entry.effectId}"`)
    }
    effectIds.add(entry.effectId)
  }

  return {
    entries: [...state.entries].sort((left, right) =>
      left.effectId.localeCompare(right.effectId)
    ),
  }
}

const ownState = <TEffectId extends string>(
  state: WizEffectResistanceSetState<TEffectId>
): WizEffectResistanceSetState<TEffectId> => {
  const parsed = parseState(state)
  return Object.freeze({
    entries: Object.freeze(
      parsed.entries.map((entry) =>
        Object.freeze({
          effectId: entry.effectId,
          resistance: entry.resistance,
        })
      )
    ),
  })
}

/**
 * effectごとの耐性を不変に保持し、基礎時間から実際の有効時間を決定するvalue。
 *
 * effectの意味、付与条件、stack、解除、対象選択は利用側の規則として残す。
 */
export class WizEffectResistanceSet<TEffectId extends string = string> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly #state: WizEffectResistanceSetState<TEffectId>

  private constructor(
    token: typeof effectResistanceSetConstructionToken,
    state: WizEffectResistanceSetState<TEffectId>
  ) {
    if (token !== effectResistanceSetConstructionToken) {
      throw new TypeError(
        "WizEffectResistanceSet must be created with create()"
      )
    }
    this.#state = ownState(state)
    authenticEffectResistanceSets.add(this)
    WizImmutableValue.freeze(this)
  }

  static create<const TEffectId extends string = string>(
    state: WizEffectResistanceSetState<TEffectId> = { entries: [] }
  ): WizEffectResistanceSet<TEffectId> {
    return new WizEffectResistanceSet(
      effectResistanceSetConstructionToken,
      state
    )
  }

  static require(
    value: unknown,
    label = "Effect resistance set"
  ): asserts value is WizEffectResistanceSet {
    if (
      typeof value !== "object" ||
      value === null ||
      !authenticEffectResistanceSets.has(value)
    ) {
      throw new TypeError(
        `${label} must be created with WizEffectResistanceSet.create()`
      )
    }
  }

  get entries(): readonly WizEffectResistanceEntry<TEffectId>[] {
    return this.#state.entries
  }

  resistanceOf(effectId: TEffectId): number {
    assertTrimmedNonEmptyStringValue(
      "effect-resistance-set",
      "effectId",
      effectId
    )
    return (
      this.entries.find((entry) => entry.effectId === effectId)?.resistance ?? 0
    )
  }

  withResistance(
    effectId: TEffectId,
    resistance: number
  ): WizEffectResistanceSet<TEffectId> {
    assertTrimmedNonEmptyStringValue(
      "effect-resistance-set",
      "effectId",
      effectId
    )
    assertFiniteNumberValue("effect-resistance-set", "resistance", resistance, {
      minimum: 0,
      maximum: 1,
    })
    if (this.resistanceOf(effectId) === resistance) return this

    const hasEntry = this.entries.some((entry) => entry.effectId === effectId)
    const entries = hasEntry
      ? this.entries.map((entry) =>
          entry.effectId === effectId ? { effectId, resistance } : entry
        )
      : [...this.entries, { effectId, resistance }]
    return new WizEffectResistanceSet(effectResistanceSetConstructionToken, {
      entries,
    })
  }

  resolveDuration(
    effectId: TEffectId,
    baseDurationMs: number
  ): WizEffectDurationResolution<TEffectId> {
    assertTrimmedNonEmptyStringValue(
      "effect-resistance-set",
      "effectId",
      effectId
    )
    assertFiniteNumberValue(
      "effect-resistance-set",
      "baseDurationMs",
      baseDurationMs,
      {
        minimum: 1,
        safeInteger: true,
      }
    )

    const resistance = this.resistanceOf(effectId)
    const isImmune = resistance === 1
    const durationMs = isImmune
      ? 0
      : Math.max(1, Math.floor(baseDurationMs * (1 - resistance)))
    return Object.freeze({
      effectId,
      baseDurationMs,
      resistance,
      durationMs,
      isImmune,
    })
  }

  toPlain(): WizEffectResistanceSetState<TEffectId> {
    return this.#state
  }
}

Object.freeze(WizEffectResistanceSet.prototype)
Object.freeze(WizEffectResistanceSet)
