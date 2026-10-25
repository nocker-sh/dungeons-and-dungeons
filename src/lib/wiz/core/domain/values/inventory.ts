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

const inventoryOwnership = new WizObjectService()
const inventoryEntryConstructionToken = Symbol("WizInventoryEntry.constructor")
const inventoryConstructionToken = Symbol("WizInventory.constructor")
const equipmentLoadoutConstructionToken = Symbol("WizEquipmentLoadout.constructor")
const authenticInventoryEntries = new WeakSet<object>()
const authenticInventories = new WeakSet<object>()
const authenticEquipmentLoadouts = new WeakSet<object>()

export type WizInventoryEntryDefinition<
  TEntryId extends string = string,
  TContentType extends string = string,
  TContentId extends string = string,
  TCustom = unknown,
> = Readonly<{
  entryId: TEntryId
  contentType: TContentType
  contentId: TContentId
  quantity: number
  custom?: TCustom | WizDeepReadonly<TCustom>
}>

export type WizInventoryEntryProperties<
  TEntryId extends string = string,
  TContentType extends string = string,
  TContentId extends string = string,
  TCustom = unknown,
> = Readonly<{
  entryId: TEntryId
  contentType: TContentType
  contentId: TContentId
  quantity: number
  custom?: WizDeepReadonly<TCustom>
}>

const assertInventoryEntryDefinition = (definition: WizInventoryEntryDefinition): void => {
  assertRecordValue("inventory", "entry", definition)
  assertTrimmedNonEmptyStringValue("inventory", "entry.entryId", definition.entryId)
  assertTrimmedNonEmptyStringValue("inventory", "entry.contentType", definition.contentType)
  assertTrimmedNonEmptyStringValue("inventory", "entry.contentId", definition.contentId)
  assertFiniteNumberValue("inventory", "entry.quantity", definition.quantity, {
    minimum: 1,
    safeInteger: true,
  })
}

/**
 * 所有物一つを表す不変value。
 *
 * `entryId`は所有物instance、`contentType`と`contentId`は静的contentを指す。同じ武器contentでも
 * durability、affix、強化値などが異なるinstanceを`custom`で型付きに保持できる。
 */
