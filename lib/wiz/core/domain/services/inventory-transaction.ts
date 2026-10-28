import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import {
  WizInventory,
  WizInventoryEntry,
  WizInventoryOperationError,
} from "@/lib/wiz/core/domain/values/inventory"
import { assertFiniteNumberValue } from "@/lib/wiz/core/assert-finite-number-value"

type AnyInventoryEntry = WizInventoryEntry<string, string, string, unknown>
type InventoryEntryId<TEntry extends AnyInventoryEntry> = TEntry["entryId"]

export type WizInventoryRuleDefinition<TEntry extends AnyInventoryEntry> =
  Readonly<{
    canStack: (left: TEntry, right: TEntry) => boolean
    maximumQuantity: (entry: TEntry) => number
  }>

/**
 * 作品固有のstack条件と上限を純粋関数として所有する不変rule。
 */
export class WizInventoryRules<
  TEntry extends AnyInventoryEntry = AnyInventoryEntry,
> {
  private readonly canStackRule: (left: TEntry, right: TEntry) => boolean
  private readonly maximumQuantityRule: (entry: TEntry) => number

  private constructor(definition: WizInventoryRuleDefinition<TEntry>) {
    if (
      typeof definition.canStack !== "function" ||
      typeof definition.maximumQuantity !== "function"
    ) {
      throw new TypeError(
        "Inventory rules require canStack and maximumQuantity functions"
      )
    }
    this.canStackRule = definition.canStack
    this.maximumQuantityRule = definition.maximumQuantity
    Object.freeze(this)
  }

  static create<TEntry extends AnyInventoryEntry>(
    definition: WizInventoryRuleDefinition<TEntry>
  ): WizInventoryRules<TEntry> {
    return new WizInventoryRules(definition)
  }

  static byContent(
    maximumQuantity = Number.MAX_SAFE_INTEGER
  ): WizInventoryRules<AnyInventoryEntry> {
    assertFiniteNumberValue(
      "inventory",
      "rules.maximumQuantity",
      maximumQuantity,
      {
        minimum: 1,
        safeInteger: true,
      }
    )
    return new WizInventoryRules({
      canStack: (left, right) =>
        left.contentType === right.contentType &&
        left.contentId === right.contentId &&
        left.custom === undefined &&
        right.custom === undefined,
      maximumQuantity: () => maximumQuantity,
    })
  }

  canStack(left: TEntry, right: TEntry): boolean {
    WizInventoryEntry.require(left)
    WizInventoryEntry.require(right)
    return this.canStackRule(left, right)
  }

  maximumQuantity(entry: TEntry): number {
    WizInventoryEntry.require(entry)
    const maximum = this.maximumQuantityRule(entry)
    assertFiniteNumberValue("inventory", "rules.maximumQuantity", maximum, {
      minimum: 1,
      safeInteger: true,
    })
    return maximum
  }
}

export type WizInventoryTransactionErrorCode =
  | "INVENTORY_STACK_NOT_ALLOWED"
  | "INVENTORY_STACK_LIMIT_EXCEEDED"
  | "INVENTORY_TRANSFER_SAME_CONTAINER"

export class WizInventoryTransactionError extends Error {
  override readonly name = "WizInventoryTransactionError"
  readonly code: WizInventoryTransactionErrorCode
  readonly entryId: string
  readonly targetEntryId: string | undefined

  constructor(
    code: WizInventoryTransactionErrorCode,
    entryId: string,
    targetEntryId?: string
  ) {
    super(
      targetEntryId === undefined
        ? `${code}: "${entryId}"`
        : `${code}: "${entryId}" -> "${targetEntryId}"`
    )
    this.code = code
    this.entryId = entryId
    this.targetEntryId = targetEntryId
    Object.freeze(this)
  }
}

const inventoryTransferConstructionToken = Symbol(
  "WizInventoryTransfer.constructor"
)

/**
 * transfer後の二つのinventoryを一つの結果として返す不変value。
 */
