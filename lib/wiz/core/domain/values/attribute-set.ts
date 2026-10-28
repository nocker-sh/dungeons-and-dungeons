import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import { assertFiniteNumberValue } from "@/lib/wiz/core/assert-finite-number-value"
import { assertRecordValue } from "@/lib/wiz/core/assert-record-value"
import { assertTrimmedNonEmptyStringValue } from "@/lib/wiz/core/assert-trimmed-non-empty-string-value"

export type WizAttributeSetState<TAttributeId extends string = string> =
  Readonly<Record<TAttributeId, number>>

const attributeSetConstructionToken = Symbol("WizAttributeSet.constructor")
const authenticAttributeSets = new WeakSet<object>()
const attributeSetOwnership = new WizObjectService()

const parseAttributeSet = <TAttributeId extends string>(
  input: WizAttributeSetState<TAttributeId>
): WizAttributeSetState<TAttributeId> => {
  assertRecordValue("attribute-set", "$", input)
  for (const [attributeId, value] of Object.entries(input)) {
    assertTrimmedNonEmptyStringValue(
      "attribute-set",
      "attributeId",
      attributeId
    )
    assertFiniteNumberValue("attribute-set", attributeId, value)
  }
  return input
}

/**
 * 作品固有のattributeを固定fieldへ閉じ込めず保持する不変value。
 */
export class WizAttributeSet<TAttributeId extends string = string> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly #state: WizAttributeSetState<TAttributeId>

  private constructor(
    token: typeof attributeSetConstructionToken,
    state: WizAttributeSetState<TAttributeId>
  ) {
    if (token !== attributeSetConstructionToken) {
      throw new TypeError(
        "WizAttributeSet must be created with create() or fromUnknown()"
      )
    }
    this.#state = attributeSetOwnership.ownImmutable(parseAttributeSet(state))
    authenticAttributeSets.add(this)
    WizImmutableValue.freeze(this)
  }

  static create<const TAttributeId extends string>(
    state: WizAttributeSetState<TAttributeId>
  ): WizAttributeSet<TAttributeId> {
    return new WizAttributeSet<TAttributeId>(
      attributeSetConstructionToken,
      state
    )
  }

  static fromUnknown<const TAttributeIds extends readonly string[]>(
    attributeIds: TAttributeIds,
    input: unknown
  ): WizAttributeSet<TAttributeIds[number]> {
    if (!Array.isArray(attributeIds)) {
      throw new TypeError("Attribute IDs must be an array")
    }
    const expectedIds = new Set<string>()
    for (const [index, attributeId] of attributeIds.entries()) {
      assertTrimmedNonEmptyStringValue(
        "attribute-set",
        `attributeIds[${index}]`,
        attributeId
      )
      if (expectedIds.has(attributeId)) {
        throw new RangeError(`Duplicate attribute id "${attributeId}"`)
      }
      expectedIds.add(attributeId)
    }
    assertRecordValue("attribute-set", "$", input)
    const actualIds = Reflect.ownKeys(input)
    if (
      actualIds.length !== expectedIds.size ||
      actualIds.some(
        (attributeId) =>
          typeof attributeId !== "string" || !expectedIds.has(attributeId)
      )
    ) {
      throw new RangeError(
        "Attribute state must contain exactly the declared attribute IDs"
      )
    }
    return new WizAttributeSet(
      attributeSetConstructionToken,
      input as WizAttributeSetState<TAttributeIds[number]>
    )
  }

  static require(
    value: unknown,
    label = "Attribute set"
  ): asserts value is WizAttributeSet {
    if (
      typeof value !== "object" ||
      value === null ||
      !authenticAttributeSets.has(value)
    ) {
      throw new TypeError(
        `${label} must be created with WizAttributeSet.create() or fromUnknown()`
      )
    }
  }

  has(attributeId: string): attributeId is TAttributeId {
    return Object.hasOwn(this.#state, attributeId)
  }

  value(attributeId: TAttributeId): number {
    this.#requireAttribute(attributeId)
    return this.#state[attributeId]
  }

  withValue(
    attributeId: TAttributeId,
    value: number
  ): WizAttributeSet<TAttributeId> {
    this.#requireAttribute(attributeId)
    assertFiniteNumberValue("attribute-set", attributeId, value)
    return new WizAttributeSet<TAttributeId>(attributeSetConstructionToken, {
      ...this.#state,
      [attributeId]: value,
    })
  }

  add(
    attributeId: TAttributeId,
    amount: number
  ): WizAttributeSet<TAttributeId> {
    assertFiniteNumberValue("attribute-set", "amount", amount)
    return this.withValue(attributeId, this.value(attributeId) + amount)
  }

  toPlain(): WizDeepReadonly<WizAttributeSetState<TAttributeId>> {
    return this.#state as WizDeepReadonly<WizAttributeSetState<TAttributeId>>
  }

  #requireAttribute(attributeId: string): asserts attributeId is TAttributeId {
    if (!this.has(attributeId)) {
      throw new RangeError(`Unknown attribute id "${attributeId}"`)
    }
  }
}

Object.freeze(WizAttributeSet.prototype)
Object.freeze(WizAttributeSet)
