import type { GameState } from "@/lib/wiz/state/state-schema"

/** 戦闘中のフェーズ（探索と戦闘の両方を持つ）。 */
export type BattlePhase = Extract<GameState["phase"], { type: "battle" }>
