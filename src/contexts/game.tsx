import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import type { Game, GameState } from "@/lib/wiz"

const GameContext = createContext<Game | null>(null)

/** エンジンを注入する。画面はここからコマンドを送り、状態を購読する。 */
export function GameProvider({
  game,
  children,
}: {
  game: Game
  children: ReactNode
}) {
  return <GameContext.Provider value={game}>{children}</GameContext.Provider>
}

export function useGame() {
  const game = useContext(GameContext)
  if (!game) throw new Error("useGame must be used inside <GameProvider>")
  return game
}

/** エンジンの状態を購読する。React側に状態の複製は持たない。 */
export function useGameState(): GameState {
  const game = useGame()
  return useSyncExternalStore(
    game.subscribe,
    () => game.getSnapshot().state,
    () => game.getSnapshot().state
  )
}