export class WizInventoryEntry<
  TEntryId extends string = string,
  TContentType extends string = string,
  TContentId extends string = string,
  TCustom = unknown,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  declare private readonly wizInventoryEntryType: readonly [
    TEntryId,
    TContentType,
    TContentId,
    TCustom,
  ]
  readonly entryId: TEntryId
  readonly contentType: TContentType
  readonly contentId: TContentId
  readonly quantity: number
  readonly custom: WizDeepReadonly<TCustom> | undefined

  private constructor(
    token: symbol,
    definition: WizInventoryEntryDefinition<TEntryId, TContentType, TContentId, TCustom>,
  ) {
    if (token !== inventoryEntryConstructionToken) {
      throw new TypeError("WizInventoryEntry must be created with define() or fromUnknown()")
    }
    assertInventoryEntryDefinition(definition)
    this.entryId = definition.entryId
    this.contentType = definition.contentType
    this.contentId = definition.contentId
    this.quantity = definition.quantity
    this.custom =
      definition.custom === undefined
        ? undefined
        : inventoryOwnership.ownImmutable<TCustom>(definition.custom)
    authenticInventoryEntries.add(this)
    WizImmutableValue.freeze(this)
  }

  static define<
    const TEntryId extends string,
    const TContentType extends string,
    const TContentId extends string,
    TCustom = unknown,
  >(
    definition: WizInventoryEntryDefinition<TEntryId, TContentType, TContentId, TCustom>,
  ): WizInventoryEntry<TEntryId, TContentType, TContentId, TCustom> {
    return new WizInventoryEntry(inventoryEntryConstructionToken, definition)
  }

  static fromUnknown<
    const TEntryId extends string,
    const TContentType extends string,
    const TContentId extends string,
    TCustom = unknown,
  >(
    input: unknown,
    schema: WizStandardSchemaDefinition<
      unknown,
      WizInventoryEntryDefinition<TEntryId, TContentType, TContentId, TCustom>
    >,
  ): WizInventoryEntry<TEntryId, TContentType, TContentId, TCustom> {
    const definition = WizStandardSchema.capture(schema, "Inventory entry").validate(input)
    return new WizInventoryEntry(inventoryEntryConstructionToken, definition)
  }

  static require(value: unknown, label = "Inventory entry"): asserts value is WizInventoryEntry {
    if (typeof value !== "object" || value === null || !authenticInventoryEntries.has(value)) {
      throw new TypeError(
        `${label} must be created with WizInventoryEntry.define() or fromUnknown()`,
      )
    }
  }

  withQuantity(quantity: number): WizInventoryEntry<TEntryId, TContentType, TContentId, TCustom> {
    WizInventoryEntry.require(this)
    return WizInventoryEntry.define({
      ...this.toProperties(),
      quantity,
    })
  }

  withCustom<TNewCustom>(
    custom: TNewCustom,
  ): WizInventoryEntry<TEntryId, TContentType, TContentId, TNewCustom> {
    WizInventoryEntry.require(this)
    return WizInventoryEntry.define({
      ...this.toProperties(),
      custom,
    })
  }

  toProperties(): WizInventoryEntryProperties<TEntryId, TContentType, TContentId, TCustom> {
    WizInventoryEntry.require(this)
    return {
      entryId: this.entryId,
      contentType: this.contentType,
      contentId: this.contentId,
      quantity: this.quantity,
      ...(this.custom === undefined ? {} : { custom: this.custom }),
    }
  }
}

type AnyWizInventoryEntry = WizInventoryEntry<string, string, string, unknown>
type WizInventoryEntryId<TEntry extends AnyWizInventoryEntry> = TEntry["entryId"]
type WizInventoryContentType<TEntry extends AnyWizInventoryEntry> = TEntry["contentType"]
type WizInventoryContentId<TEntry extends AnyWizInventoryEntry> = TEntry["contentId"]
export type WizInventoryEntryPropertiesOf<TEntry extends AnyWizInventoryEntry> =
  TEntry extends WizInventoryEntry<
    infer TEntryId,
    infer TContentType,
    infer TContentId,
    infer TCustom
  >
    ? WizInventoryEntryProperties<TEntryId, TContentType, TContentId, TCustom>
    : never
type WizInventoryEntryById<TEntry extends AnyWizInventoryEntry, TEntryId extends string> =
  Extract<TEntry, Readonly<{ entryId: TEntryId }>> extends never
    ? TEntry
    : Extract<TEntry, Readonly<{ entryId: TEntryId }>>
type WizInventoryEntryByContent<
  TEntry extends AnyWizInventoryEntry,
  TContentType extends string,
  TContentId extends string,
> =
  Extract<TEntry, Readonly<{ contentId: TContentId; contentType: TContentType }>> extends never
    ? TEntry
    : Extract<TEntry, Readonly<{ contentId: TContentId; contentType: TContentType }>>

export type WizInventoryDefinition<TEntry extends AnyWizInventoryEntry = AnyWizInventoryEntry> =
  Readonly<{
    capacity: number
    entries?: readonly TEntry[]
  }>

export type WizInventoryState<
  TEntryDefinition extends WizInventoryEntryDefinition = WizInventoryEntryDefinition,
> = Readonly<{
  capacity: number
  entries: readonly TEntryDefinition[]
}>

export type WizInventoryOperationErrorCode =
  | "INVENTORY_ENTRY_ALREADY_EXISTS"
  | "INVENTORY_ENTRY_NOT_FOUND"
  | "INVENTORY_FULL"
  | "INVENTORY_QUANTITY_INSUFFICIENT"

