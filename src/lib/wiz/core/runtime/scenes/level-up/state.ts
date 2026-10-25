import { WIZ_IMMUTABLE_VALUE, WizImmutableValue } from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizAttributeKey, WizAttributes } from "@/lib/wiz/core/types"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

const objectService = new WizObjectService()

export type WizStateLevelUpDefinition = {
  readonly type: "level_up"
  readonly availablePoints: number
  readonly pendingAttributes: Partial<WizAttributes>
  readonly returnAreaId: string | null
  readonly vault: WizVaultValue
}

export class WizStateLevelUp {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "level_up" as const
  private readonly properties: WizStateLevelUpDefinition

  constructor(properties: WizStateLevelUpDefinition) {
    this.properties = objectService.ownImmutable(properties)
    WizImmutableValue.freeze(this)
  }

  get vault() {
    return this.properties.vault
  }

  get availablePoints() {
    return this.properties.availablePoints
  }

  get pendingAttributes() {
    return this.properties.pendingAttributes
  }

  get returnAreaId() {
    return this.properties.returnAreaId
  }

  withAvailablePoints(points: number) {
    return new WizStateLevelUp({
      ...this.properties,
      availablePoints: points,
    })
  }

  withPendingAttributes(attributes: Partial<WizAttributes>) {
    return new WizStateLevelUp({
      ...this.properties,
      pendingAttributes: attributes,
    })
  }

  addPendingAttribute(attribute: WizAttributeKey, amount: number) {
    const current = this.properties.pendingAttributes[attribute] ?? 0
    return new WizStateLevelUp({
      ...this.properties,
      pendingAttributes: {
        ...this.properties.pendingAttributes,
        [attribute]: current + amount,
      },
    })
  }

  withVault(vault: WizVaultValue) {
    return new WizStateLevelUp({
      ...this.properties,
      vault,
    })
  }

  updateVault(fn: (v: WizVaultValue) => WizVaultValue) {
    return new WizStateLevelUp({
      ...this.properties,
      vault: fn(this.properties.vault),
    })
  }
}

Object.freeze(WizStateLevelUp.prototype)
Object.freeze(WizStateLevelUp)
