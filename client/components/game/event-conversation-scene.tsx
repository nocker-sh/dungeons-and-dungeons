import { inPhase } from "@/lib/wiz/phases/in-phase"
import { useGame } from "@/client/contexts/use-game"
import { useGameState } from "@/client/contexts/use-game-state"
import { EventConversationView } from "@/client/components/game/event-conversation-view"

export function EventConversationScene() {
  const game = useGame()
  const state = useGameState()
  const script = game.queries.activeConversation(state)!
  return (
    <EventConversationView
      script={script}
      onDone={(picked) => {
        inPhase(game, "conversation")?.finish(picked < 0 ? undefined : picked)
      }}
    />
  )
}
