import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

const objectService = new WizObjectService()

export type WizSceneVillageActionType =
  | "explore"
  | "shop"
  | "quest"
  | "talk"
  | "home"
  | "inn"

export type WizStateVillageDefinition = {
  readonly type: "village"
  readonly selectedAction: WizSceneVillageActionType | null
  readonly vault: WizVaultValue
}

export class WizStateVillage {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "village" as const
  private readonly properties: WizStateVillageDefinition

  constructor(properties: WizStateVillageDefinition) {
    this.properties = objectService.ownImmutable(properties)
    WizImmutableValue.freeze(this)
  }

  get vault() {
    return this.properties.vault
  }

  get selectedAction() {
    return this.properties.selectedAction
  }

  withSelectedAction(action: WizSceneVillageActionType | null) {
    return new WizStateVillage({
      ...this.properties,
      selectedAction: action,
    })
  }

  withVault(vault: WizVaultValue) {
    return new WizStateVillage({
      ...this.properties,
      vault,
    })
  }

  updateVault(fn: (v: WizVaultValue) => WizVaultValue) {
    return new WizStateVillage({
      ...this.properties,
      vault: fn(this.properties.vault),
    })
  }
}

Object.freeze(WizStateVillage.prototype)
Object.freeze(WizStateVillage)