export class WizInventoryOperationError extends Error {
  override readonly name = "WizInventoryOperationError"
  readonly code: WizInventoryOperationErrorCode
  readonly entryId: string

  constructor(code: WizInventoryOperationErrorCode, entryId: string) {
    if (
      code !== "INVENTORY_ENTRY_ALREADY_EXISTS" &&
      code !== "INVENTORY_ENTRY_NOT_FOUND" &&
      code !== "INVENTORY_FULL" &&
      code !== "INVENTORY_QUANTITY_INSUFFICIENT"
    ) {
      throw new WizValueValidationError(
        "inventory",
        "operation.code",
        code,
        "a known inventory operation error code",
      )
    }
    assertTrimmedNonEmptyStringValue("inventory", "operation.entryId", entryId)
    super(`${code}: "${entryId}"`)
    this.code = code
    this.entryId = entryId
    Object.freeze(this)
  }
}

const assertInventoryCapacity: (capacity: unknown) => asserts capacity is number = (capacity) => {
  assertFiniteNumberValue("inventory", "capacity", capacity, {
    minimum: 0,
    safeInteger: true,
  })
}

const assertInventoryEntries = (
  entries: readonly AnyWizInventoryEntry[],
  capacity: number,
): void => {
  if (entries.length > capacity) {
    throw new WizValueValidationError(
      "inventory",
      "entries",
      entries.length,
      `at most ${capacity} entries`,
    )
  }
  const seen = new Set<string>()
  for (const [index, entry] of entries.entries()) {
    WizInventoryEntry.require(entry, `Inventory entry at index ${index}`)
    if (seen.has(entry.entryId)) {
      throw new WizValueValidationError(
        "inventory",
        `entries[${index}].entryId`,
        entry.entryId,
        "a unique entry ID",
      )
    }
    seen.add(entry.entryId)
  }
}

/**
 * stackable itemと固有装備を同じentry modelで扱う不変inventory。
 */
