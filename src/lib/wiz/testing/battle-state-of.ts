import type { Battle, GameState } from "@/lib/wiz/state"

/** 戦闘中の状態から戦闘の中身を取り出す。戦闘でなければ投げる。 */
export function battleStateOf(state: GameState): Battle {
  if (state.phase.type !== "battle")
    throw new Error(`not in battle: ${state.phase.type}`)
  return state.phase.battle
}