export class WizInventoryTransfer<
  TSourceEntry extends AnyInventoryEntry = AnyInventoryEntry,
  TDestinationEntry extends AnyInventoryEntry = AnyInventoryEntry,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly source: WizInventory<TSourceEntry>
  readonly destination: WizInventory<TDestinationEntry | TSourceEntry>

  private constructor(
    token: symbol,
    source: WizInventory<TSourceEntry>,
    destination: WizInventory<TDestinationEntry | TSourceEntry>
  ) {
    if (token !== inventoryTransferConstructionToken) {
      throw new TypeError(
        "WizInventoryTransfer must be created by WizInventoryTransaction"
      )
    }
    WizInventory.assertAuthentic(source)
    WizInventory.assertAuthentic(destination)
    this.source = source
    this.destination = destination
    WizImmutableValue.freeze(this)
  }

  /** @internal composition boundary only. */
  static create<
    TSourceEntry extends AnyInventoryEntry,
    TDestinationEntry extends AnyInventoryEntry,
  >(
    source: WizInventory<TSourceEntry>,
    destination: WizInventory<TDestinationEntry | TSourceEntry>
  ): WizInventoryTransfer<TSourceEntry, TDestinationEntry> {
    return new WizInventoryTransfer(
      inventoryTransferConstructionToken,
      source,
      destination
    )
  }
}

/**
 * 複数entryの消費、分割、結合、container間移動を原子的に計算するservice。
 */
export class WizInventoryTransaction<
  TEntry extends AnyInventoryEntry = AnyInventoryEntry,
