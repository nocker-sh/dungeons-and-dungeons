import {
  type WizCraftingEvent,
  WizStateCraftingResult,
} from "@/lib/wiz/core/domain/values/crafting-result"
import type { WizContentRecipe } from "@/lib/wiz/core/definition/recipe/recipe"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import {
  getWizContentRecipeMaterialId,
  getWizContentRecipeMaterialType,
} from "@/lib/wiz/core/definition/recipe/recipe-material"
import type { WizEngineExplorationSkillCheck } from "@/lib/wiz/core/engine/exploration/skill-check"
import type { WizStandardInventoryService } from "@/lib/wiz/core/rpg/standard-inventory"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export type WizEngineCraftExecutionResult = {
  readonly vault: WizVaultValue
  readonly result: WizStateCraftingResult
  readonly event: WizCraftingEvent
}

export class WizEngineCrafting {
  constructor(
    private readonly skillCheck: WizEngineExplorationSkillCheck,
    private readonly inventoryService: WizStandardInventoryService,
  ) {
    Object.freeze(this)
  }

  hasMaterials(vault: WizVaultValue, recipe: WizDeepReadonly<WizContentRecipe>): boolean {
    return recipe.materials.every(
      (material) =>
        vault.inventory.totalQuantity(
          getWizContentRecipeMaterialType(material),
          getWizContentRecipeMaterialId(material),
        ) >= material.quantity,
    )
  }

  hasFacility(
    recipe: WizDeepReadonly<WizContentRecipe>,
    availableFacilities: readonly string[],
  ): boolean {
    if (!recipe.requiresFacility) return true
    return availableFacilities.includes(recipe.requiresFacility)
  }

  consumeMaterials(vault: WizVaultValue, recipe: WizDeepReadonly<WizContentRecipe>): WizVaultValue {
    return recipe.materials.reduce((currentVault, material) => {
      return currentVault.updateInventory((inventory) =>
        this.inventoryService.consume(
          inventory,
          getWizContentRecipeMaterialType(material),
          getWizContentRecipeMaterialId(material),
          material.quantity,
        ),
      )
    }, vault)
  }

  executeResult(
    vault: WizVaultValue,
    recipe: WizDeepReadonly<WizContentRecipe>,
  ): WizEngineCraftExecutionResult {
    // Consume materials
    let newVault = this.consumeMaterials(vault, recipe)

    // Skill check
    const diceResult = this.skillCheck.check(
      vault.player.attributes.dexterity,
      0,
      recipe.difficulty,
    )

    if (diceResult.success) {
      // Success: add item
      const recipeResult = recipe.result
      if (recipeResult.type === "item") {
        newVault = newVault.updateInventory((inventory) =>
          this.inventoryService.add(inventory, "item", recipeResult.itemId),
        )
      } else if (recipeResult.type === "weapon") {
        newVault = newVault.updateInventory((inventory) =>
          this.inventoryService.add(inventory, "weapon", recipeResult.weaponId),
        )
      } else if (recipeResult.type === "armor") {
        newVault = newVault.updateInventory((inventory) =>
          this.inventoryService.add(inventory, "armor", recipeResult.armorId),
        )
      }

      const craftResult = WizStateCraftingResult.success(diceResult)
      const event: WizCraftingEvent = Object.freeze({
        type: "craft_succeeded",
        recipeId: recipe.id,
        quality: craftResult.isHighQuality ? "high" : "normal",
      })

      return Object.freeze({ vault: newVault, result: craftResult, event })
    }

    // Failure
    const craftResult = WizStateCraftingResult.failure(diceResult, recipe.materials.length)
    const event: WizCraftingEvent = Object.freeze({
      type: "craft_failed",
      recipeId: recipe.id,
      materialsLost: craftResult.materialsLost,
    })

    return Object.freeze({ vault: newVault, result: craftResult, event })
  }
}
