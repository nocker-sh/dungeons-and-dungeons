import type { WizEngineBattleTurnAction } from "@/lib/wiz/core/engine/battle/turn-action"
import type { WizEngineBattleTurnIntent } from "@/lib/wiz/core/engine/battle/turn-intent"

export type WizSceneBattleAction =
  | Readonly<{ type: "BATTLE_START" }>
  | Readonly<{ type: "BATTLE_FLEE" }>
  | Readonly<{ type: "BATTLE_EXECUTE_INTENT"; intent: WizEngineBattleTurnIntent }>
  | Readonly<{ type: "BATTLE_EXECUTE_ACTION"; action: WizEngineBattleTurnAction }>
  | Readonly<{ type: "BATTLE_EXECUTE_ENEMY_TURN" }>
  | Readonly<{ type: "BATTLE_END" }>