export class WizInventory<TEntry extends AnyWizInventoryEntry = AnyWizInventoryEntry> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly capacity: number
  readonly entries: readonly TEntry[]

  private constructor(token: symbol, definition: WizInventoryDefinition<TEntry>) {
    if (token !== inventoryConstructionToken) {
      throw new TypeError("WizInventory must be created with create() or fromUnknown()")
    }
    assertInventoryCapacity(definition.capacity)
    const entries = definition.entries ?? []
    assertInventoryEntries(entries, definition.capacity)
    this.capacity = definition.capacity
    this.entries = Object.freeze([...entries])
    authenticInventories.add(this)
    WizImmutableValue.freeze(this)
  }

  static create<const TEntries extends readonly AnyWizInventoryEntry[]>(
    definition: Readonly<{
      capacity: number
      entries?: TEntries
    }>,
  ): WizInventory<TEntries[number]> {
    return new WizInventory(inventoryConstructionToken, definition)
  }

  static fromUnknown<
    const TEntryId extends string,
    const TContentType extends string,
    const TContentId extends string,
    TCustom = unknown,
  >(
    input: unknown,
    schema: WizStandardSchemaDefinition<
      unknown,
      WizInventoryState<WizInventoryEntryDefinition<TEntryId, TContentType, TContentId, TCustom>>
    >,
  ): WizInventory<WizInventoryEntry<TEntryId, TContentType, TContentId, TCustom>> {
    const state = WizStandardSchema.capture(schema, "Inventory").validate(input)
    return new WizInventory(inventoryConstructionToken, {
      capacity: state.capacity,
      entries: state.entries.map((entry) => WizInventoryEntry.define(entry)),
    })
  }

  insert<TNewEntry extends AnyWizInventoryEntry>(
    entry: TNewEntry,
  ): WizInventory<TEntry | TNewEntry> {
    WizInventoryEntry.require(entry)
    if (this.entries.some((candidate) => candidate.entryId === entry.entryId)) {
      throw new WizInventoryOperationError("INVENTORY_ENTRY_ALREADY_EXISTS", entry.entryId)
    }
    if (this.isFull()) {
      throw new WizInventoryOperationError("INVENTORY_FULL", entry.entryId)
    }
    return new WizInventory(inventoryConstructionToken, {
      capacity: this.capacity,
      entries: [...this.entries, entry],
    })
  }

  increase(entryId: WizInventoryEntryId<TEntry>, quantity: number): WizInventory<TEntry> {
    this.assertPositiveQuantity(quantity)
    const entry = this.find(entryId)
    if (entry === undefined) {
      throw new WizInventoryOperationError("INVENTORY_ENTRY_NOT_FOUND", entryId)
    }
    return this.replace(entry.withQuantity(entry.quantity + quantity))
  }

  consume(entryId: WizInventoryEntryId<TEntry>, quantity = 1): WizInventory<TEntry> {
    this.assertPositiveQuantity(quantity)
    const entry = this.find(entryId)
    if (entry === undefined) {
      throw new WizInventoryOperationError("INVENTORY_ENTRY_NOT_FOUND", entryId)
    }
    if (entry.quantity < quantity) {
      throw new WizInventoryOperationError("INVENTORY_QUANTITY_INSUFFICIENT", entryId)
    }
    return entry.quantity === quantity
      ? this.remove(entryId)
      : this.replace(entry.withQuantity(entry.quantity - quantity))
  }

  remove(entryId: WizInventoryEntryId<TEntry>): WizInventory<TEntry> {
    if (!this.has(entryId)) {
      throw new WizInventoryOperationError("INVENTORY_ENTRY_NOT_FOUND", entryId)
    }
    return new WizInventory(inventoryConstructionToken, {
      capacity: this.capacity,
      entries: this.entries.filter((entry) => entry.entryId !== entryId),
    })
  }

  has(entryId: string): entryId is WizInventoryEntryId<TEntry> {
    return this.entries.some((entry) => entry.entryId === entryId)
  }

  find<const TEntryId extends WizInventoryEntryId<TEntry>>(
    entryId: TEntryId,
  ): WizInventoryEntryById<TEntry, TEntryId> | undefined {
    return this.entries.find((entry) => entry.entryId === entryId) as
      | WizInventoryEntryById<TEntry, TEntryId>
      | undefined
  }

  entriesFor<
    TContentType extends WizInventoryContentType<TEntry>,
    TContentId extends WizInventoryContentId<TEntry>,
  >(
    contentType: TContentType,
    contentId: TContentId,
  ): readonly WizInventoryEntryByContent<TEntry, TContentType, TContentId>[] {
    return this.entries.filter(
      (entry) => entry.contentType === contentType && entry.contentId === contentId,
    ) as unknown as readonly WizInventoryEntryByContent<TEntry, TContentType, TContentId>[]
  }

  totalQuantity(
    contentType: WizInventoryContentType<TEntry>,
    contentId: WizInventoryContentId<TEntry>,
  ): number {
    return this.entries.reduce(
      (total, entry) =>
        total +
        (entry.contentType === contentType && entry.contentId === contentId ? entry.quantity : 0),
      0,
    )
  }

  isFull(): boolean {
    return this.entries.length >= this.capacity
  }

  /** @internal composition boundary only. */
  static assertAuthentic(value: unknown, label = "Inventory"): void {
    if (typeof value !== "object" || value === null || !authenticInventories.has(value)) {
      throw new TypeError(`${label} must be created with WizInventory.create() or fromUnknown()`)
    }
  }

  toPlain(): WizInventoryState<WizInventoryEntryPropertiesOf<TEntry>> {
    return {
      capacity: this.capacity,
      entries: this.entries.map((entry) =>
        entry.toProperties(),
      ) as unknown as readonly WizInventoryEntryPropertiesOf<TEntry>[],
    }
  }

  private replace(replacement: AnyWizInventoryEntry): WizInventory<TEntry> {
    return new WizInventory(inventoryConstructionToken, {
      capacity: this.capacity,
      entries: this.entries.map((entry) =>
        entry.entryId === replacement.entryId ? replacement : entry,
      ) as unknown as readonly TEntry[],
    })
  }

  private assertPositiveQuantity(quantity: number): void {
    assertFiniteNumberValue("inventory", "quantity", quantity, {
      minimum: 1,
      safeInteger: true,
    })
  }
}

