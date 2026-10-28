import { describe, expect, it } from "vite-plus/test"
import {
  MOCK_CONTENT,
  MOCK_SHOP_DIALOGUE_SERVICE,
  MOCK_VAULT,
} from "@/lib/wiz/core/mocks/mock-vault"
import { WizStateCraftingResult } from "@/lib/wiz/core/domain/values/crafting-result"
import { WizEngineCrafting } from "@/lib/wiz/core/engine/crafting"
import { WizEngineExplorationSkillCheck } from "@/lib/wiz/core/engine/exploration/skill-check"
import { createMockInventoryService } from "@/lib/wiz/core/mocks/create-mock-inventory-service"
import { withMockInventory } from "@/lib/wiz/core/mocks/with-mock-inventory"
import { WizSceneTransitionService } from "@/lib/wiz/core/runtime/scene-transition-service"
import { MOCK_BATTLE_AUTHORITIES } from "@/lib/wiz/core/mocks/mock-battle-authorities"
import { toCraftingScene } from "@/lib/wiz/core/runtime/to-crafting-scene"
import { toVillageScene } from "@/lib/wiz/core/runtime/to-village-scene"
import { WizStateCrafting } from "@/lib/wiz/core/runtime/scenes/crafting/state"
import { WizSceneCraftingReducer } from "@/lib/wiz/core/runtime/scenes/crafting/reducer"
import { WizDice } from "@/lib/wiz/core/services/wiz-dice"

const inventoryService = createMockInventoryService(undefined, "crafting-entry")
const reducer = new WizSceneCraftingReducer({
  content: MOCK_CONTENT,
  dice: WizDice.fixed([3]),
  inventoryService,
})
const transitionService = new WizSceneTransitionService({
  ...MOCK_BATTLE_AUTHORITIES,
  content: MOCK_CONTENT,
  shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
})
const reduce = (...args: Parameters<WizSceneCraftingReducer["reduce"]>) =>
  transitionService.applyResult(reducer.reduce(...args)).state

describe("SELECT_RECIPE", () => {
  it("レシピを選択して確認状態になる", () => {
    const state = toCraftingScene(MOCK_VAULT)

    const result = reduce(state, {
      type: "SELECT_RECIPE",
      recipeId: "potion",
    })

    expect(result.type).toBe("crafting")
    if (result.type === "crafting") {
      expect(result.selectedRecipe).not.toBeNull()
      expect(result.selectedRecipe?.id).toBe("potion")
      expect(result.confirmingCraft).toBe(true)
      expect(result.result.status).toBe("pending")
      expect(result.message).toBeNull()
    }
  })

  it("存在しないレシピ ID の場合は状態が変わらない", () => {
    const state = toCraftingScene(MOCK_VAULT)

    const result = reduce(state, {
      type: "SELECT_RECIPE",
      recipeId: "nonexistent",
    })

    expect(result.type).toBe("crafting")
    if (result.type === "crafting") {
      expect(result.selectedRecipe).toBeNull()
    }
  })

  it("crafting 以外のフェーズでは状態が変わらない", () => {
    const villageState = toVillageScene(MOCK_VAULT)

    const result = reduce(villageState as never, {
      type: "SELECT_RECIPE",
      recipeId: "potion",
    })

    expect(result as never).toBe(villageState as never)
  })
})

