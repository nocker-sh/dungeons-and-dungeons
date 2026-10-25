import { expect, test } from "vite-plus/test"
import type { WizAction } from "@/lib/wiz/core/runtime/action"

test("WizSceneAction は各シーンのアクション型を含む", () => {
  // 型レベルのテスト - コンパイルが通れば OK
  const actions: WizAction[] = [
    // System
    { type: "WORLD_RESET" },
    { type: "WORLD_ENDED" },
    { type: "ADVANCE_TIME" },

    // Village
    { type: "GO_TO_SHOP", shopId: "item_shop" },
    { type: "GO_TO_INN" },
    { type: "GO_TO_EXPLORATION", areaId: "forest" },

    // Shop
    { type: "SELECT_ITEM_TO_BUY", shopId: "item_shop", itemId: "potion" },
    { type: "LEAVE_SHOP" },

    // Inn
    { type: "SELECT_STAY_PLAN", plan: "basic" },
    { type: "LEAVE_INN" },

    // Exploration
    { type: "CONTINUE_EXPLORATION" },
    { type: "RETURN_TO_VILLAGE" },

    // Battle
    { type: "BATTLE_START" },
    { type: "BATTLE_FLEE" },

    // Conversation
    { type: "ADVANCE_DIALOGUE" },
    { type: "END_CONVERSATION" },

    // Crafting
    { type: "SELECT_RECIPE", recipeId: "potion" },
    { type: "LEAVE_CRAFTING" },

    // Quest
    { type: "SELECT_QUEST", questId: "quest1" },
    { type: "ACCEPT_QUEST" },
    { type: "LEAVE_QUEST" },

    // Level Up
    { type: "ALLOCATE_ATTRIBUTE", attribute: "strength" },
    { type: "CONFIRM_LEVEL_UP" },

    // Inventory
    { type: "USE_ITEM", itemId: "potion" },
    {
      type: "EQUIP",
      slotId: "mainHand",
      entryId: "sword-entry",
    },
  ]

  expect(actions.length).toBeGreaterThan(0)
})
