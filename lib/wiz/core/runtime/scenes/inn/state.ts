import type { WizEngineInnStayRejection } from "@/lib/wiz/core/engine/inn"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

const objectService = new WizObjectService()

export type WizSceneInnStayRejection =
  | WizEngineInnStayRejection
  | {
      readonly type: "no_plan_selected"
    }

export type WizSceneInnMessage = {
  readonly type: "stay_rejected"
  readonly rejection: WizSceneInnStayRejection
}

export type WizStateInnDefinition = {
  readonly type: "inn"
  readonly selectedPlan: string | null
  readonly confirmingStay: boolean
  readonly message: WizSceneInnMessage | null
  readonly vault: WizVaultValue
}

export class WizStateInn {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "inn" as const
  private readonly properties: WizStateInnDefinition

  constructor(properties: WizStateInnDefinition) {
    this.properties = objectService.ownImmutable(properties)
    WizImmutableValue.freeze(this)
  }

  get vault() {
    return this.properties.vault
  }

  get selectedPlan() {
    return this.properties.selectedPlan
  }

  get confirmingStay() {
    return this.properties.confirmingStay
  }

  get message() {
    return this.properties.message
  }

  withSelectedPlan(plan: string | null) {
    return new WizStateInn({
      ...this.properties,
      selectedPlan: plan,
    })
  }

  withConfirmingStay(confirming: boolean) {
    return new WizStateInn({
      ...this.properties,
      confirmingStay: confirming,
    })
  }

  withMessage(message: WizSceneInnMessage | null) {
    return new WizStateInn({
      ...this.properties,
      message,
    })
  }

  withVault(vault: WizVaultValue) {
    return new WizStateInn({
      ...this.properties,
      vault,
    })
  }

  updateVault(fn: (v: WizVaultValue) => WizVaultValue) {
    return new WizStateInn({
      ...this.properties,
      vault: fn(this.properties.vault),
    })
  }
}

Object.freeze(WizStateInn.prototype)
Object.freeze(WizStateInn)
