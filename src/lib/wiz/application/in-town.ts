import type { GameState } from "@/lib/wiz/state"

/** 街にいるか。街だけでできる操作はここで先に確かめる。 */
export function inTown(state: GameState) {
  return state.phase.type === "town"
}