export type WizEquipmentLoadoutState<
  TSlotId extends string = string,
  TEntryId extends string = string,
> = Readonly<Record<TSlotId, TEntryId | null>>

const parseEquipmentLoadout = <TSlotId extends string, TEntry extends AnyWizInventoryEntry>(
  inventory: WizInventory<TEntry>,
  slotIds: readonly TSlotId[],
  input: unknown,
): WizEquipmentLoadoutState<TSlotId, WizInventoryEntryId<TEntry>> => {
  assertRecordValue("inventory", "equipment", input)
  const expectedSlots = new Set<string>(slotIds)
  const actualSlots = Reflect.ownKeys(input)
  if (
    actualSlots.some((slotId) => typeof slotId !== "string" || !expectedSlots.has(slotId)) ||
    actualSlots.length !== slotIds.length
  ) {
    throw new WizValueValidationError(
      "inventory",
      "equipment",
      input,
      `exactly the slots ${slotIds.join(", ")}`,
    )
  }
  for (const slotId of slotIds) {
    const entryId = input[slotId]
    if (entryId !== null && (typeof entryId !== "string" || !inventory.has(entryId))) {
      throw new WizValueValidationError(
        "inventory",
        `equipment.${slotId}`,
        entryId,
        "null or an entry in the supplied inventory",
      )
    }
  }
  return input as WizEquipmentLoadoutState<TSlotId, WizInventoryEntryId<TEntry>>
}

/**
 * inventoryの固有entryをslotへ割り当てる不変value。
 *
 * slot適合性や複数slot占有は外部の純粋ruleで決定し、このclassは参照整合性だけを保証する。
 */
