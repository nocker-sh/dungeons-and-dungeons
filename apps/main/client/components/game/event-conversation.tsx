import { useGame } from "@/client/contexts/use-game"
import { useGameState } from "@/client/contexts/use-game-state"
import { EventConversationScene } from "@/client/components/game/event-conversation-scene"

/** 通常プレイと dev 再生の共通表示。 */
export function EventConversation() {
  const game = useGame()
  const state = useGameState()
  const script = game.queries.activeConversation(state)
  return script ? <EventConversationScene key={script.id} /> : null
}
