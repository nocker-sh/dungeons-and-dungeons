import {
  WIZ_IMMUTABLE_VALUE,
  type WizDeepReadonly,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizStandardSchemaDefinition } from "@/lib/wiz/core/standard-schema"
import { WizStandardSchema } from "@/lib/wiz/core/standard-schema"
import {
  assertArrayValue,
  assertFiniteNumberValue,
  assertRecordValue,
  assertTrimmedNonEmptyStringValue,
  WizValueValidationError,
} from "@/lib/wiz/core/value-validation"

const abilityOwnership = new WizObjectService()
const abilityConstructionToken = Symbol("WizAbility.constructor")
const abilityBookConstructionToken = Symbol("WizAbilityBook.constructor")
const abilityCatalogConstructionToken = Symbol("WizAbilityCatalog.constructor")
const abilityLoadoutConstructionToken = Symbol("WizAbilityLoadout.constructor")
const abilityReadinessConstructionToken = Symbol("WizAbilityReadiness.constructor")
const authenticAbilities = new WeakSet<object>()
const authenticAbilityBooks = new WeakSet<object>()
const authenticAbilityCatalogs = new WeakSet<object>()
const authenticAbilityReadinessValues = new WeakSet<object>()

export type WizAbilityCosts<TResourceId extends string = string> = Readonly<
  Partial<Record<TResourceId, number>>
>

export type WizAbilityDefinition<
  TId extends string = string,
  TEffect = unknown,
  TCustom = unknown,
  TResourceId extends string = string,
> = Readonly<{
  id: TId
  name: string
  description?: string
  tags?: readonly string[]
  costs?: WizAbilityCosts<TResourceId>
  cooldownGroups?: Readonly<Record<string, number>>
  cooldownMs?: number
  maximumCharges?: number
  castTimeMs?: number
  recoveryTimeMs?: number
  effect: TEffect | WizDeepReadonly<TEffect>
  custom?: TCustom | WizDeepReadonly<TCustom>
}>

export type WizAbilityProperties<
  TId extends string = string,
  TEffect = unknown,
  TCustom = unknown,
  TResourceId extends string = string,
> = Readonly<{
  id: TId
  name: string
  description: string
  tags: readonly string[]
  costs: WizDeepReadonly<WizAbilityCosts<TResourceId>>
  cooldownGroups: Readonly<Record<string, number>>
  cooldownMs: number
  maximumCharges: number
  castTimeMs: number
  recoveryTimeMs: number
  effect: WizDeepReadonly<TEffect>
  custom: WizDeepReadonly<TCustom> | undefined
}>

const assertUniqueStrings = (path: string, values: readonly unknown[]): void => {
  const seen = new Set<string>()
  for (const [index, value] of values.entries()) {
    assertTrimmedNonEmptyStringValue("ability", `${path}[${index}]`, value)
    if (seen.has(value)) {
      throw new WizValueValidationError("ability", `${path}[${index}]`, value, "a unique value")
    }
    seen.add(value)
  }
}

const assertAbilityCosts: (costs: unknown) => asserts costs is WizAbilityCosts = (costs) => {
  assertRecordValue("ability", "costs", costs)
  for (const [resource, amount] of Object.entries(costs)) {
    assertTrimmedNonEmptyStringValue("ability", `costs.${resource}.resource`, resource)
    assertFiniteNumberValue("ability", `costs.${resource}`, amount, { minimum: 0 })
  }
}

const assertCooldownGroups = (groups: unknown): void => {
  assertRecordValue("ability", "cooldownGroups", groups)
  for (const [groupId, durationMs] of Object.entries(groups)) {
    assertTrimmedNonEmptyStringValue("ability", "cooldownGroups.groupId", groupId)
    assertMilliseconds(`cooldownGroups.${groupId}`, durationMs)
  }
}

const assertMilliseconds: (path: string, value: unknown) => asserts value is number = (
  path,
  value,
) => {
  assertFiniteNumberValue("ability", path, value, {
    minimum: 0,
    safeInteger: true,
  })
}

