import type { WizSceneVillageActionType } from "@/lib/wiz/core/runtime/scenes/village/state"

export type WizSceneVillageAction =
  | Readonly<{ type: "SELECT_VILLAGE_ACTION"; action: WizSceneVillageActionType }>
  | Readonly<{ type: "GO_TO_SHOP"; shopId: string }>
  | Readonly<{ type: "GO_TO_INN" }>
  | Readonly<{ type: "GO_TO_EXPLORATION"; areaId: string }>
  | Readonly<{ type: "TALK_TO_NPC"; npcId: string }>
  | Readonly<{ type: "GO_TO_QUEST" }>
  | Readonly<{ type: "GO_TO_CRAFTING" }>
