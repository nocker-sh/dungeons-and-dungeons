import type { WizSceneExplorationActionType } from "@/lib/wiz/core/runtime/scenes/exploration/states/state"

export type WizSceneExplorationAction =
  | Readonly<{
      type: "EXPLORATION_ACTION"
      areaId: string
      action: WizSceneExplorationActionType
    }>
  | Readonly<{ type: "SELECT_EVENT_CHOICE"; eventId: string; choiceIndex: number }>
  | Readonly<{ type: "ROLL_DICE"; eventId: string }>
  | Readonly<{ type: "CONTINUE_EXPLORATION" }>
  | Readonly<{ type: "EAT_FOOD"; itemId: string }>
