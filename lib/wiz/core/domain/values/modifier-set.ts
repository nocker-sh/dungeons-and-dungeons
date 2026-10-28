import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizAttributeSet } from "@/lib/wiz/core/domain/values/attribute-set"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import { assertArrayValue } from "@/lib/wiz/core/assert-array-value"
import { assertFiniteNumberValue } from "@/lib/wiz/core/assert-finite-number-value"
import { assertRecordValue } from "@/lib/wiz/core/assert-record-value"
import { assertTrimmedNonEmptyStringValue } from "@/lib/wiz/core/assert-trimmed-non-empty-string-value"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

export type WizModifierOperation = "add" | "multiply" | "set"

export type WizModifierDefinition<
  TModifierId extends string = string,
  TAttributeId extends string = string,
  TSourceId extends string = string,
> = Readonly<{
  id: TModifierId
  attributeId: TAttributeId
  sourceId: TSourceId
  operation: WizModifierOperation
  value: number
  priority?: number
}>

export type WizModifierProperties<
  TModifierId extends string = string,
  TAttributeId extends string = string,
  TSourceId extends string = string,
> = Readonly<{
  id: TModifierId
  attributeId: TAttributeId
  sourceId: TSourceId
  operation: WizModifierOperation
  value: number
  priority: number
}>

type AnyWizModifier = WizModifier<string, string, string>

const modifierConstructionToken = Symbol("WizModifier.constructor")
const modifierSetConstructionToken = Symbol("WizModifierSet.constructor")
const authenticModifiers = new WeakSet<object>()
const authenticModifierSets = new WeakSet<object>()
const modifierOwnership = new WizObjectService()

const assertModifierOperation: (
  operation: unknown
) => asserts operation is WizModifierOperation = (operation) => {
  if (operation !== "add" && operation !== "multiply" && operation !== "set") {
    throw new WizValueValidationError(
      "modifier",
      "operation",
      operation,
      "add, multiply, or set"
    )
  }
}

/**
 * 一つのattributeへ適用する出自付きの不変modifier。
 */
export class WizModifier<
  TModifierId extends string = string,
  TAttributeId extends string = string,
  TSourceId extends string = string,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly id: TModifierId
  readonly attributeId: TAttributeId
  readonly sourceId: TSourceId
  readonly operation: WizModifierOperation
  readonly value: number
  readonly priority: number

  private constructor(
    token: typeof modifierConstructionToken,
    definition: WizModifierDefinition<TModifierId, TAttributeId, TSourceId>
  ) {
    if (token !== modifierConstructionToken) {
      throw new TypeError("WizModifier must be created with define()")
    }
    assertRecordValue("modifier", "$", definition)
    assertTrimmedNonEmptyStringValue("modifier", "id", definition.id)
    assertTrimmedNonEmptyStringValue(
      "modifier",
      "attributeId",
      definition.attributeId
    )
    assertTrimmedNonEmptyStringValue(
      "modifier",
      "sourceId",
      definition.sourceId
    )
    assertModifierOperation(definition.operation)
    assertFiniteNumberValue("modifier", "value", definition.value)
    assertFiniteNumberValue("modifier", "priority", definition.priority ?? 0, {
      safeInteger: true,
    })
    this.id = definition.id
    this.attributeId = definition.attributeId
    this.sourceId = definition.sourceId
    this.operation = definition.operation
    this.value = definition.value
    this.priority = definition.priority ?? 0
    authenticModifiers.add(this)
    WizImmutableValue.freeze(this)
  }

  static define<
    const TModifierId extends string,
    const TAttributeId extends string,
    const TSourceId extends string,
  >(
    definition: WizModifierDefinition<TModifierId, TAttributeId, TSourceId>
  ): WizModifier<TModifierId, TAttributeId, TSourceId> {
    return new WizModifier(modifierConstructionToken, definition)
  }

  static require(
    value: unknown,
    label = "Modifier"
  ): asserts value is WizModifier {
    if (
      typeof value !== "object" ||
      value === null ||
      !authenticModifiers.has(value)
    ) {
      throw new TypeError(`${label} must be created with WizModifier.define()`)
    }
  }

  toProperties(): WizModifierProperties<TModifierId, TAttributeId, TSourceId> {
    return {
      id: this.id,
      attributeId: this.attributeId,
      sourceId: this.sourceId,
      operation: this.operation,
      priority: this.priority,
      value: this.value,
    }
  }
}

