import { createContext, useContext, useEffect } from "react"
import { useGame } from "@/client/contexts/use-game"
import { playEventConversation } from "@/client/components/game/play-event-conversation"

/** 場所に入ったときの場面を流すか。プレビューでは既定で止める。 */
export const VisitScenesContext = createContext(true)

/** 場所に着いたら、その場所の場面を再生する。条件と確率は Game が判定する。 */
export function useVisitScene(place: string, ready: boolean) {
  const game = useGame()
  const enabled = useContext(VisitScenesContext)
  useEffect(() => {
    if (!ready || !enabled) return
    const controller = new AbortController()
    void playEventConversation(game, "visit", controller.signal, { place })
    return () => controller.abort()
  }, [game, place, ready, enabled])
}
