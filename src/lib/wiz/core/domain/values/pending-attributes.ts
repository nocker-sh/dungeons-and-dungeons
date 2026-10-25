import {
  WIZ_IMMUTABLE_VALUE,
  type WizDeepReadonly,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import { WIZ_ATTRIBUTE_KEYS, type WizAttributeKey, type WizAttributes } from "@/lib/wiz/core/types"
import {
  assertFiniteNumberValue,
  assertRecordValue,
  WizValueValidationError,
} from "@/lib/wiz/core/value-validation"

type PendingAttributeValues = WizDeepReadonly<Partial<WizAttributes>>
const pendingAttributeOwnership = new WizObjectService()
const attributeKeys = new Set<string>(WIZ_ATTRIBUTE_KEYS)

export class WizPendingAttributes {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  private readonly attributes: PendingAttributeValues

  private constructor(attributes: Partial<WizAttributes>) {
    assertRecordValue("pending-attributes", "$", attributes)
    for (const [attribute, value] of Object.entries(attributes)) {
      if (!attributeKeys.has(attribute)) {
        throw new WizValueValidationError(
          "pending-attributes",
          attribute,
          value,
          "a known attribute key",
        )
      }
      assertFiniteNumberValue("pending-attributes", attribute, value, {
        minimum: 0,
        safeInteger: true,
      })
    }
    this.attributes = pendingAttributeOwnership.ownImmutable(attributes)
    WizImmutableValue.freeze(this)
  }

  get(attribute: WizAttributeKey): number {
    return this.attributes[attribute] ?? 0
  }

  get total(): number {
    return Object.values(this.attributes).reduce<number>((sum, v) => sum + (v ?? 0), 0)
  }

  get vitalityBonus(): number {
    return this.attributes.vitality ?? 0
  }

  allocate(attribute: WizAttributeKey): WizPendingAttributes {
    const current = this.attributes[attribute] ?? 0
    return new WizPendingAttributes({
      ...this.attributes,
      [attribute]: current + 1,
    })
  }

  reset(): WizPendingAttributes {
    return WizPendingAttributes.fromPlain({})
  }

  toPlain(): PendingAttributeValues {
    return this.attributes
  }

  entries(): readonly (readonly [WizAttributeKey, number])[] {
    return Object.freeze(
      (Object.keys(this.attributes) as WizAttributeKey[])
        .filter((key) => (this.attributes[key] ?? 0) > 0)
        .map((key) => Object.freeze([key, this.attributes[key] ?? 0] as const)),
    )
  }

  static fromPlain(attributes: Partial<WizAttributes>): WizPendingAttributes {
    return new WizPendingAttributes(attributes)
  }
}
