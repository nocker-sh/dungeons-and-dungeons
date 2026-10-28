import { createContext } from "react"
import type { ReactNode } from "react"
import type { Game } from "@/lib/wiz/game/game"

export const GameContext = createContext<Game | null>(null)

/** エンジンを注入する。画面はここからコマンドを送り、状態を購読する。 */
export type Props = {
  game: Game
  children: ReactNode
}

export function GameProvider(props: Props) {
  return (
    <GameContext.Provider value={props.game}>
      {props.children}
    </GameContext.Provider>
  )
}
