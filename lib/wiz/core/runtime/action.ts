import type { WizSceneNavigationAction } from "@/lib/wiz/core/runtime/navigation/navigation-action"
import type { WizSceneBattleAction } from "@/lib/wiz/core/runtime/scenes/battle/action"
import type { WizSceneConversationAction } from "@/lib/wiz/core/runtime/scenes/conversation/action"
import type { WizSceneCraftingAction } from "@/lib/wiz/core/runtime/scenes/crafting/action"
import type { WizSceneExplorationAction } from "@/lib/wiz/core/runtime/scenes/exploration/action"
import type { WizSceneInnAction } from "@/lib/wiz/core/runtime/scenes/inn/action"
import type { WizSceneInventoryAction } from "@/lib/wiz/core/runtime/scenes/inventory/action"
import type { WizSceneLevelUpAction } from "@/lib/wiz/core/runtime/scenes/level-up/action"
import type { WizSceneQuestAction } from "@/lib/wiz/core/runtime/scenes/quest/action"
import type { WizSceneShopAction } from "@/lib/wiz/core/runtime/scenes/shop/action"
import type { WizSceneVillageAction } from "@/lib/wiz/core/runtime/scenes/village/action"
import type { WizSystemAction } from "@/lib/wiz/core/runtime/system/system-action"

export type WizAction =
  | WizSystemAction
  | WizSceneNavigationAction
  | WizSceneVillageAction
  | WizSceneShopAction
  | WizSceneInnAction
  | WizSceneExplorationAction
  | WizSceneBattleAction
  | WizSceneConversationAction
  | WizSceneCraftingAction
  | WizSceneQuestAction
  | WizSceneLevelUpAction
  | WizSceneInventoryAction

const WIZ_BUILT_IN_ACTION_NAMES: Readonly<Record<WizAction["type"], true>> = Object.freeze({
  ACCEPT_QUEST: true,
  ADD_LOG: true,
  ADVANCE_DIALOGUE: true,
  ADVANCE_SHOP_CONVERSATION: true,
  ADVANCE_TIME: true,
  ALLOCATE_ATTRIBUTE: true,
  BATTLE_END: true,
  BATTLE_EXECUTE_ACTION: true,
  BATTLE_EXECUTE_ENEMY_TURN: true,
  BATTLE_EXECUTE_INTENT: true,
  BATTLE_FLEE: true,
  BATTLE_START: true,
  CANCEL_CRAFT: true,
  CANCEL_GIFT: true,
  CANCEL_PURCHASE: true,
  CANCEL_STAY: true,
  CLEAR_QUEST_SELECTION: true,
  COMPLETE_QUEST: true,
  CONFIRM_CRAFT: true,
  CONFIRM_GIFT: true,
  CONFIRM_LEVEL_UP: true,
  CONFIRM_PURCHASE: true,
  CONFIRM_STAY: true,
  CONTINUE_EXPLORATION: true,
  EAT_FOOD: true,
  ENCOUNTER_MONSTER: true,
  END_CONVERSATION: true,
  END_SHOP_CONVERSATION: true,
  EQUIP: true,
  EXPLORATION_ACTION: true,
  GO_TO_CRAFTING: true,
  GO_TO_EXPLORATION: true,
  GO_TO_INN: true,
  GO_TO_QUEST: true,
  GO_TO_SHOP: true,
  LEAVE_CRAFTING: true,
  LEAVE_INN: true,
  LEAVE_QUEST: true,
  LEAVE_SHOP: true,
  NEW_DAY: true,
  RESET_PENDING_ATTRIBUTES: true,
  RETURN_TO_VILLAGE: true,
  ROLL_DICE: true,
  SELECT_ARMOR_TO_BUY: true,
  SELECT_DIALOGUE_OPTION: true,
  SELECT_EVENT_CHOICE: true,
  SELECT_GIFT: true,
  SELECT_ITEM_TO_BUY: true,
  SELECT_QUEST: true,
  SELECT_RECIPE: true,
  SELECT_STAY_PLAN: true,
  SELECT_VILLAGE_ACTION: true,
  SELECT_WEAPON_TO_BUY: true,
  SELL_ITEM: true,
  START_SHOP_CONVERSATION: true,
  TALK_TO_NPC: true,
  UNEQUIP: true,
  USE_ITEM: true,
  WORLD_ENDED: true,
  WORLD_RESET: true,
})

/** Plugin schemaのcanonical outputから組み込みaction名を排除するruntime authority。 */
export class WizBuiltInActionName {
  private constructor() {
    throw new TypeError("WizBuiltInActionName is a static-only authority")
  }

  static is(value: string): value is WizAction["type"] {
    return Object.hasOwn(WIZ_BUILT_IN_ACTION_NAMES, value)
  }
}

Object.freeze(WizBuiltInActionName)
