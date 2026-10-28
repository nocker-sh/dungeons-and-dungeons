import { describe, expect, it } from "vite-plus/test"
import type { WizContentRecipe } from "@/lib/wiz/core/definition/recipe/recipe"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { WizStateCraftingResult } from "@/lib/wiz/core/domain/values/crafting-result"
import { WizEngineCrafting } from "@/lib/wiz/core/engine/crafting"
import { WizEngineExplorationSkillCheck } from "@/lib/wiz/core/engine/exploration/skill-check"
import { createMockInventoryService } from "@/lib/wiz/core/mocks/create-mock-inventory-service"
import { withMockInventory } from "@/lib/wiz/core/mocks/with-mock-inventory"
import { WizDice } from "@/lib/wiz/core/services/wiz-dice"
import type { WizSkillCheckResult } from "@/lib/wiz/core/types"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

// モック用のスキルチェックサービス
const createMockSkillCheck = (
  mockResult: Partial<WizSkillCheckResult>
): WizEngineExplorationSkillCheck => {
  return {
    check: () => ({
      dice: [3, 4] as readonly [number, number],
      total: 7,
      modifier: 0,
      targetNumber: 10,
      success: false,
      critical: false,
      fumble: false,
      ...mockResult,
    }),
  } as unknown as WizEngineExplorationSkillCheck
}

// テスト用のデフォルトサービス
const createDefaultService = (vault: WizVaultValue) =>
  new WizEngineCrafting(
    new WizEngineExplorationSkillCheck(new WizDice()),
    createMockInventoryService(vault.toPlain().inventory)
  )

const testRecipe: WizContentRecipe = {
  id: "test-recipe",
  name: "テストレシピ",
  description: "テスト用",
  materials: [
    { type: "item", itemId: "herb", quantity: 2 },
    { type: "item", itemId: "water", quantity: 1 },
  ],
  result: { type: "item", itemId: "potion" },
  difficulty: 10,
}

describe("hasMaterials", () => {
  it("素材が足りている場合はtrueを返す", () => {
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "herb", quantity: 5 },
      { contentType: "item", contentId: "water", quantity: 3 },
    ])
    const service = createDefaultService(vault)

    expect(service.hasMaterials(vault, testRecipe)).toBe(true)
  })

  it("素材が足りない場合はfalseを返す", () => {
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "herb" },
    ])
    const service = createDefaultService(vault)

    expect(service.hasMaterials(vault, testRecipe)).toBe(false)
  })

  it("一部の素材しかない場合はfalseを返す", () => {
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "herb", quantity: 5 },
    ])
    const service = createDefaultService(vault)

    expect(service.hasMaterials(vault, testRecipe)).toBe(false)
  })

  it("discriminated reference の武器・防具素材を確認できる", () => {
    const equipmentRecipe: WizContentRecipe = {
      ...testRecipe,
      materials: [
        { type: "weapon", weaponId: "iron_sword", quantity: 1 },
        { type: "armor", armorId: "leather_armor", quantity: 1 },
      ],
    }
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "weapon", contentId: "iron_sword" },
      { contentType: "armor", contentId: "leather_armor" },
    ])
    const service = createDefaultService(vault)

    expect(service.hasMaterials(vault, equipmentRecipe)).toBe(true)
  })
})

describe("consumeMaterials", () => {
  it("素材を消費する", () => {
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "herb", quantity: 5 },
      { contentType: "item", contentId: "water", quantity: 3 },
    ])
    const service = createDefaultService(vault)

    const newVault = service.consumeMaterials(vault, testRecipe)

    expect(newVault.inventory.totalQuantity("item", "herb")).toBe(3)
    expect(newVault.inventory.totalQuantity("item", "water")).toBe(2)
  })

  it("武器・防具素材を指定数量だけ消費する", () => {
    const equipmentRecipe: WizContentRecipe = {
      ...testRecipe,
      materials: [
        { type: "weapon", weaponId: "iron_sword", quantity: 1 },
        { type: "armor", armorId: "leather_armor", quantity: 1 },
      ],
    }
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "weapon", contentId: "iron_sword", quantity: 2 },
      { contentType: "armor", contentId: "leather_armor", quantity: 2 },
    ])
    const service = createDefaultService(vault)

    const newVault = service.consumeMaterials(vault, equipmentRecipe)

    expect(newVault.inventory.totalQuantity("weapon", "iron_sword")).toBe(1)
    expect(newVault.inventory.totalQuantity("armor", "leather_armor")).toBe(1)
  })
})