const assertAbilityDefinition = (definition: WizAbilityDefinition): void => {
  assertRecordValue("ability", "$", definition)
  assertTrimmedNonEmptyStringValue("ability", "id", definition.id)
  assertTrimmedNonEmptyStringValue("ability", "name", definition.name)
  if (definition.description !== undefined && typeof definition.description !== "string") {
    throw new WizValueValidationError("ability", "description", definition.description, "a string")
  }
  if (definition.tags !== undefined) {
    assertArrayValue("ability", "tags", definition.tags)
    assertUniqueStrings("tags", definition.tags)
  }
  if (definition.costs !== undefined) {
    assertAbilityCosts(definition.costs)
  }
  if (definition.cooldownGroups !== undefined) {
    assertCooldownGroups(definition.cooldownGroups)
  }
  assertMilliseconds("cooldownMs", definition.cooldownMs ?? 0)
  assertFiniteNumberValue("ability", "maximumCharges", definition.maximumCharges ?? 1, {
    minimum: 1,
    safeInteger: true,
  })
  assertMilliseconds("castTimeMs", definition.castTimeMs ?? 0)
  assertMilliseconds("recoveryTimeMs", definition.recoveryTimeMs ?? 0)
}

/**
 * ターン進行や描画方式に依存しない、静的なAbility定義。
 *
 * `effect`は利用側のdiscriminated unionをそのまま保持するため、
 * action、passive、movementなどを作品固有の型で表現できる。
 */
export class WizAbility<
  TId extends string = string,
  TEffect = unknown,
  TCustom = unknown,
  TResourceId extends string = string,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  declare private readonly wizAbilityType: readonly [TId, TEffect, TCustom, TResourceId]
  readonly id: TId
  readonly name: string
  readonly description: string
  readonly tags: readonly string[]
  readonly costs: WizDeepReadonly<WizAbilityCosts<TResourceId>>
  readonly cooldownGroups: Readonly<Record<string, number>>
  readonly cooldownMs: number
  readonly maximumCharges: number
  readonly castTimeMs: number
  readonly recoveryTimeMs: number
  readonly effect: WizDeepReadonly<TEffect>
  readonly custom: WizDeepReadonly<TCustom> | undefined

  private constructor(
    token: symbol,
    definition: WizAbilityDefinition<TId, TEffect, TCustom, TResourceId>,
  ) {
    if (token !== abilityConstructionToken) {
      throw new TypeError("WizAbility must be created with define() or fromUnknown()")
    }
    assertAbilityDefinition(definition)
    this.id = definition.id
    this.name = definition.name
    this.description = definition.description ?? ""
    this.tags = abilityOwnership.ownImmutable(definition.tags ?? [])
    this.costs = abilityOwnership.ownImmutable(definition.costs ?? {}) as WizDeepReadonly<
      WizAbilityCosts<TResourceId>
    >
    this.cooldownGroups = abilityOwnership.ownImmutable(definition.cooldownGroups ?? {})
    this.cooldownMs = definition.cooldownMs ?? 0
    this.maximumCharges = definition.maximumCharges ?? 1
    this.castTimeMs = definition.castTimeMs ?? 0
    this.recoveryTimeMs = definition.recoveryTimeMs ?? 0
    this.effect = abilityOwnership.ownImmutable<TEffect>(definition.effect)
    this.custom =
      definition.custom === undefined
        ? undefined
        : abilityOwnership.ownImmutable<TCustom>(definition.custom)
    authenticAbilities.add(this)
    WizImmutableValue.freeze(this)
  }

  static define<
    const TId extends string,
    TEffect,
    TCustom = unknown,
    const TResourceId extends string = never,
  >(
    definition: WizAbilityDefinition<TId, TEffect, TCustom, TResourceId>,
  ): WizAbility<TId, TEffect, TCustom, TResourceId> {
    return new WizAbility(abilityConstructionToken, definition)
  }

  static fromUnknown<
    const TId extends string,
    TEffect,
    TCustom = unknown,
    TResourceId extends string = string,
  >(
    input: unknown,
    schema: WizStandardSchemaDefinition<
      unknown,
      WizAbilityDefinition<TId, TEffect, TCustom, TResourceId>
    >,
  ): WizAbility<TId, TEffect, TCustom, TResourceId> {
    const definition = WizStandardSchema.capture(schema, "Ability").validate(input)
    return new WizAbility(abilityConstructionToken, definition)
  }

  static require(value: unknown, label = "Ability"): asserts value is WizAbility {
    if (typeof value !== "object" || value === null || !authenticAbilities.has(value)) {
      throw new TypeError(`${label} must be created with WizAbility.define() or fromUnknown()`)
    }
  }

  withEffect<TNewEffect>(effect: TNewEffect): WizAbility<TId, TNewEffect, TCustom, TResourceId> {
    WizAbility.require(this)
    return WizAbility.define({
      ...this.toProperties(),
      effect,
    })
  }

  withCosts(costs: WizAbilityCosts<TResourceId>): WizAbility<TId, TEffect, TCustom, TResourceId> {
    WizAbility.require(this)
    return WizAbility.define({
      ...this.toProperties(),
      costs,
    })
  }

  withCustom<TNewCustom>(custom: TNewCustom): WizAbility<TId, TEffect, TNewCustom, TResourceId> {
    WizAbility.require(this)
    return WizAbility.define({
      ...this.toProperties(),
      custom,
    })
  }

  toProperties(): WizAbilityProperties<TId, TEffect, TCustom, TResourceId> {
    WizAbility.require(this)
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      tags: this.tags,
      costs: this.costs,
      cooldownGroups: this.cooldownGroups,
      cooldownMs: this.cooldownMs,
      maximumCharges: this.maximumCharges,
      castTimeMs: this.castTimeMs,
      recoveryTimeMs: this.recoveryTimeMs,
      effect: this.effect,
      custom: this.custom,
    }
  }
}

