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
} from "@/lib/wiz/core/value-validation"

export type WizThreatEntry<TActorId extends string = string> = Readonly<{
  actorId: TActorId
  threat: number
}>

export type WizThreatTableState<TActorId extends string = string> = Readonly<{
  entries: readonly WizThreatEntry<TActorId>[]
}>

const threatTableConstructionToken = Symbol("WizThreatTable.constructor")
const authenticThreatTables = new WeakSet<object>()
const threatTableOwnership = new WizObjectService()

const parseState = <TActorId extends string>(
  state: WizThreatTableState<TActorId>,
): WizThreatTableState<TActorId> => {
  assertRecordValue("threat-table", "$", state)
  assertArrayValue("threat-table", "entries", state.entries)

  const actorIds = new Set<string>()
  for (const [index, entry] of state.entries.entries()) {
    assertRecordValue("threat-table", `entries[${index}]`, entry)
    assertTrimmedNonEmptyStringValue("threat-table", `entries[${index}].actorId`, entry.actorId)
    assertFiniteNumberValue("threat-table", `entries[${index}].threat`, entry.threat, {
      minimum: 1,
      safeInteger: true,
    })
    if (actorIds.has(entry.actorId)) {
      throw new RangeError(`Duplicate threat actor id "${entry.actorId}"`)
    }
    actorIds.add(entry.actorId)
  }

  return {
    entries: [...state.entries].sort((left, right) => left.actorId.localeCompare(right.actorId)),
  }
}

/**
 * 戦闘参加者ごとの脅威値を不変に保持し、決定的な標的選択を行うvalue。
 *
 * 距離、生死、陣営、挑発、減衰、永続化は作品側の規則として残す。
 */
export class WizThreatTable<TActorId extends string = string> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly #state: WizThreatTableState<TActorId>

  private constructor(
    token: typeof threatTableConstructionToken,
    state: WizThreatTableState<TActorId>,
  ) {
    if (token !== threatTableConstructionToken) {
      throw new TypeError("WizThreatTable must be created with create() or fromUnknown()")
    }
    this.#state = threatTableOwnership.ownImmutable(
      parseState(state),
    ) as WizThreatTableState<TActorId>
    authenticThreatTables.add(this)
    WizImmutableValue.freeze(this)
  }

  static create<const TActorId extends string = string>(
    state: WizThreatTableState<TActorId> = { entries: [] },
  ): WizThreatTable<TActorId> {
    return new WizThreatTable(threatTableConstructionToken, state)
  }

  static fromUnknown(input: unknown): WizThreatTable {
    assertRecordValue("threat-table", "$", input)
    return new WizThreatTable(threatTableConstructionToken, input as WizThreatTableState)
  }

  static require(value: unknown, label = "Threat table"): asserts value is WizThreatTable {
    if (typeof value !== "object" || value === null || !authenticThreatTables.has(value)) {
      throw new TypeError(`${label} must be created with WizThreatTable.create() or fromUnknown()`)
    }
  }

  get entries(): readonly WizThreatEntry<TActorId>[] {
    return this.#state.entries
  }

  threatOf(actorId: TActorId): number {
    assertTrimmedNonEmptyStringValue("threat-table", "actorId", actorId)
    return this.entries.find((entry) => entry.actorId === actorId)?.threat ?? 0
  }

  add(actorId: TActorId, amount: number): WizThreatTable<TActorId> {
    assertTrimmedNonEmptyStringValue("threat-table", "actorId", actorId)
    assertFiniteNumberValue("threat-table", "amount", amount, {
      minimum: 0,
      safeInteger: true,
    })
    if (amount === 0) return this

    const current = this.threatOf(actorId)
    const threat = current + amount
    assertFiniteNumberValue("threat-table", "threat", threat, {
      minimum: 1,
      safeInteger: true,
    })
    const entries =
      current === 0
        ? [...this.entries, { actorId, threat }]
        : this.entries.map((entry) => (entry.actorId === actorId ? { actorId, threat } : entry))
    return new WizThreatTable(threatTableConstructionToken, { entries })
  }

  remove(actorId: TActorId): WizThreatTable<TActorId> {
    assertTrimmedNonEmptyStringValue("threat-table", "actorId", actorId)
    if (this.threatOf(actorId) === 0) return this
    return new WizThreatTable(threatTableConstructionToken, {
      entries: this.entries.filter((entry) => entry.actorId !== actorId),
    })
  }

  retain(actorIds: readonly TActorId[]): WizThreatTable<TActorId> {
    assertArrayValue("threat-table", "actorIds", actorIds)
    const retained = new Set<TActorId>()
    for (const [index, actorId] of actorIds.entries()) {
      assertTrimmedNonEmptyStringValue("threat-table", `actorIds[${index}]`, actorId)
      retained.add(actorId)
    }
    const entries = this.entries.filter((entry) => retained.has(entry.actorId))
    if (entries.length === this.entries.length) return this
    return new WizThreatTable(threatTableConstructionToken, { entries })
  }

  highest(actorIds?: readonly TActorId[]): WizThreatEntry<TActorId> | null {
    const candidates = actorIds === undefined ? null : new Set(this.validatedActorIds(actorIds))
    let highest: WizThreatEntry<TActorId> | null = null
    for (const entry of this.entries) {
      if (candidates !== null && !candidates.has(entry.actorId)) continue
      if (
        highest === null ||
        entry.threat > highest.threat ||
        (entry.threat === highest.threat && entry.actorId < highest.actorId)
      ) {
        highest = entry
      }
    }
    return highest
  }

  toPlain(): WizDeepReadonly<WizThreatTableState<TActorId>> {
    return this.#state as WizDeepReadonly<WizThreatTableState<TActorId>>
  }

  private validatedActorIds(actorIds: readonly TActorId[]): readonly TActorId[] {
    assertArrayValue("threat-table", "actorIds", actorIds)
    for (const [index, actorId] of actorIds.entries()) {
      assertTrimmedNonEmptyStringValue("threat-table", `actorIds[${index}]`, actorId)
    }
    return actorIds
  }
}

Object.freeze(WizThreatTable.prototype)
Object.freeze(WizThreatTable)
