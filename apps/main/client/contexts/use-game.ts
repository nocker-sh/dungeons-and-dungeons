import { useContext } from "react"
import { GameContext } from "@/client/contexts/game-provider"

export function useGame() {
  const game = useContext(GameContext)
  if (!game) throw new Error("useGame must be used inside <GameProvider>")
  return game
}