type AnyWizAbility = WizAbility<string, unknown, unknown, string>
type WizAbilityId<TAbility extends AnyWizAbility> = TAbility["id"]
type WizAbilityById<TAbility extends AnyWizAbility, TId extends string> =
  Extract<TAbility, Readonly<{ id: TId }>> extends never
    ? TAbility
    : Extract<TAbility, Readonly<{ id: TId }>>

/**
 * Ability定義をIDで解決する不変catalog。
 */
export class WizAbilityCatalog<TAbility extends AnyWizAbility = AnyWizAbility> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly abilities: readonly TAbility[]

  private constructor(token: symbol, abilities: readonly TAbility[]) {
    if (token !== abilityCatalogConstructionToken) {
      throw new TypeError("WizAbilityCatalog must be created with create()")
    }
    const seen = new Set<string>()
    for (const [index, ability] of abilities.entries()) {
      WizAbility.require(ability, `Ability catalog entry at index ${index}`)
      if (seen.has(ability.id)) {
        throw new RangeError(`Duplicate ability id "${ability.id}" at index ${index}`)
      }
      seen.add(ability.id)
    }
    this.abilities = Object.freeze([...abilities])
    authenticAbilityCatalogs.add(this)
    WizImmutableValue.freeze(this)
  }

  static create<const TAbilities extends readonly AnyWizAbility[]>(
    abilities: TAbilities,
  ): WizAbilityCatalog<TAbilities[number]> {
    return new WizAbilityCatalog(abilityCatalogConstructionToken, abilities)
  }

  has(abilityId: string): abilityId is WizAbilityId<TAbility> {
    return this.abilities.some((ability) => ability.id === abilityId)
  }

  find<const TId extends WizAbilityId<TAbility>>(
    abilityId: TId,
  ): WizAbilityById<TAbility, TId> | undefined {
    return this.abilities.find((ability) => ability.id === abilityId) as
      | WizAbilityById<TAbility, TId>
      | undefined
  }

  require<const TId extends WizAbilityId<TAbility>>(abilityId: TId): WizAbilityById<TAbility, TId> {
    const ability = this.find(abilityId)
    if (ability === undefined) {
      throw new RangeError(`Unknown ability id "${abilityId}"`)
    }
    return ability
  }

  createBook(): WizAbilityBook<WizAbilityId<TAbility>>
  createBook<const TId extends WizAbilityId<TAbility>>(
    abilityIds: readonly TId[],
  ): WizAbilityBook<TId>
  createBook(
    abilityIds: readonly WizAbilityId<TAbility>[] = [],
  ): WizAbilityBook<WizAbilityId<TAbility>> {
    for (const abilityId of abilityIds) {
      if (!this.abilities.some((ability) => ability.id === abilityId)) {
        throw new RangeError(`Unknown ability id "${abilityId}"`)
      }
    }
    return WizAbilityBook.create(abilityIds)
  }

  restoreBook(input: unknown): WizAbilityBook<WizAbilityId<TAbility>> {
    const book = WizAbilityBook.fromUnknown<WizAbilityId<TAbility>>(input)
    for (const [index, abilityId] of book.abilityIds.entries()) {
      if (!this.abilities.some((ability) => ability.id === abilityId)) {
        throw new WizValueValidationError(
          "ability",
          `book[${index}]`,
          abilityId,
          "an ability ID in the supplied catalog",
        )
      }
    }
    return book
  }

  /** @internal composition boundary only. */
  static assertAuthentic(value: unknown, label = "Ability catalog"): void {
    if (typeof value !== "object" || value === null || !authenticAbilityCatalogs.has(value)) {
      throw new TypeError(`${label} must be created with WizAbilityCatalog.create()`)
    }
  }
}

