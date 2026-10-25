import { describe, expect, it } from "vite-plus/test"
import { withMockInventory } from "@/lib/wiz/core/mocks/mock-inventory"
import { MOCK_CONTENT, MOCK_INITIAL_STATE, MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { WizSceneInventoryReducer } from "@/lib/wiz/core/runtime/scenes/inventory/reducer"

const inventoryReducer = new WizSceneInventoryReducer({ content: MOCK_CONTENT })
const reduce = (...args: Parameters<WizSceneInventoryReducer["reduce"]>) =>
  inventoryReducer.reduce(...args).state

describe("USE_ITEM", () => {
  it("回復アイテムを使用するとHPが回復する", () => {
    const damagedVault = withMockInventory(
      MOCK_VAULT.updatePlayer((p) => p.damage(20)),
      [{ contentType: "item", contentId: "potion" }],
    )
    const state = MOCK_INITIAL_STATE.withVault(damagedVault)
    const initialHp = state.vault.player.hp

    const result = reduce(state, {
      type: "USE_ITEM",
      itemId: "potion",
    })

    expect(result.vault.player.hp).toBe(initialHp + 15)
  })

  it("アイテム使用後にインベントリから消費される", () => {
    const vaultWithItem = withMockInventory(
      MOCK_VAULT.updatePlayer((p) => p.damage(1)),
      [{ contentType: "item", contentId: "potion", quantity: 2 }],
    )
    const state = MOCK_INITIAL_STATE.withVault(vaultWithItem)

    const result = reduce(state, {
      type: "USE_ITEM",
      itemId: "potion",
    })

    expect(result.vault.inventory.totalQuantity("item", "potion")).toBe(1)
  })

  it("最後の1個を使用するとインベントリからアイテムが削除される", () => {
    const vaultWithItem = withMockInventory(
      MOCK_VAULT.updatePlayer((p) => p.damage(1)),
      [{ contentType: "item", contentId: "potion" }],
    )
    const state = MOCK_INITIAL_STATE.withVault(vaultWithItem)

    const result = reduce(state, {
      type: "USE_ITEM",
      itemId: "potion",
    })

    expect(result.vault.inventory.totalQuantity("item", "potion") > 0).toBe(false)
  })

  it("食料アイテムを使用すると空腹度が回復する", () => {
    const hungryVault = withMockInventory(
      MOCK_VAULT.updatePlayer((p) => p.addHunger(-30)),
      [{ contentType: "item", contentId: "bread" }],
    )
    const state = MOCK_INITIAL_STATE.withVault(hungryVault)
    const initialHunger = state.vault.player.hunger

    const result = reduce(state, {
      type: "USE_ITEM",
      itemId: "bread",
    })

    expect(result.vault.player.hunger).toBe(initialHunger + 20)
  })

  it("アイテム使用時にログが記録される", () => {
    const vaultWithItem = withMockInventory(
      MOCK_VAULT.updatePlayer((p) => p.damage(10)),
      [{ contentType: "item", contentId: "potion" }],
    )
    const state = MOCK_INITIAL_STATE.withVault(vaultWithItem)

    const result = reduce(state, {
      type: "USE_ITEM",
      itemId: "potion",
    })

    const lastLog = result.vault.log[result.vault.log.length - 1]
    expect(lastLog.key).toBe("ITEM_EFFECT_APPLIED")
    if (lastLog.key === "ITEM_EFFECT_APPLIED") {
      expect(lastLog.itemId).toBe("potion")
      expect(lastLog.events).toEqual([{ type: "hp_restored", amount: 10 }])
    }
  })

  it("実変化のない回復アイテムは消費せずログも追加しない", () => {
    const vaultWithItem = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "potion" },
    ])
    const state = MOCK_INITIAL_STATE.withVault(vaultWithItem)

    const result = reduce(state, {
      type: "USE_ITEM",
      itemId: "potion",
    })

    expect(result).toBe(state)
    expect(result.vault.inventory.totalQuantity("item", "potion")).toBe(1)
    expect(result.vault.log).toEqual(state.vault.log)
  })

  it("存在しないアイテムを使用しようとすると状態が変わらない", () => {
    const state = MOCK_INITIAL_STATE

    const result = reduce(state, {
      type: "USE_ITEM",
      itemId: "nonexistent",
    })

    expect(result).toBe(state)
  })

  it("インベントリにないアイテムを使用しようとすると状態が変わらない", () => {
    const state = MOCK_INITIAL_STATE

    const result = reduce(state, {
      type: "USE_ITEM",
      itemId: "potion",
    })

    expect(result).toBe(state)
  })
})

