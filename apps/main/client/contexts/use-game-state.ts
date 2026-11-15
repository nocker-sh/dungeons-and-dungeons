import { useSyncExternalStore } from "react"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { useGame } from "@/client/contexts/use-game"

/** エンジンの状態を購読する。React側に状態の複製は持たない。 */
export function useGameState(): GameState {
  const game = useGame()
  return useSyncExternalStore(
    game.subscribe,
    () => game.getSnapshot().state,
    () => game.getSnapshot().state
  )
}