/**
 * 習得済みAbilityだけを保持する不変value。
 */
export class WizAbilityBook<TAbilityId extends string = string> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly abilityIds: readonly TAbilityId[]

  private constructor(token: symbol, abilityIds: readonly TAbilityId[]) {
    if (token !== abilityBookConstructionToken) {
      throw new TypeError("WizAbilityBook must be created with create() or fromUnknown()")
    }
    assertArrayValue("ability", "book", abilityIds)
    assertUniqueStrings("book", abilityIds)
    this.abilityIds = Object.freeze([...abilityIds])
    authenticAbilityBooks.add(this)
    WizImmutableValue.freeze(this)
  }

  static create<const TAbilityId extends string>(
    abilityIds: readonly TAbilityId[] = [],
  ): WizAbilityBook<TAbilityId> {
    return new WizAbilityBook(abilityBookConstructionToken, abilityIds)
  }

  static fromUnknown<TAbilityId extends string = string>(
    input: unknown,
  ): WizAbilityBook<TAbilityId> {
    assertArrayValue("ability", "book", input)
    return new WizAbilityBook(abilityBookConstructionToken, input as readonly TAbilityId[])
  }

  learn<const TNewAbilityId extends string>(
    abilityId: TNewAbilityId,
  ): WizAbilityBook<TAbilityId | TNewAbilityId> {
    assertTrimmedNonEmptyStringValue("ability", "abilityId", abilityId)
    if (this.has(abilityId)) {
      return this
    }
    return new WizAbilityBook(abilityBookConstructionToken, [...this.abilityIds, abilityId])
  }

  forget(abilityId: TAbilityId): WizAbilityBook<TAbilityId> {
    return new WizAbilityBook(
      abilityBookConstructionToken,
      this.abilityIds.filter((candidate) => candidate !== abilityId),
    )
  }

  has(abilityId: string): abilityId is TAbilityId {
    return this.abilityIds.some((candidate) => candidate === abilityId)
  }

  toPlain(): readonly TAbilityId[] {
    return this.abilityIds
  }

  /** @internal composition boundary only. */
  static assertAuthentic(value: unknown, label = "Ability book"): void {
    if (typeof value !== "object" || value === null || !authenticAbilityBooks.has(value)) {
      throw new TypeError(`${label} must be created with WizAbilityBook.create() or fromUnknown()`)
    }
  }
}

export type WizAbilityLoadoutState<
  TSlotId extends string = string,
  TAbilityId extends string = string,
> = Readonly<Record<TSlotId, TAbilityId | null>>

const assertSlotIds = (slotIds: readonly unknown[]): void => {
  assertUniqueStrings("loadout.slotIds", slotIds)
}