describe("EQUIP", () => {
  it("コンテンツ定義のスロットへ武器を装備しログを残す", () => {
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "weapon", contentId: "iron_sword" },
    ])
    const entry = vault.inventory.entriesFor("weapon", "iron_sword")[0]
    if (!entry) throw new Error("weapon fixture is required")
    const state = MOCK_INITIAL_STATE.withVault(vault)

    const result = reduce(state, {
      type: "EQUIP",
      slotId: "mainHand",
      entryId: entry.entryId,
    })

    expect(result.vault.equippedAt("mainHand")).toBe(entry.entryId)
    expect(result.vault.log.at(-1)).toEqual({
      key: "EQUIPPED_WEAPON",
      weaponId: "iron_sword",
    })
  })

  it("同じスロットの別装備へ持ち替えられる", () => {
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "weapon", contentId: "wooden_sword" },
      { contentType: "weapon", contentId: "iron_sword" },
    ])
    const woodenEntry = vault.inventory.entriesFor("weapon", "wooden_sword")[0]
    const ironEntry = vault.inventory.entriesFor("weapon", "iron_sword")[0]
    if (!woodenEntry || !ironEntry) throw new Error("weapon fixtures are required")
    const state = MOCK_INITIAL_STATE.withVault(
      vault.withEquipment(vault.equipment.equip("mainHand", woodenEntry.entryId, vault.inventory)),
    )

    const result = reduce(state, {
      type: "EQUIP",
      slotId: "mainHand",
      entryId: ironEntry.entryId,
    })

    expect(result.vault.equippedAt("mainHand")).toBe(ironEntry.entryId)
  })

  it("防具も同じアクションで装備できる", () => {
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "armor", contentId: "leather_armor" },
    ])
    const entry = vault.inventory.entriesFor("armor", "leather_armor")[0]
    if (!entry) throw new Error("armor fixture is required")
    const state = MOCK_INITIAL_STATE.withVault(vault)

    const result = reduce(state, {
      type: "EQUIP",
      slotId: "body",
      entryId: entry.entryId,
    })

    expect(result.vault.equippedAt("body")).toBe(entry.entryId)
    expect(result.vault.log.at(-1)).toEqual({
      key: "EQUIPPED_ARMOR",
      armorId: "leather_armor",
    })
  })

  it("所有していない装備を拒否する", () => {
    const result = inventoryReducer.reduce(MOCK_INITIAL_STATE, {
      type: "EQUIP",
      slotId: "mainHand",
      entryId: "unowned-entry",
    })

    expect(result).toMatchObject({
      accepted: false,
      reason: "INVENTORY_EQUIPMENT_NOT_FOUND",
    })
  })

  it("定義と異なるスロットを拒否する", () => {
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "weapon", contentId: "iron_sword" },
    ])
    const entry = vault.inventory.entriesFor("weapon", "iron_sword")[0]
    if (!entry) throw new Error("weapon fixture is required")
    const state = MOCK_INITIAL_STATE.withVault(vault)

    const result = inventoryReducer.reduce(state, {
      type: "EQUIP",
      slotId: "body",
      entryId: entry.entryId,
    })

    expect(result).toMatchObject({
      accepted: false,
      reason: "INVENTORY_EQUIPMENT_SLOT_MISMATCH",
    })
  })
})

describe("UNEQUIP", () => {
  it("指定した装備スロットを外し、装備種別に応じたログを残す", () => {
    const vault = withMockInventory(MOCK_VAULT, [
      { contentType: "weapon", contentId: "iron_sword" },
    ])
    const entry = vault.inventory.entriesFor("weapon", "iron_sword")[0]
    if (!entry) throw new Error("weapon fixture is required")
    const state = MOCK_INITIAL_STATE.withVault(
      vault.withEquipment(vault.equipment.equip("mainHand", entry.entryId, vault.inventory)),
    )

    const result = reduce(state, { type: "UNEQUIP", slotId: "mainHand" })

    expect(result.vault.equippedAt("mainHand")).toBeNull()
    expect(result.vault.log.at(-1)).toEqual({ key: "UNEQUIPPED_WEAPON" })
  })

  it("空のスロットを理由付きで拒否する", () => {
    const result = inventoryReducer.reduce(MOCK_INITIAL_STATE, {
      type: "UNEQUIP",
      slotId: "mainHand",
    })

    expect(result).toMatchObject({
      accepted: false,
      reason: "INVENTORY_EQUIPMENT_SLOT_EMPTY",
    })
    expect(result.state).toBe(MOCK_INITIAL_STATE)
  })
})

describe("未知のアクション", () => {
  it("未知のアクションタイプの場合は状態が変わらない", () => {
    const state = MOCK_INITIAL_STATE

    const result = reduce(state, {
      type: "UNKNOWN_ACTION",
    } as never)

    expect(result).toBe(state)
  })
})

describe("semantic rejection", () => {
  it("所有していないアイテムの使用を理由付きで拒否する", () => {
    const state = MOCK_INITIAL_STATE

    const result = inventoryReducer.reduce(state, {
      type: "USE_ITEM",
      itemId: "potion",
    })

    expect(result).toMatchObject({
      accepted: false,
      reason: "INVENTORY_ITEM_NOT_FOUND",
    })
    expect(result.state).toBe(state)
  })

  it("効果が生じないアイテムを消費せず理由付きで拒否する", () => {
    const state = MOCK_INITIAL_STATE.withVault(
      withMockInventory(MOCK_VAULT, [{ contentType: "item", contentId: "potion" }]),
    )

    const result = inventoryReducer.reduce(state, {
      type: "USE_ITEM",
      itemId: "potion",
    })

    expect(result).toMatchObject({
      accepted: false,
      reason: "INVENTORY_ITEM_EFFECT_REJECTED",
    })
    expect(result.state).toBe(state)
  })

  it("未装備スロットを外す操作を理由付きで拒否する", () => {
    const state = MOCK_INITIAL_STATE

    const result = inventoryReducer.reduce(state, {
      type: "UNEQUIP",
      slotId: "mainHand",
    })

    expect(result).toMatchObject({
      accepted: false,
      reason: "INVENTORY_EQUIPMENT_SLOT_EMPTY",
    })
    expect(result.state).toBe(state)
  })
})
