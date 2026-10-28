import { WizStateCraftingResult } from "@/lib/wiz/core/domain/values/crafting-result"
import { WizEngineCrafting } from "@/lib/wiz/core/engine/crafting"
import { WizEngineExplorationSkillCheck } from "@/lib/wiz/core/engine/exploration/skill-check"
import type { WizAction } from "@/lib/wiz/core/runtime/action"
import type { WizStandardInventoryService } from "@/lib/wiz/core/rpg/standard-inventory"
import {
  getWizRuntimeContentEntry,
  type WizRuntimeContentView,
} from "@/lib/wiz/core/runtime/content-view"
import { WizSceneResultFactory, type WizSceneResult } from "@/lib/wiz/core/runtime/scene-result"
import type { WizSceneCraftingAction } from "@/lib/wiz/core/runtime/scenes/crafting/action"
import type { WizStateCrafting } from "@/lib/wiz/core/runtime/scenes/crafting/state"
import type { WizState } from "@/lib/wiz/core/runtime/state"
import { WizDice } from "@/lib/wiz/core/services/wiz-dice"

type Dependencies = {
  readonly content: Pick<WizRuntimeContentView, "recipes">
  readonly inventoryService: WizStandardInventoryService
} & (
  | {
      readonly craftingService: WizEngineCrafting
      readonly dice?: WizDice
    }
  | {
      readonly craftingService?: undefined
      readonly dice: WizDice
    }
)

export class WizSceneCraftingReducer {
  private readonly content: Pick<WizRuntimeContentView, "recipes">
  private readonly craftingService: WizEngineCrafting

  constructor(dependencies: Dependencies) {
    this.content = dependencies.content
    this.craftingService =
      dependencies.craftingService ??
      new WizEngineCrafting(
        new WizEngineExplorationSkillCheck(dependencies.dice),
        dependencies.inventoryService,
      )
    Object.freeze(this)
  }

  reduce(state: WizState, action: WizAction | WizSceneCraftingAction): WizSceneResult<WizState> {
    if (state.type !== "crafting") return WizSceneResultFactory.accept(state)

    if (action.type === "SELECT_RECIPE") {
      return this.handleSelectRecipe(state, action)
    }

    if (action.type === "CONFIRM_CRAFT") {
      return this.handleConfirmCraft(state)
    }

    if (action.type === "CANCEL_CRAFT") {
      return WizSceneResultFactory.accept(
        state
          .withSelectedRecipe(null)
          .withConfirmingCraft(false)
          .withResult(WizStateCraftingResult.pending().toPlain()),
      )
    }

    if (action.type === "LEAVE_CRAFTING") {
      const newVault = state.vault.addLog({ key: "LEFT_CRAFTING" })
      return WizSceneResultFactory.accept(state.withVault(newVault), { type: "GO_TO_VILLAGE" })
    }

    return WizSceneResultFactory.accept(state)
  }

  private handleSelectRecipe(
    state: WizStateCrafting,
    action: { recipeId: string },
  ): WizSceneResult<WizState> {
    const recipe = getWizRuntimeContentEntry(this.content.recipes, action.recipeId)
    if (!recipe) return WizSceneResultFactory.reject(state, "RECIPE_NOT_FOUND")

    return WizSceneResultFactory.accept(
      state
        .withSelectedRecipe(recipe)
        .withConfirmingCraft(true)
        .withResult(WizStateCraftingResult.pending().toPlain())
        .withMessage(null),
    )
  }

  private handleConfirmCraft(state: WizStateCrafting): WizSceneResult<WizState> {
    if (!state.selectedRecipe) return WizSceneResultFactory.reject(state, "NO_RECIPE_SELECTED")
    const recipe = state.selectedRecipe
    const requiredFacility = recipe.requiresFacility

    if (requiredFacility && !this.craftingService.hasFacility(recipe, state.availableFacilities)) {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "missing_facility",
          recipeId: recipe.id,
          facilityId: requiredFacility,
        }),
        "MISSING_FACILITY",
      )
    }

    if (!this.craftingService.hasMaterials(state.vault, recipe)) {
      return WizSceneResultFactory.reject(
        state.withMessage({
          type: "missing_materials",
          recipeId: recipe.id,
        }),
        "MISSING_MATERIALS",
      )
    }

    const executeResult = this.craftingService.executeResult(state.vault, recipe)

    if (executeResult.result.isSuccess) {
      return WizSceneResultFactory.accept(
        state
          .withVault(
            executeResult.vault.addLog({
              key: "CRAFTED_ITEM",
              recipeId: recipe.id,
            }),
          )
          .withSelectedRecipe(null)
          .withConfirmingCraft(false)
          .withResult(executeResult.result.toPlain())
          .withMessage(executeResult.event),
      )
    }

    return WizSceneResultFactory.accept(
      state
        .withVault(executeResult.vault)
        .withSelectedRecipe(null)
        .withConfirmingCraft(false)
        .withResult(executeResult.result.toPlain())
        .withMessage(executeResult.event),
    )
  }
}