const createEmptyLoadout = <TSlotId extends string>(
  slotIds: readonly TSlotId[],
): WizAbilityLoadoutState<TSlotId, never> =>
  Object.fromEntries(slotIds.map((slotId) => [slotId, null])) as WizAbilityLoadoutState<
    TSlotId,
    never
  >

const parseLoadout = <TSlotId extends string, TAbilityId extends string>(
  book: WizAbilityBook<TAbilityId>,
  slotIds: readonly TSlotId[],
  input: unknown,
): WizAbilityLoadoutState<TSlotId, TAbilityId> => {
  assertRecordValue("ability", "loadout", input)
  const expectedSlots = new Set<string>(slotIds)
  const actualSlots = Reflect.ownKeys(input)
  if (
    actualSlots.some((slotId) => typeof slotId !== "string" || !expectedSlots.has(slotId)) ||
    actualSlots.length !== slotIds.length
  ) {
    throw new WizValueValidationError(
      "ability",
      "loadout",
      input,
      `exactly the slots ${slotIds.join(", ")}`,
    )
  }
  for (const slotId of slotIds) {
    const abilityId = input[slotId]
    if (abilityId !== null && (typeof abilityId !== "string" || !book.has(abilityId))) {
      throw new WizValueValidationError(
        "ability",
        `loadout.${slotId}`,
        abilityId,
        "null or an ability learned by the supplied book",
      )
    }
  }
  return input as WizAbilityLoadoutState<TSlotId, TAbilityId>
}

/**
 * 入力slotと習得済みAbilityの対応を管理する不変value。
 */
export class WizAbilityLoadout<
  TSlotId extends string = string,
  TAbilityId extends string = string,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly slotIds: readonly TSlotId[]
  private readonly knownAbilityIds: readonly TAbilityId[]
  private readonly state: Readonly<Record<string, TAbilityId | null>>

  private constructor(
    token: symbol,
    book: WizAbilityBook<TAbilityId>,
    slotIds: readonly TSlotId[],
    state: WizAbilityLoadoutState<TSlotId, TAbilityId>,
  ) {
    if (token !== abilityLoadoutConstructionToken) {
      throw new TypeError("WizAbilityLoadout must be created with create() or fromUnknown()")
    }
    WizAbilityBook.assertAuthentic(book)
    assertSlotIds(slotIds)
    this.slotIds = Object.freeze([...slotIds])
    this.knownAbilityIds = Object.freeze([...book.abilityIds])
    this.state = abilityOwnership.ownImmutable(parseLoadout(book, slotIds, state)) as Readonly<
      Record<string, TAbilityId | null>
    >
    WizImmutableValue.freeze(this)
  }

  static create<const TSlotId extends string, TAbilityId extends string>(
    book: WizAbilityBook<TAbilityId>,
    slotIds: readonly TSlotId[],
  ): WizAbilityLoadout<TSlotId, TAbilityId> {
    const state = createEmptyLoadout(slotIds) as WizAbilityLoadoutState<TSlotId, TAbilityId>
    return new WizAbilityLoadout(abilityLoadoutConstructionToken, book, slotIds, state)
  }

  static fromUnknown<const TSlotId extends string, TAbilityId extends string>(
    book: WizAbilityBook<TAbilityId>,
    slotIds: readonly TSlotId[],
    input: unknown,
  ): WizAbilityLoadout<TSlotId, TAbilityId> {
    const state = parseLoadout(book, slotIds, input)
    return new WizAbilityLoadout(abilityLoadoutConstructionToken, book, slotIds, state)
  }

  assign(slotId: TSlotId, abilityId: TAbilityId): WizAbilityLoadout<TSlotId, TAbilityId> {
    this.requireSlot(slotId)
    if (!this.knownAbilityIds.some((candidate) => candidate === abilityId)) {
      throw new RangeError(`Ability "${abilityId}" is not learned`)
    }
    return new WizAbilityLoadout<TSlotId, TAbilityId>(
      abilityLoadoutConstructionToken,
      WizAbilityBook.create(this.knownAbilityIds),
      this.slotIds,
      {
        ...this.state,
        [slotId]: abilityId,
      } as WizAbilityLoadoutState<TSlotId, TAbilityId>,
    )
  }

  clear(slotId: TSlotId): WizAbilityLoadout<TSlotId, TAbilityId> {
    this.requireSlot(slotId)
    return new WizAbilityLoadout<TSlotId, TAbilityId>(
      abilityLoadoutConstructionToken,
      WizAbilityBook.create(this.knownAbilityIds),
      this.slotIds,
      {
        ...this.state,
        [slotId]: null,
      } as WizAbilityLoadoutState<TSlotId, TAbilityId>,
    )
  }

  abilityAt(slotId: TSlotId): TAbilityId | null {
    this.requireSlot(slotId)
    return this.state[slotId] ?? null
  }

  reconcile<TNewAbilityId extends string>(
    book: WizAbilityBook<TNewAbilityId>,
  ): WizAbilityLoadout<TSlotId, TNewAbilityId> {
    const state = Object.fromEntries(
      this.slotIds.map((slotId) => {
        const abilityId = this.state[slotId]
        return [slotId, abilityId !== null && book.has(abilityId) ? abilityId : null]
      }),
    ) as WizAbilityLoadoutState<TSlotId, TNewAbilityId>
    return new WizAbilityLoadout<TSlotId, TNewAbilityId>(
      abilityLoadoutConstructionToken,
      book,
      this.slotIds,
      state,
    )
  }

  toPlain(): WizDeepReadonly<WizAbilityLoadoutState<TSlotId, TAbilityId>> {
    return this.state as WizDeepReadonly<WizAbilityLoadoutState<TSlotId, TAbilityId>>
  }

  private requireSlot(slotId: string): asserts slotId is TSlotId {
    if (!this.slotIds.some((candidate) => candidate === slotId)) {
      throw new RangeError(`Unknown ability slot "${slotId}"`)
    }
  }
}

