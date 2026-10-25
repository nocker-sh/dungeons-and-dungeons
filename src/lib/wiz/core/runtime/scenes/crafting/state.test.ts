import { describe, expect, it } from "vite-plus/test"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import {
  WizStateCrafting,
  type WizSceneCraftingMessage,
} from "@/lib/wiz/core/runtime/scenes/crafting/state"

const createState = (message: WizSceneCraftingMessage | null) =>
  new WizStateCrafting({
    type: "crafting",
    selectedRecipe: null,
    confirmingCraft: false,
    result: { status: "pending" },
    message,
    vault: MOCK_VAULT,
    availableFacilities: [],
  })

describe("WizStateCrafting message", () => {
  it("semantic messageを所有するimmutable stateとして保持する", () => {
    const message = {
      type: "missing_facility" as const,
      recipeId: "potion",
      facilityId: "alchemy",
    }
    const state = createState(message)

    message.facilityId = "forge"

    expect(state.message).toEqual({
      type: "missing_facility",
      recipeId: "potion",
      facilityId: "alchemy",
    })
    expect(Object.isFrozen(state.message)).toBe(true)
  })

  it("withMessageは元stateを変更せず新しいstateを返す", () => {
    const original = createState(null)
    const updated = original.withMessage({
      type: "missing_materials",
      recipeId: "potion",
    })

    expect(original.message).toBeNull()
    expect(updated).not.toBe(original)
    expect(updated.message).toEqual({
      type: "missing_materials",
      recipeId: "potion",
    })
  })
})