describe("CONFIRM_CRAFT", () => {
  describe("素材が十分で製作成功する場合", () => {
    it("アイテムレシピの製作に成功するとアイテムが追加される", () => {
      // potion: herb x2, difficulty 6
      // 固定ダイスで必ず成功させる (6+6=12)
      const successDice = WizDice.fixed([6, 6])
      const successSkillCheck = new WizEngineExplorationSkillCheck(successDice)
      const successCraftingService = new WizEngineCrafting(
        successSkillCheck,
        inventoryService
      )
      const successReducer = new WizSceneCraftingReducer({
        content: MOCK_CONTENT,
        craftingService: successCraftingService,
        inventoryService,
      })
      const reduceSuccess = (
        ...args: Parameters<WizSceneCraftingReducer["reduce"]>
      ) => transitionService.applyResult(successReducer.reduce(...args)).state

      const vaultWithMaterials = withMockInventory(MOCK_VAULT, [
        { contentType: "item", contentId: "herb", quantity: 2 },
      ])
      const state = toCraftingScene(vaultWithMaterials)
      const stateWithRecipe = reduceSuccess(state, {
        type: "SELECT_RECIPE",
        recipeId: "potion",
      })

      const result = reduceSuccess(stateWithRecipe, {
        type: "CONFIRM_CRAFT",
      })

      expect(result.type).toBe("crafting")
      if (result.type === "crafting") {
        expect(result.result.status).toBe("success")
        expect(result.selectedRecipe).toBeNull()
        expect(result.confirmingCraft).toBe(false)
        expect(result.message).toEqual({
          type: "craft_succeeded",
          recipeId: "potion",
          quality: "high",
        })
        expect(Object.isFrozen(result.message)).toBe(true)
        // 素材消費 + 成果物追加
        expect(result.vault.inventory.totalQuantity("item", "herb")).toBe(0)
        expect(result.vault.inventory.totalQuantity("item", "potion") > 0).toBe(
          true
        )
      }
    })

    it("製作成功時にログが記録される", () => {
      const successDice = WizDice.fixed([6, 6])
      const successSkillCheck = new WizEngineExplorationSkillCheck(successDice)
      const successCraftingService = new WizEngineCrafting(
        successSkillCheck,
        inventoryService
      )
      const successReducer = new WizSceneCraftingReducer({
        content: MOCK_CONTENT,
        craftingService: successCraftingService,
        inventoryService,
      })
      const reduceSuccess = (
        ...args: Parameters<WizSceneCraftingReducer["reduce"]>
      ) => transitionService.applyResult(successReducer.reduce(...args)).state

      const vaultWithMaterials = withMockInventory(MOCK_VAULT, [
        { contentType: "item", contentId: "herb", quantity: 2 },
      ])
      const state = toCraftingScene(vaultWithMaterials)
      const stateWithRecipe = reduceSuccess(state, {
        type: "SELECT_RECIPE",
        recipeId: "potion",
      })

      const result = reduceSuccess(stateWithRecipe, {
        type: "CONFIRM_CRAFT",
      })

      expect(result.type).toBe("crafting")
      if (result.type === "crafting") {
        const log = result.vault.log
        const craftLog = log.find((l) => l.key === "CRAFTED_ITEM")
        expect(craftLog).toBeDefined()
      }
    })
  })

  describe("素材が十分だが製作失敗する場合", () => {
    it("製作に失敗すると素材だけ消費される", () => {
      // high_potion: herb x5, difficulty 10
      // 固定ダイスで必ず失敗させる (1+1=2, dexterity=5 なので total=7 < 10)
      const failDice = WizDice.fixed([1, 1])
      const failSkillCheck = new WizEngineExplorationSkillCheck(failDice)
      const failCraftingService = new WizEngineCrafting(
        failSkillCheck,
        inventoryService
      )
      const failReducer = new WizSceneCraftingReducer({
        content: MOCK_CONTENT,
        craftingService: failCraftingService,
        inventoryService,
      })
      const reduceFail = (
        ...args: Parameters<WizSceneCraftingReducer["reduce"]>
      ) => transitionService.applyResult(failReducer.reduce(...args)).state

      const vaultWithMaterials = withMockInventory(MOCK_VAULT, [
        { contentType: "item", contentId: "herb", quantity: 5 },
      ])
      const state = toCraftingScene(vaultWithMaterials)
      const stateWithRecipe = reduceFail(state, {
        type: "SELECT_RECIPE",
        recipeId: "high_potion",
      })

      const result = reduceFail(stateWithRecipe, {
        type: "CONFIRM_CRAFT",
      })

      expect(result.type).toBe("crafting")
      if (result.type === "crafting") {
        expect(result.result.status).toBe("failure")
        expect(result.selectedRecipe).toBeNull()
        expect(result.confirmingCraft).toBe(false)
        expect(result.message).toEqual({
          type: "craft_failed",
          recipeId: "high_potion",
          materialsLost: 1,
        })
        // 素材は消費されるがアイテムは追加されない
        expect(result.vault.inventory.totalQuantity("item", "herb")).toBe(0)
        expect(
          result.vault.inventory.totalQuantity("item", "high_potion") > 0
        ).toBe(false)
      }
    })
  })

  describe("素材が不足している場合", () => {
    it("素材不足のメッセージが表示される", () => {
      // 素材なしで製作を試みる
      const state = toCraftingScene(MOCK_VAULT)
      const stateWithRecipe = reduce(state, {
        type: "SELECT_RECIPE",
        recipeId: "potion",
      })

      const result = reduce(stateWithRecipe, {
        type: "CONFIRM_CRAFT",
      })

      expect(result.type).toBe("crafting")
      if (result.type === "crafting") {
        expect(result.message).toEqual({
          type: "missing_materials",
          recipeId: "potion",
        })
      }
    })
  })

  describe("必要な施設がない場合", () => {
    it("施設不足のメッセージが表示される", () => {
      // super_potion は alchemy 施設が必要
      // 施設なしの state を作る
      const vaultWithMaterials = withMockInventory(MOCK_VAULT, [
        { contentType: "item", contentId: "rare_herb", quantity: 3 },
        { contentType: "item", contentId: "honey" },
      ])
      const state = new WizStateCrafting({
        type: "crafting",
        selectedRecipe: null,
        confirmingCraft: false,
        result: WizStateCraftingResult.pending().toPlain(),
        message: null,
        vault: vaultWithMaterials,
        availableFacilities: [], // 施設なし
      })
      const stateWithRecipe = reduce(state, {
        type: "SELECT_RECIPE",
        recipeId: "super_potion",
      })

      const result = reduce(stateWithRecipe, {
        type: "CONFIRM_CRAFT",
      })

      expect(result.type).toBe("crafting")
      if (result.type === "crafting") {
        expect(result.message).toEqual({
          type: "missing_facility",
          recipeId: "super_potion",
          facilityId: "alchemy",
        })
      }
    })
  })

  it("レシピ未選択の場合は状態が変わらない", () => {
    const state = toCraftingScene(MOCK_VAULT)

    const result = reduce(state, { type: "CONFIRM_CRAFT" })

    expect(result).toBe(state)
  })

  it("crafting 以外のフェーズでは状態が変わらない", () => {
    const villageState = toVillageScene(MOCK_VAULT)

    const result = reduce(villageState as never, {
      type: "CONFIRM_CRAFT",
    })

    expect(result as never).toBe(villageState as never)
  })
})