export class WizEquipmentLoadout<
  TSlotId extends string = string,
  TEntryId extends string = string,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly slotIds: readonly TSlotId[]
  private readonly state: Readonly<Record<string, TEntryId | null>>

  private constructor(
    token: symbol,
    slotIds: readonly TSlotId[],
    state: WizEquipmentLoadoutState<TSlotId, TEntryId>,
  ) {
    if (token !== equipmentLoadoutConstructionToken) {
      throw new TypeError("WizEquipmentLoadout must be created with create() or fromUnknown()")
    }
    assertArrayValue("inventory", "equipment.slotIds", slotIds)
    const seen = new Set<string>()
    for (const [index, slotId] of slotIds.entries()) {
      assertTrimmedNonEmptyStringValue("inventory", `equipment.slotIds[${index}]`, slotId)
      if (seen.has(slotId)) {
        throw new WizValueValidationError(
          "inventory",
          `equipment.slotIds[${index}]`,
          slotId,
          "a unique slot ID",
        )
      }
      seen.add(slotId)
    }
    this.slotIds = Object.freeze([...slotIds])
    this.state = inventoryOwnership.ownImmutable(state) as Readonly<Record<string, TEntryId | null>>
    authenticEquipmentLoadouts.add(this)
    WizImmutableValue.freeze(this)
  }

  static create<const TSlotId extends string, TEntry extends AnyWizInventoryEntry>(
    inventory: WizInventory<TEntry>,
    slotIds: readonly TSlotId[],
  ): WizEquipmentLoadout<TSlotId, WizInventoryEntryId<TEntry>> {
    WizInventory.assertAuthentic(inventory)
    const state = Object.fromEntries(
      slotIds.map((slotId) => [slotId, null]),
    ) as WizEquipmentLoadoutState<TSlotId, WizInventoryEntryId<TEntry>>
    return new WizEquipmentLoadout(equipmentLoadoutConstructionToken, slotIds, state)
  }

  static fromUnknown<const TSlotId extends string, TEntry extends AnyWizInventoryEntry>(
    inventory: WizInventory<TEntry>,
    slotIds: readonly TSlotId[],
    input: unknown,
  ): WizEquipmentLoadout<TSlotId, WizInventoryEntryId<TEntry>> {
    WizInventory.assertAuthentic(inventory)
    const state = parseEquipmentLoadout(inventory, slotIds, input)
    return new WizEquipmentLoadout(equipmentLoadoutConstructionToken, slotIds, state)
  }

  equip<TEntry extends AnyWizInventoryEntry>(
    slotId: TSlotId,
    entryId: TEntryId,
    inventory: WizInventory<TEntry>,
  ): WizEquipmentLoadout<TSlotId, TEntryId> {
    this.requireSlot(slotId)
    WizInventory.assertAuthentic(inventory)
    if (!inventory.has(entryId)) {
      throw new WizInventoryOperationError("INVENTORY_ENTRY_NOT_FOUND", entryId)
    }
    return new WizEquipmentLoadout(equipmentLoadoutConstructionToken, this.slotIds, {
      ...this.state,
      [slotId]: entryId,
    } as WizEquipmentLoadoutState<TSlotId, TEntryId>)
  }

  unequip(slotId: TSlotId): WizEquipmentLoadout<TSlotId, TEntryId> {
    this.requireSlot(slotId)
    return new WizEquipmentLoadout(equipmentLoadoutConstructionToken, this.slotIds, {
      ...this.state,
      [slotId]: null,
    } as WizEquipmentLoadoutState<TSlotId, TEntryId>)
  }

  entryAt(slotId: TSlotId): TEntryId | null {
    this.requireSlot(slotId)
    return this.state[slotId] ?? null
  }

  reconcile<TEntry extends AnyWizInventoryEntry>(
    inventory: WizInventory<TEntry>,
  ): WizEquipmentLoadout<TSlotId, WizInventoryEntryId<TEntry>> {
    WizInventory.assertAuthentic(inventory)
    const state = Object.fromEntries(
      this.slotIds.map((slotId) => {
        const entryId = this.state[slotId]
        return [slotId, entryId !== null && inventory.has(entryId) ? entryId : null]
      }),
    ) as WizEquipmentLoadoutState<TSlotId, WizInventoryEntryId<TEntry>>
    return new WizEquipmentLoadout(equipmentLoadoutConstructionToken, this.slotIds, state)
  }

  toPlain(): WizDeepReadonly<WizEquipmentLoadoutState<TSlotId, TEntryId>> {
    return this.state as WizDeepReadonly<WizEquipmentLoadoutState<TSlotId, TEntryId>>
  }

  /** @internal composition boundary only. */
  static assertAuthentic(value: unknown, label = "Equipment loadout"): void {
    if (typeof value !== "object" || value === null || !authenticEquipmentLoadouts.has(value)) {
      throw new TypeError(
        `${label} must be created with WizEquipmentLoadout.create() or fromUnknown()`,
      )
    }
  }

  private requireSlot(slotId: string): asserts slotId is TSlotId {
    if (!this.slotIds.some((candidate) => candidate === slotId)) {
      throw new RangeError(`Unknown equipment slot "${slotId}"`)
    }
  }
}

Object.freeze(WizInventoryEntry.prototype)
Object.freeze(WizInventoryEntry)
Object.freeze(WizInventoryOperationError.prototype)
Object.freeze(WizInventoryOperationError)
Object.freeze(WizInventory.prototype)
Object.freeze(WizInventory)
Object.freeze(WizEquipmentLoadout.prototype)
Object.freeze(WizEquipmentLoadout)
