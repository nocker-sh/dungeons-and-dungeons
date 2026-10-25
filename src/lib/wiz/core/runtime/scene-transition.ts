import type { WizPluginSceneNavigation } from "@/lib/wiz/core/runtime/plugin/plugin-scene-navigation"

export type WizBuiltInSceneTransition =
  | { readonly type: "GO_TO_VILLAGE" }
  | { readonly type: "GO_TO_SHOP"; readonly shopId: string }
  | { readonly type: "GO_TO_INN" }
  | { readonly type: "GO_TO_EXPLORATION"; readonly areaId: string }
  | { readonly type: "GO_TO_CONVERSATION"; readonly npcId: string }
  | { readonly type: "GO_TO_QUEST" }
  | { readonly type: "GO_TO_CRAFTING" }
  | {
      readonly type: "GO_TO_LEVEL_UP"
      readonly returnAreaId: string | null
    }
  | {
      readonly type: "START_BATTLE"
      readonly areaId: string
      readonly monsterIds: readonly string[]
    }

export type WizSceneTransition = WizBuiltInSceneTransition | WizPluginSceneNavigation

export type WizSceneTransitionRejectionReason =
  | "TRANSITION_INVALID"
  | "TRANSITION_AREA_NOT_FOUND"
  | "TRANSITION_AREA_LOCKED"
  | "TRANSITION_NPC_NOT_FOUND"
  | "TRANSITION_SHOP_NOT_FOUND"
  | "TRANSITION_LEVEL_UP_NOT_AVAILABLE"
  | "TRANSITION_MONSTERS_REQUIRED"
  | "TRANSITION_MONSTER_NOT_IN_AREA"
  | "TRANSITION_PLUGIN_NOT_FOUND"
  | "TRANSITION_PLUGIN_SOURCE_NOT_ALLOWED"
  | "TRANSITION_PLUGIN_STATE_INVALID"