const applyModifier = (current: number, modifier: AnyWizModifier): number => {
  if (modifier.operation === "add") return current + modifier.value
  if (modifier.operation === "multiply") return current * modifier.value
  return modifier.value
}

/**
 * modifierを出自ごとに追加・解除し、base attributeから派生値を計算する不変collection。
 */
export class WizModifierSet<TModifier extends AnyWizModifier = AnyWizModifier> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly modifiers: readonly TModifier[]

  private constructor(
    token: typeof modifierSetConstructionToken,
    modifiers: readonly TModifier[]
  ) {
    if (token !== modifierSetConstructionToken) {
      throw new TypeError(
        "WizModifierSet must be created with create() or fromUnknown()"
      )
    }
    assertArrayValue("modifier-set", "$", modifiers)
    const seen = new Set<string>()
    for (const [index, modifier] of modifiers.entries()) {
      WizModifier.require(modifier, `Modifier at index ${index}`)
      if (seen.has(modifier.id)) {
        throw new RangeError(`Duplicate modifier id "${modifier.id}"`)
      }
      seen.add(modifier.id)
    }
    this.modifiers = Object.freeze([...modifiers])
    authenticModifierSets.add(this)
    WizImmutableValue.freeze(this)
  }

  static create<const TModifiers extends readonly AnyWizModifier[]>(
    modifiers: TModifiers = [] as unknown as TModifiers
  ): WizModifierSet<TModifiers[number]> {
    return new WizModifierSet(modifierSetConstructionToken, modifiers)
  }

  static fromUnknown(input: unknown): WizModifierSet {
    assertArrayValue("modifier-set", "$", input)
    const modifiers = input.map((definition) => {
      assertRecordValue("modifier-set", "modifier", definition)
      return WizModifier.define({
        attributeId: definition.attributeId as string,
        id: definition.id as string,
        operation: definition.operation as WizModifierOperation,
        priority: definition.priority as number | undefined,
        sourceId: definition.sourceId as string,
        value: definition.value as number,
      })
    })
    return new WizModifierSet(modifierSetConstructionToken, modifiers)
  }

  static require(
    value: unknown,
    label = "Modifier set"
  ): asserts value is WizModifierSet {
    if (
      typeof value !== "object" ||
      value === null ||
      !authenticModifierSets.has(value)
    ) {
      throw new TypeError(
        `${label} must be created with WizModifierSet.create() or fromUnknown()`
      )
    }
  }

  add<TNewModifier extends AnyWizModifier>(
    modifier: TNewModifier
  ): WizModifierSet<TModifier | TNewModifier> {
    WizModifier.require(modifier)
    return new WizModifierSet(modifierSetConstructionToken, [
      ...this.modifiers,
      modifier,
    ])
  }

  remove(modifierId: string): WizModifierSet<TModifier> {
    return new WizModifierSet(
      modifierSetConstructionToken,
      this.modifiers.filter((modifier) => modifier.id !== modifierId)
    )
  }

  removeSource(sourceId: string): WizModifierSet<TModifier> {
    return new WizModifierSet(
      modifierSetConstructionToken,
      this.modifiers.filter((modifier) => modifier.sourceId !== sourceId)
    )
  }

  derive<TBaseAttributeId extends string>(
    base: WizAttributeSet<TBaseAttributeId>
  ): WizAttributeSet<TBaseAttributeId> {
    WizAttributeSet.require(base)
    const next = Object.fromEntries(
      Object.entries(base.toPlain()).map(([attributeId, value]) => {
        const modifiers = this.modifiers
          .filter((modifier) => modifier.attributeId === attributeId)
          .map((modifier, index) => ({ index, modifier }))
          .sort(
            (left, right) =>
              left.modifier.priority - right.modifier.priority ||
              left.index - right.index
          )
        return [
          attributeId,
          modifiers.reduce(
            (current, entry) => applyModifier(current, entry.modifier),
            value
          ),
        ]
      })
    ) as WizAttributeSetStateFor<TBaseAttributeId>
    return WizAttributeSet.create<TBaseAttributeId>(next)
  }

  toPlain(): readonly WizDeepReadonly<WizModifierProperties>[] {
    return modifierOwnership.ownImmutable(
      this.modifiers.map((modifier) => modifier.toProperties())
    )
  }
}

type WizAttributeSetStateFor<TAttributeId extends string> = Readonly<
  Record<TAttributeId, number>
>

Object.freeze(WizModifier.prototype)
Object.freeze(WizModifier)
Object.freeze(WizModifierSet.prototype)
Object.freeze(WizModifierSet)