> {
  private readonly rules: WizInventoryRules<TEntry>

  constructor(rules: WizInventoryRules<TEntry>) {
    this.rules = rules
    Object.freeze(this)
  }

  add<TInventoryEntry extends TEntry, TNewEntry extends TEntry>(
    inventory: WizInventory<TInventoryEntry>,
    entry: TNewEntry
  ): WizInventory<TInventoryEntry | TNewEntry> {
    WizInventory.assertAuthentic(inventory)
    WizInventoryEntry.require(entry)
    const target = inventory.entries.find((candidate) =>
      this.rules.canStack(candidate, entry)
    )
    if (target === undefined) {
      if (entry.quantity > this.rules.maximumQuantity(entry)) {
        throw new WizInventoryTransactionError(
          "INVENTORY_STACK_LIMIT_EXCEEDED",
          entry.entryId
        )
      }
      return inventory.insert(entry)
    }
    this.assertStack(entry, target, target.quantity + entry.quantity)
    return inventory.increase(target.entryId, entry.quantity) as WizInventory<
      TInventoryEntry | TNewEntry
    >
  }

  consumeMany<TInventoryEntry extends TEntry>(
    inventory: WizInventory<TInventoryEntry>,
    costs: readonly Readonly<{
      entryId: InventoryEntryId<TInventoryEntry>
      quantity: number
    }>[]
  ): WizInventory<TInventoryEntry> {
    WizInventory.assertAuthentic(inventory)
    const totals = new Map<string, number>()
    for (const cost of costs) {
      assertFiniteNumberValue(
        "inventory",
        "transaction.quantity",
        cost.quantity,
        {
          minimum: 1,
          safeInteger: true,
        }
      )
      totals.set(cost.entryId, (totals.get(cost.entryId) ?? 0) + cost.quantity)
    }
    for (const [entryId, quantity] of totals) {
      const entry = inventory.entries.find(
        (candidate) => candidate.entryId === entryId
      )
      if (entry === undefined) {
        throw new WizInventoryOperationError(
          "INVENTORY_ENTRY_NOT_FOUND",
          entryId
        )
      }
      if (entry.quantity < quantity) {
        throw new WizInventoryOperationError(
          "INVENTORY_QUANTITY_INSUFFICIENT",
          entryId
        )
      }
    }
    let result = inventory
    for (const [entryId, quantity] of totals) {
      result = result.consume(
        entryId as InventoryEntryId<TInventoryEntry>,
        quantity
      )
    }
    return result
  }

  split<TInventoryEntry extends TEntry, const TNewEntryId extends string>(
    inventory: WizInventory<TInventoryEntry>,
    entryId: InventoryEntryId<TInventoryEntry>,
    quantity: number,
    newEntryId: TNewEntryId
  ): WizInventory<
    | TInventoryEntry
    | WizInventoryEntry<
        TNewEntryId,
        TInventoryEntry["contentType"],
        TInventoryEntry["contentId"],
        unknown
      >
  > {
    WizInventory.assertAuthentic(inventory)
    const source = inventory.find(entryId)
    if (source === undefined) {
      throw new WizInventoryOperationError("INVENTORY_ENTRY_NOT_FOUND", entryId)
    }
    const remainder = inventory.consume(entryId, quantity)
    const splitEntry = WizInventoryEntry.define({
      ...source.toProperties(),
      entryId: newEntryId,
      quantity,
    })
    return remainder.insert(splitEntry)
  }

  merge<TInventoryEntry extends TEntry>(
    inventory: WizInventory<TInventoryEntry>,
    sourceEntryId: InventoryEntryId<TInventoryEntry>,
    targetEntryId: InventoryEntryId<TInventoryEntry>
  ): WizInventory<TInventoryEntry> {
    WizInventory.assertAuthentic(inventory)
    if (sourceEntryId === targetEntryId) {
      throw new WizInventoryTransactionError(
        "INVENTORY_STACK_NOT_ALLOWED",
        sourceEntryId,
        targetEntryId
      )
    }
    const source = inventory.find(sourceEntryId)
    const target = inventory.find(targetEntryId)
    if (source === undefined) {
      throw new WizInventoryOperationError(
        "INVENTORY_ENTRY_NOT_FOUND",
        sourceEntryId
      )
    }
    if (target === undefined) {
      throw new WizInventoryOperationError(
        "INVENTORY_ENTRY_NOT_FOUND",
        targetEntryId
      )
    }
    this.assertStack(source, target, source.quantity + target.quantity)
    return inventory
      .remove(sourceEntryId)
      .increase(targetEntryId, source.quantity)
  }

  transfer<
    TSourceEntry extends TEntry,
    TDestinationEntry extends TEntry,
    const TDestinationEntryId extends string,
  >(
    source: WizInventory<TSourceEntry>,
    destination: WizInventory<TDestinationEntry>,
    entryId: InventoryEntryId<TSourceEntry>,
    quantity: number,
    destinationEntryId: TDestinationEntryId
  ): WizInventoryTransfer<TSourceEntry, TDestinationEntry> {
    WizInventory.assertAuthentic(source)
    WizInventory.assertAuthentic(destination)
    if (Object.is(source, destination)) {
      throw new WizInventoryTransactionError(
        "INVENTORY_TRANSFER_SAME_CONTAINER",
        entryId
      )
    }
    const sourceEntry = source.find(entryId)
    if (sourceEntry === undefined) {
      throw new WizInventoryOperationError("INVENTORY_ENTRY_NOT_FOUND", entryId)
    }
    assertFiniteNumberValue("inventory", "transaction.quantity", quantity, {
      minimum: 1,
      safeInteger: true,
    })
    if (sourceEntry.quantity < quantity) {
      throw new WizInventoryOperationError(
        "INVENTORY_QUANTITY_INSUFFICIENT",
        entryId
      )
    }
    const movedEntry = WizInventoryEntry.define({
      ...sourceEntry.toProperties(),
      entryId: destinationEntryId,
      quantity,
    })
    const destinationEntry = destination.entries.find(
      (candidate) => candidate.entryId === destinationEntryId
    )
    let nextDestination: WizInventory<TDestinationEntry | TSourceEntry>
    if (destinationEntry === undefined) {
      if (quantity > this.rules.maximumQuantity(sourceEntry)) {
        throw new WizInventoryTransactionError(
          "INVENTORY_STACK_LIMIT_EXCEEDED",
          entryId,
          destinationEntryId
        )
      }
      nextDestination = destination.insert(movedEntry) as WizInventory<
        TDestinationEntry | TSourceEntry
      >
    } else {
      this.assertStack(
        sourceEntry,
        destinationEntry,
        destinationEntry.quantity + quantity
      )
      nextDestination = destination.increase(
        destinationEntry.entryId as InventoryEntryId<TDestinationEntry>,
        quantity
      ) as WizInventory<TDestinationEntry | TSourceEntry>
    }
    const nextSource = source.consume(entryId, quantity)
    return WizInventoryTransfer.create(nextSource, nextDestination)
  }

  private assertStack(left: TEntry, right: TEntry, nextQuantity: number): void {
    if (!this.rules.canStack(left, right)) {
      throw new WizInventoryTransactionError(
        "INVENTORY_STACK_NOT_ALLOWED",
        left.entryId,
        right.entryId
      )
    }
    if (nextQuantity > this.rules.maximumQuantity(right)) {
      throw new WizInventoryTransactionError(
        "INVENTORY_STACK_LIMIT_EXCEEDED",
        left.entryId,
        right.entryId
      )
    }
  }
}

Object.freeze(WizInventoryRules.prototype)
Object.freeze(WizInventoryRules)
Object.freeze(WizInventoryTransactionError.prototype)
Object.freeze(WizInventoryTransactionError)
Object.freeze(WizInventoryTransfer.prototype)
Object.freeze(WizInventoryTransfer)
Object.freeze(WizInventoryTransaction.prototype)
Object.freeze(WizInventoryTransaction)