describe("CANCEL_CRAFT", () => {
  it("製作をキャンセルできる", () => {
    const state = toCraftingScene(MOCK_VAULT)
    const stateWithRecipe = reduce(state, {
      type: "SELECT_RECIPE",
      recipeId: "potion",
    })

    const result = reduce(stateWithRecipe, { type: "CANCEL_CRAFT" })

    expect(result.type).toBe("crafting")
    if (result.type === "crafting") {
      expect(result.selectedRecipe).toBeNull()
      expect(result.confirmingCraft).toBe(false)
      expect(result.result.status).toBe("pending")
    }
  })

  it("crafting 以外のフェーズでは状態が変わらない", () => {
    const villageState = toVillageScene(MOCK_VAULT)

    const result = reduce(villageState as never, { type: "CANCEL_CRAFT" })

    expect(result as never).toBe(villageState as never)
  })
})

describe("LEAVE_CRAFTING", () => {
  it("製作画面を離れて village フェーズになる", () => {
    const state = toCraftingScene(MOCK_VAULT)

    const result = reduce(state, { type: "LEAVE_CRAFTING" })

    expect(result.type).toBe("village")
  })

  it("製作終了ログが記録される", () => {
    const state = toCraftingScene(MOCK_VAULT)

    const result = reduce(state, { type: "LEAVE_CRAFTING" })

    const log = result.vault.log
    const lastLog = log[log.length - 1]
    expect(lastLog.key).toBe("LEFT_CRAFTING")
  })

  it("crafting 以外のフェーズでは状態が変わらない", () => {
    const villageState = toVillageScene(MOCK_VAULT)

    const result = reduce(villageState as never, { type: "LEAVE_CRAFTING" })

    expect(result as never).toBe(villageState as never)
  })
})

describe("不明なアクション", () => {
  it("crafting フェーズで不明なアクションの場合は状態が変わらない", () => {
    const state = toCraftingScene(MOCK_VAULT)

    const result = reduce(state, { type: "UNKNOWN_ACTION" } as never)

    expect(result).toBe(state)
  })
})