export type WizAbilityReadinessState<TAbilityId extends string = string> = Readonly<{
  abilities: Readonly<Record<TAbilityId, readonly number[]>>
  groups: Readonly<Record<string, number>>
}>

type AnyWizAbilityReadinessState = WizAbilityReadinessState<string>

const parseReadiness = (input: unknown): AnyWizAbilityReadinessState => {
  assertRecordValue("ability", "readiness", input)
  const keys = Reflect.ownKeys(input)
  if (keys.length !== 2 || !keys.includes("abilities") || !keys.includes("groups")) {
    throw new WizValueValidationError(
      "ability",
      "readiness",
      input,
      'exactly the keys "abilities" and "groups"',
    )
  }
  assertRecordValue("ability", "readiness.abilities", input.abilities)
  assertRecordValue("ability", "readiness.groups", input.groups)
  const abilities = Object.fromEntries(
    Object.entries(input.abilities).map(([abilityId, recoveryTimes]) => {
      assertTrimmedNonEmptyStringValue("ability", "readiness.abilities.abilityId", abilityId)
      assertArrayValue("ability", `readiness.abilities.${abilityId}`, recoveryTimes)
      const numericRecoveryTimes: number[] = []
      for (const [index, recoveryAtMs] of recoveryTimes.entries()) {
        assertMilliseconds(`readiness.abilities.${abilityId}[${index}]`, recoveryAtMs)
        numericRecoveryTimes.push(recoveryAtMs)
      }
      return [abilityId, numericRecoveryTimes.sort((left, right) => left - right)] as const
    }),
  )
  const groups = Object.fromEntries(
    Object.entries(input.groups).map(([groupId, readyAtMs]) => {
      assertTrimmedNonEmptyStringValue("ability", "readiness.groups.groupId", groupId)
      assertMilliseconds(`readiness.groups.${groupId}`, readyAtMs)
      return [groupId, readyAtMs] as const
    }),
  )
  return { abilities, groups }
}

export class WizAbilityNotReadyError extends Error {
  override readonly name = "WizAbilityNotReadyError"
  readonly code = "ABILITY_NOT_READY"
  readonly abilityId: string
  readonly readyInMs: number

