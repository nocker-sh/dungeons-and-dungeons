import type {
  WizCraftingEvent,
  WizCraftingResultState,
} from "@/lib/wiz/core/domain/values/crafting-result"
import type { WizContentRecipe } from "@/lib/wiz/core/definition/recipe/recipe"
import {
  WIZ_IMMUTABLE_VALUE,
  type WizDeepReadonly,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

const objectService = new WizObjectService()

export type WizSceneCraftingMessage =
  | {
      readonly type: "missing_facility"
      readonly recipeId: string
      readonly facilityId: string
    }
  | {
      readonly type: "missing_materials"
      readonly recipeId: string
    }
  | WizCraftingEvent

export type WizStateCraftingDefinition = {
  readonly type: "crafting"
  readonly selectedRecipe: WizDeepReadonly<WizContentRecipe> | null
  readonly confirmingCraft: boolean
  readonly result: WizCraftingResultState
  readonly message: WizSceneCraftingMessage | null
  readonly vault: WizVaultValue
  readonly availableFacilities: readonly string[]
}

export class WizStateCrafting {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type = "crafting" as const
  private readonly properties: WizStateCraftingDefinition

  constructor(properties: WizStateCraftingDefinition) {
    this.properties = objectService.ownImmutable(properties)
    WizImmutableValue.freeze(this)
  }

  get vault() {
    return this.properties.vault
  }

  get selectedRecipe() {
    return this.properties.selectedRecipe
  }

  get confirmingCraft() {
    return this.properties.confirmingCraft
  }

  get result() {
    return this.properties.result
  }

  get message() {
    return this.properties.message
  }

  get availableFacilities() {
    return this.properties.availableFacilities
  }

  withSelectedRecipe(recipe: WizDeepReadonly<WizContentRecipe> | null) {
    return new WizStateCrafting({
      ...this.properties,
      selectedRecipe: recipe,
    })
  }

  withConfirmingCraft(confirming: boolean) {
    return new WizStateCrafting({
      ...this.properties,
      confirmingCraft: confirming,
    })
  }

  withResult(result: WizCraftingResultState) {
    return new WizStateCrafting({
      ...this.properties,
      result,
    })
  }

  withMessage(message: WizSceneCraftingMessage | null) {
    return new WizStateCrafting({
      ...this.properties,
      message,
    })
  }

  withVault(vault: WizVaultValue) {
    return new WizStateCrafting({
      ...this.properties,
      vault,
    })
  }

  updateVault(fn: (v: WizVaultValue) => WizVaultValue) {
    return new WizStateCrafting({
      ...this.properties,
      vault: fn(this.properties.vault),
    })
  }
}

Object.freeze(WizStateCrafting.prototype)
Object.freeze(WizStateCrafting)
