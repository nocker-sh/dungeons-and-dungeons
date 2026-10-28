import { Stage } from "@/client/components/stage/stage"
import { EventConversationView } from "@/client/components/game/event-conversation-view"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { gameContent } from "@/content/game-content"
import { ConditionalConversationFrame } from "@/pages/previews/conditional-conversation-frame"

export default function ConversationFrame() {
  const parameters = new URLSearchParams(location.search)
  const script = new GameDefinition(
    gameContent
  ).catalog.data.conversations?.find(
    (entry) => entry.id === parameters.get("id")
  )
  if (script) {
    const requestedLine = Number(parameters.get("line") ?? 0)
    const initialLine = Number.isInteger(requestedLine)
      ? Math.max(0, Math.min(script.lines.length - 1, requestedLine))
      : 0
    return (
      <Stage formation={null}>
        <EventConversationView
          script={script}
          initialLine={initialLine}
          onLine={(line) =>
            parent.postMessage(
              { type: "conversation-line", id: script.id, line },
              location.origin
            )
          }
          onDone={() =>
            parent.postMessage(
              { type: "conversation-done", id: script.id },
              location.origin
            )
          }
        />
      </Stage>
    )
  }
  return <ConditionalConversationFrame />
}