  constructor(abilityId: string, readyInMs: number) {
    assertTrimmedNonEmptyStringValue("ability", "notReady.abilityId", abilityId)
    assertMilliseconds("notReady.readyInMs", readyInMs)
    super(`Ability "${abilityId}" is not ready for ${readyInMs}ms`)
    this.abilityId = abilityId
    this.readyInMs = readyInMs
    Object.freeze(this)
  }
}

/**
 * frameごとの減算を行わず、回復時刻だけでcooldownとchargeを管理する不変value。
 */
export class WizAbilityReadiness<TAbilityId extends string = string> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  private readonly state: AnyWizAbilityReadinessState

  private constructor(token: symbol, state: AnyWizAbilityReadinessState) {
    if (token !== abilityReadinessConstructionToken) {
      throw new TypeError("WizAbilityReadiness must be created with create() or fromUnknown()")
    }
    this.state = abilityOwnership.ownImmutable(parseReadiness(state))
    authenticAbilityReadinessValues.add(this)
    WizImmutableValue.freeze(this)
  }

  static create(): WizAbilityReadiness<never> {
    return new WizAbilityReadiness(abilityReadinessConstructionToken, {
      abilities: {},
      groups: {},
    })
  }

  static fromUnknown<TAbility extends AnyWizAbility>(
    catalog: WizAbilityCatalog<TAbility>,
    input: unknown,
  ): WizAbilityReadiness<WizAbilityId<TAbility>> {
    WizAbilityCatalog.assertAuthentic(catalog)
    const state = parseReadiness(input)
    for (const [abilityId, recoveryTimes] of Object.entries(state.abilities)) {
      const ability = catalog.abilities.find((candidate) => candidate.id === abilityId)
      if (ability === undefined) {
        throw new WizValueValidationError(
          "ability",
          `readiness.abilities.${abilityId}`,
          recoveryTimes,
          "an ability ID in the supplied catalog",
        )
      }
      if (recoveryTimes.length > ability.maximumCharges) {
        throw new WizValueValidationError(
          "ability",
          `readiness.abilities.${abilityId}`,
          recoveryTimes,
          `at most ${ability.maximumCharges} pending recoveries`,
        )
      }
    }
    const knownGroupIds = new Set(
      catalog.abilities.flatMap((ability) => Object.keys(ability.cooldownGroups)),
    )
    for (const [groupId, readyAtMs] of Object.entries(state.groups)) {
      if (!knownGroupIds.has(groupId)) {
        throw new WizValueValidationError(
          "ability",
          `readiness.groups.${groupId}`,
          readyAtMs,
          "a cooldown group used by the supplied catalog",
        )
      }
    }
    return new WizAbilityReadiness<WizAbilityId<TAbility>>(abilityReadinessConstructionToken, state)
  }

  availableCharges<TId extends string, TEffect, TCustom, TResourceId extends string>(
    ability: WizAbility<TId, TEffect, TCustom, TResourceId>,
    atMs: number,
  ): number {
    WizAbility.require(ability)
    assertMilliseconds("atMs", atMs)
    return Math.max(0, ability.maximumCharges - this.pendingRecoveries(ability.id, atMs).length)
  }

  isReady<TId extends string, TEffect, TCustom, TResourceId extends string>(
    ability: WizAbility<TId, TEffect, TCustom, TResourceId>,
    atMs: number,
  ): boolean {
    return this.availableCharges(ability, atMs) > 0 && this.groupWaitMs(ability, atMs) === 0
  }

  readyInMs<TId extends string, TEffect, TCustom, TResourceId extends string>(
    ability: WizAbility<TId, TEffect, TCustom, TResourceId>,
    atMs: number,
  ): number {
    WizAbility.require(ability)
    assertMilliseconds("atMs", atMs)
    const pending = this.pendingRecoveries(ability.id, atMs)
    const chargeWaitMs =
      pending.length < ability.maximumCharges || pending[0] === undefined ? 0 : pending[0] - atMs
    return Math.max(chargeWaitMs, this.groupWaitMs(ability, atMs))
  }

  use<const TNewAbilityId extends string, TEffect, TCustom, TResourceId extends string>(
    ability: WizAbility<TNewAbilityId, TEffect, TCustom, TResourceId>,
    atMs: number,
  ): WizAbilityReadiness<TAbilityId | TNewAbilityId> {
    WizAbility.require(ability)
    assertMilliseconds("atMs", atMs)
    const readyInMs = this.readyInMs(ability, atMs)
    if (readyInMs > 0) {
      throw new WizAbilityNotReadyError(ability.id, readyInMs)
    }
    const pending = this.pendingRecoveries(ability.id, atMs)
    const abilities = { ...this.state.abilities }
    if (ability.cooldownMs > 0) {
      const recoveryAtMs = atMs + ability.cooldownMs
      assertMilliseconds("recoveryAtMs", recoveryAtMs)
      abilities[ability.id] = [...pending, recoveryAtMs].sort((left, right) => left - right)
    }
    const groups = { ...this.state.groups }
    for (const [groupId, durationMs] of Object.entries(ability.cooldownGroups)) {
      const readyAtMs = atMs + durationMs
      assertMilliseconds(`groups.${groupId}.readyAtMs`, readyAtMs)
      groups[groupId] = readyAtMs
    }
    return new WizAbilityReadiness(abilityReadinessConstructionToken, {
      abilities,
      groups,
    })
  }

  compact(atMs: number): WizAbilityReadiness<TAbilityId> {
    assertMilliseconds("atMs", atMs)
    const abilityEntries = Object.entries(this.state.abilities).flatMap(
      ([abilityId, recoveryTimes]) => {
        const pending = recoveryTimes.filter((recoveryAtMs) => recoveryAtMs > atMs)
        return pending.length === 0 ? [] : [[abilityId, pending] as const]
      },
    )
    const groupEntries = Object.entries(this.state.groups).filter(
      ([, readyAtMs]) => readyAtMs > atMs,
    )
    return new WizAbilityReadiness(abilityReadinessConstructionToken, {
      abilities: Object.fromEntries(abilityEntries),
      groups: Object.fromEntries(groupEntries),
    })
  }

  clear(abilityId: TAbilityId): WizAbilityReadiness<TAbilityId> {
    const abilityEntries = Object.entries(this.state.abilities).filter(
      ([candidate]) => candidate !== abilityId,
    )
    return new WizAbilityReadiness(abilityReadinessConstructionToken, {
      abilities: Object.fromEntries(abilityEntries),
      groups: this.state.groups,
    })
  }

  toPlain(): WizDeepReadonly<WizAbilityReadinessState<TAbilityId>> {
    return this.state as WizDeepReadonly<WizAbilityReadinessState<TAbilityId>>
  }

  /** @internal composition boundary only. */
  static assertAuthentic(value: unknown, label = "Ability readiness"): void {
    if (
      typeof value !== "object" ||
      value === null ||
      !authenticAbilityReadinessValues.has(value)
    ) {
      throw new TypeError(
        `${label} must be created with WizAbilityReadiness.create() or fromUnknown()`,
      )
    }
  }

  private pendingRecoveries(abilityId: string, atMs: number): readonly number[] {
    return (this.state.abilities[abilityId] ?? []).filter((recoveryAtMs) => recoveryAtMs > atMs)
  }

  private groupWaitMs<TId extends string, TEffect, TCustom, TResourceId extends string>(
    ability: WizAbility<TId, TEffect, TCustom, TResourceId>,
    atMs: number,
  ): number {
    return Object.keys(ability.cooldownGroups).reduce((waitMs, groupId) => {
      const readyAtMs = this.state.groups[groupId] ?? 0
      return Math.max(waitMs, Math.max(0, readyAtMs - atMs))
    }, 0)
  }
}

Object.freeze(WizAbility.prototype)
Object.freeze(WizAbility)
Object.freeze(WizAbilityCatalog.prototype)
Object.freeze(WizAbilityCatalog)
Object.freeze(WizAbilityBook.prototype)
Object.freeze(WizAbilityBook)
Object.freeze(WizAbilityLoadout.prototype)
Object.freeze(WizAbilityLoadout)
Object.freeze(WizAbilityNotReadyError.prototype)
Object.freeze(WizAbilityNotReadyError)
Object.freeze(WizAbilityReadiness.prototype)
Object.freeze(WizAbilityReadiness)
