import type { WizContentItem } from "@/lib/wiz/core/definition/item/item"
import {
  createBattleAbility,
  type WizBattleAbility,
  type WizBattleAbilityDefinition,
} from "@/lib/wiz/core/engine/battle/ability"
import { createBattleItem, type WizBattleItem } from "@/lib/wiz/core/engine/battle/item"
import {
  createWizImmutableRecord,
  getWizImmutableRecordValue,
} from "@/lib/wiz/core/immutable-record"
import { WIZ_IMMUTABLE_VALUE, WizImmutableValue } from "@/lib/wiz/core/immutable-value"

export type WizEngineBattleContentResolver = {
  readonly resolveAbility: (abilityId: string) => WizBattleAbility | undefined
  readonly resolveItem: (itemId: string) => WizBattleItem | undefined
}

export type WizEngineBattleAbilityDefinition = WizBattleAbility | WizBattleAbilityDefinition
export type WizEngineBattleItemDefinition = WizBattleItem | WizContentItem

export type WizEngineBattleContentDefinition = {
  readonly abilities?: Readonly<Record<string, WizEngineBattleAbilityDefinition>>
  readonly items?: Readonly<Record<string, WizEngineBattleItemDefinition>>
}

export type WizEngineBattleContentArrayDefinition = {
  readonly abilities?: readonly WizEngineBattleAbilityDefinition[]
  readonly items?: readonly WizEngineBattleItemDefinition[]
}

export type WizEngineBattleContentErrorCode = "duplicate_id" | "invalid_definition" | "key_mismatch"

export class WizEngineBattleContentError extends Error {
  override readonly name = "WizEngineBattleContentError"

  constructor(
    readonly code: WizEngineBattleContentErrorCode,
    readonly kind: "ability" | "item",
    readonly definitionId: string,
    readonly recordKey?: string,
  ) {
    super(
      code === "duplicate_id"
        ? `Duplicate battle ${kind} ID: ${definitionId}`
        : code === "key_mismatch"
          ? `Battle ${kind} key "${recordKey}" does not match definition ID "${definitionId}"`
          : `Invalid battle ${kind} definition: ${definitionId}`,
    )
    Object.freeze(this)
  }
}

const toCanonicalAbility = (definition: WizEngineBattleAbilityDefinition): WizBattleAbility => {
  try {
    return createBattleAbility(definition)
  } catch {
    throw new WizEngineBattleContentError("invalid_definition", "ability", definition.id)
  }
}

const toCanonicalItem = (definition: WizEngineBattleItemDefinition): WizBattleItem => {
  try {
    return createBattleItem(definition)
  } catch {
    throw new WizEngineBattleContentError("invalid_definition", "item", definition.id)
  }
}

const toAbilityRecord = (
  definitions: Readonly<Record<string, WizEngineBattleAbilityDefinition>>,
): Readonly<Record<string, WizBattleAbility>> => {
  const entries = Object.entries(definitions).map(([key, definition]) => {
    if (key !== definition.id) {
      throw new WizEngineBattleContentError("key_mismatch", "ability", definition.id, key)
    }
    return [key, toCanonicalAbility(definition)] as const
  })
  return createWizImmutableRecord(entries)
}

const toItemRecord = (
  definitions: Readonly<Record<string, WizEngineBattleItemDefinition>>,
): Readonly<Record<string, WizBattleItem>> => {
  const entries = Object.entries(definitions).map(([key, definition]) => {
    if (key !== definition.id) {
      throw new WizEngineBattleContentError("key_mismatch", "item", definition.id, key)
    }
    return [key, toCanonicalItem(definition)] as const
  })
  return createWizImmutableRecord(entries)
}

const toUniqueRecord = <TDefinition extends { readonly id: string }>(
  definitions: readonly TDefinition[],
  kind: "ability" | "item",
): Readonly<Record<string, TDefinition>> => {
  const ids = new Set<string>()
  const entries = definitions.map((definition) => {
    if (ids.has(definition.id)) {
      throw new WizEngineBattleContentError("duplicate_id", kind, definition.id)
    }
    ids.add(definition.id)
    return [definition.id, definition] as const
  })
  return createWizImmutableRecord(entries)
}

/**
 * 戦闘効果定義の唯一の解決元。
 *
 * action は ID だけを保持し、実行時には必ずこの immutable content から
 * canonical な定義を解決する。
 */
export class WizEngineBattleContent implements WizEngineBattleContentResolver {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly abilities: Readonly<Record<string, WizBattleAbility>>
  readonly items: Readonly<Record<string, WizBattleItem>>

  constructor(properties: WizEngineBattleContentDefinition = {}) {
    this.abilities = toAbilityRecord(properties.abilities ?? {})
    this.items = toItemRecord(properties.items ?? {})
    WizImmutableValue.freeze(this)
  }

  static fromArrays(input: WizEngineBattleContentArrayDefinition = {}): WizEngineBattleContent {
    return new WizEngineBattleContent({
      abilities: toUniqueRecord(input.abilities ?? [], "ability"),
      items: toUniqueRecord(input.items ?? [], "item"),
    })
  }

  readonly resolveAbility = (abilityId: string): WizBattleAbility | undefined => {
    return getWizImmutableRecordValue(this.abilities, abilityId)
  }

  readonly resolveItem = (itemId: string): WizBattleItem | undefined => {
    return getWizImmutableRecordValue(this.items, itemId)
  }
}

Object.freeze(WizEngineBattleContent.prototype)
Object.freeze(WizEngineBattleContent)
Object.freeze(WizEngineBattleContentError.prototype)
Object.freeze(WizEngineBattleContentError)