describe("executeResult", () => {
  it("成功時にアイテムとsemantic eventを返す", () => {
    const mockSkillCheck = createMockSkillCheck({ success: true })
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "herb", quantity: 5 },
      { contentType: "item", contentId: "water", quantity: 3 },
    ])
    const service = new WizEngineCrafting(
      mockSkillCheck,
      createMockInventoryService(vault.toPlain().inventory)
    )

    const result = service.executeResult(vault, testRecipe)

    expect(result.result.isSuccess).toBe(true)
    expect(result.vault.inventory.totalQuantity("item", "potion") > 0).toBe(
      true
    )
    expect(result.event).toEqual({
      type: "craft_succeeded",
      recipeId: "test-recipe",
      quality: "normal",
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.event)).toBe(true)
  })

  it("クリティカル成功時は高品質になる", () => {
    const mockSkillCheck = createMockSkillCheck({
      success: true,
      critical: true,
    })
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "herb", quantity: 5 },
      { contentType: "item", contentId: "water", quantity: 3 },
    ])
    const service = new WizEngineCrafting(
      mockSkillCheck,
      createMockInventoryService(vault.toPlain().inventory)
    )

    const result = service.executeResult(vault, testRecipe)

    expect(result.result.isHighQuality).toBe(true)
    expect(result.event).toEqual({
      type: "craft_succeeded",
      recipeId: "test-recipe",
      quality: "high",
    })
  })

  it("失敗時は素材だけ消費してsemantic eventを返す", () => {
    const mockSkillCheck = createMockSkillCheck({ success: false })
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "herb", quantity: 5 },
      { contentType: "item", contentId: "water", quantity: 3 },
    ])
    const service = new WizEngineCrafting(
      mockSkillCheck,
      createMockInventoryService(vault.toPlain().inventory)
    )

    const result = service.executeResult(vault, testRecipe)

    expect(result.result.isFailure).toBe(true)
    expect(result.vault.inventory.totalQuantity("item", "potion") > 0).toBe(
      false
    )
    expect(result.vault.inventory.totalQuantity("item", "herb")).toBe(3) // 消費済み
    expect(result.event).toEqual({
      type: "craft_failed",
      recipeId: "test-recipe",
      materialsLost: 2,
    })
  })

  it("武器レシピの場合は武器が追加される", () => {
    const weaponRecipe: WizContentRecipe = {
      ...testRecipe,
      result: { type: "weapon", weaponId: "iron_sword" },
    }
    const mockSkillCheck = createMockSkillCheck({ success: true })
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "herb", quantity: 5 },
      { contentType: "item", contentId: "water", quantity: 3 },
    ])
    const service = new WizEngineCrafting(
      mockSkillCheck,
      createMockInventoryService(vault.toPlain().inventory)
    )

    const result = service.executeResult(vault, weaponRecipe)

    expect(
      result.vault.inventory.totalQuantity("weapon", "iron_sword") > 0
    ).toBe(true)
  })

  it("防具レシピの場合は防具が追加される", () => {
    const armorRecipe: WizContentRecipe = {
      ...testRecipe,
      result: { type: "armor", armorId: "leather_armor" },
    }
    const mockSkillCheck = createMockSkillCheck({ success: true })
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "herb", quantity: 5 },
      { contentType: "item", contentId: "water", quantity: 3 },
    ])
    const service = new WizEngineCrafting(
      mockSkillCheck,
      createMockInventoryService(vault.toPlain().inventory)
    )

    const result = service.executeResult(vault, armorRecipe)

    expect(
      result.vault.inventory.totalQuantity("armor", "leather_armor") > 0
    ).toBe(true)
  })
})

const mockWizSkillCheckResult: WizSkillCheckResult = {
  dice: [3, 4],
  total: 7,
  modifier: 2,
  targetNumber: 10,
  success: true,
  critical: false,
  fumble: false,
}

describe("WizStateCraftingResult.pending", () => {
  it("保留状態を作成できる", () => {
    const result = WizStateCraftingResult.pending()

    expect(result.isPending).toBe(true)
    expect(result.isSuccess).toBe(false)
    expect(result.isFailure).toBe(false)
  })
})

describe("WizStateCraftingResult.success", () => {
  it("成功状態を作成できる", () => {
    const result = WizStateCraftingResult.success(mockWizSkillCheckResult)

    expect(result.isSuccess).toBe(true)
    expect(result.quality).toBe("normal")
    expect(result.diceResult).toEqual(mockWizSkillCheckResult)
  })

  it("クリティカル時は高品質になる", () => {
    const criticalDice = { ...mockWizSkillCheckResult, critical: true }
    const result = WizStateCraftingResult.success(criticalDice)

    expect(result.quality).toBe("high")
    expect(result.isHighQuality).toBe(true)
  })
})

describe("WizStateCraftingResult.failure", () => {
  it("失敗状態を作成できる", () => {
    const failedDice = { ...mockWizSkillCheckResult, success: false }
    const result = WizStateCraftingResult.failure(failedDice, 3)

    expect(result.isFailure).toBe(true)
    expect(result.materialsLost).toBe(3)
    expect(result.diceResult).toEqual(failedDice)
  })
})

describe("WizStateCraftingResult.toPlain", () => {
  it("プレーンオブジェクトに変換できる", () => {
    const result = WizStateCraftingResult.success(mockWizSkillCheckResult)
    const plain = result.toPlain()

    expect(plain.status).toBe("success")
  })
})
