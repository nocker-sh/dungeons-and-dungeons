import {
  WizEquipmentLoadout,
  WizInventory,
  WizInventoryEntry,
} from "@/lib/wiz/core/domain/values/inventory"

const equipmentRulesConstructionToken = Symbol("WizRpgEquipmentRules.constructor")
const authenticEquipmentRules = new WeakSet<object>()

type AnyInventoryEntry = WizInventoryEntry<string, string, string, unknown>

export type WizRpgEquipmentDefinition = Readonly<{
  id: string
  slotId: string
}>

export type WizRpgEquipmentRuleContext<TEntry extends AnyInventoryEntry> = Readonly<{
  inventory: WizInventory<TEntry>
  equipment: WizEquipmentLoadout<string, TEntry["entryId"]>
}>

export type WizRpgEquipmentEquipContext<TEntry extends AnyInventoryEntry> =
  WizRpgEquipmentRuleContext<TEntry> &
    Readonly<{
      definition: WizRpgEquipmentDefinition
      entry: TEntry
      slotId: string
    }>

export type WizRpgEquipmentUnequipContext<TEntry extends AnyInventoryEntry> =
  WizRpgEquipmentRuleContext<TEntry> &
    Readonly<{
      slotId: string
    }>

export type WizRpgEquipmentRuleResult<TEntryId extends string, TReason extends string> =
  | Readonly<{
      accepted: true
      equipment: WizEquipmentLoadout<string, TEntryId>
    }>
  | Readonly<{
      accepted: false
      reason: TReason
    }>

export type WizRpgEquipmentRulesDefinition<
  TEntry extends AnyInventoryEntry,
  TReason extends string,
> = Readonly<{
  equip: (
    context: WizRpgEquipmentEquipContext<TEntry>,
  ) => WizRpgEquipmentRuleResult<TEntry["entryId"], TReason>
  unequip: (
    context: WizRpgEquipmentUnequipContext<TEntry>,
  ) => WizRpgEquipmentRuleResult<TEntry["entryId"], TReason>
}>

export type WizRpgStandardEquipmentRuleReason =
  | "INVENTORY_EQUIPMENT_ALREADY_EQUIPPED"
  | "INVENTORY_EQUIPMENT_SLOT_MISMATCH"

const normalizeEquipmentRuleResult = <TEntryId extends string, TReason extends string>(
  result: unknown,
  label: string,
): WizRpgEquipmentRuleResult<TEntryId, TReason> => {
  if (typeof result !== "object" || result === null || !("accepted" in result)) {
    throw new TypeError(`${label} must return an accepted or rejected result object`)
  }
  if (result.accepted === false) {
    if (
      !("reason" in result) ||
      typeof result.reason !== "string" ||
      result.reason.trim().length === 0 ||
      result.reason !== result.reason.trim()
    ) {
      throw new TypeError(`${label} rejected result must have a stable non-blank reason`)
    }
    return Object.freeze({
      accepted: false,
      reason: result.reason as TReason,
    })
  }
  if (result.accepted !== true || !("equipment" in result)) {
    throw new TypeError(`${label} accepted result must have accepted true and equipment`)
  }
  WizEquipmentLoadout.assertAuthentic(result.equipment, `${label} equipment`)
  return Object.freeze({
    accepted: true,
    equipment: result.equipment as WizEquipmentLoadout<string, TEntryId>,
  })
}

/**
 * 装備可否とloadout更新を純粋関数として保持する不変rules。
 *
 * custom rulesは複数slot占有、slot競合、職業制限、capacity制などを、完全な次の
 * loadoutを返すことで表現できる。
 */
export class WizRpgEquipmentRules<TEntry extends AnyInventoryEntry, TReason extends string> {
  readonly equip: (
    context: WizRpgEquipmentEquipContext<TEntry>,
  ) => WizRpgEquipmentRuleResult<TEntry["entryId"], TReason>
  readonly unequip: (
    context: WizRpgEquipmentUnequipContext<TEntry>,
  ) => WizRpgEquipmentRuleResult<TEntry["entryId"], TReason>

  private constructor(token: symbol, definition: WizRpgEquipmentRulesDefinition<TEntry, TReason>) {
    if (token !== equipmentRulesConstructionToken) {
      throw new TypeError("WizRpgEquipmentRules must be created with define() or standard()")
    }
    const equip = definition.equip.bind(undefined)
    const unequip = definition.unequip.bind(undefined)
    this.equip = Object.freeze(
      (
        context: WizRpgEquipmentEquipContext<TEntry>,
      ): WizRpgEquipmentRuleResult<TEntry["entryId"], TReason> =>
        normalizeEquipmentRuleResult<TEntry["entryId"], TReason>(
          equip(context),
          "RPG equipment equip rule",
        ),
    )
    this.unequip = Object.freeze(
      (
        context: WizRpgEquipmentUnequipContext<TEntry>,
      ): WizRpgEquipmentRuleResult<TEntry["entryId"], TReason> =>
        normalizeEquipmentRuleResult<TEntry["entryId"], TReason>(
          unequip(context),
          "RPG equipment unequip rule",
        ),
    )
    authenticEquipmentRules.add(this)
    Object.freeze(this)
  }

  static define<TEntry extends AnyInventoryEntry, const TReason extends string>(
    definition: WizRpgEquipmentRulesDefinition<TEntry, TReason>,
  ): WizRpgEquipmentRules<TEntry, TReason> {
    return new WizRpgEquipmentRules(equipmentRulesConstructionToken, definition)
  }

  static standard<TEntry extends AnyInventoryEntry>(): WizRpgEquipmentRules<
    TEntry,
    WizRpgStandardEquipmentRuleReason
  > {
    return WizRpgEquipmentRules.define({
      equip: ({ definition, entry, equipment, inventory, slotId }) => {
        if (definition.slotId !== slotId) {
          return Object.freeze({
            accepted: false,
            reason: "INVENTORY_EQUIPMENT_SLOT_MISMATCH",
          })
        }
        if (equipment.entryAt(slotId) === entry.entryId) {
          return Object.freeze({
            accepted: false,
            reason: "INVENTORY_EQUIPMENT_ALREADY_EQUIPPED",
          })
        }
        return Object.freeze({
          accepted: true,
          equipment: equipment.equip(slotId, entry.entryId, inventory),
        })
      },
      unequip: ({ equipment, slotId }) =>
        Object.freeze({
          accepted: true,
          equipment: equipment.unequip(slotId),
        }),
    })
  }

  /** @internal mechanics composition boundary only. */
  static require(value: unknown, label: string): void {
    if (typeof value !== "object" || value === null || !authenticEquipmentRules.has(value)) {
      throw new TypeError(
        `${label} must be created with WizRpgEquipmentRules.define() or standard()`,
      )
    }
  }

  static accept<TEntryId extends string>(
    equipment: WizEquipmentLoadout<string, TEntryId>,
  ): WizRpgEquipmentRuleResult<TEntryId, never> {
    return normalizeEquipmentRuleResult<TEntryId, never>(
      { accepted: true, equipment },
      "RPG equipment rule result",
    )
  }

  static reject<const TReason extends string>(
    reason: TReason,
  ): WizRpgEquipmentRuleResult<never, TReason> {
    return normalizeEquipmentRuleResult<never, TReason>(
      { accepted: false, reason },
      "RPG equipment rule result",
    )
  }
}

Object.freeze(WizRpgEquipmentRules.prototype)
Object.freeze(WizRpgEquipmentRules)
