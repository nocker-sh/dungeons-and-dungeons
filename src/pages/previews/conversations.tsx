import { Stage } from "@/components/stage/stage"
import { EventConversationView } from "@/components/game/event-conversation"
import { seededEnvironment } from "@/lib/game-client/seeded-environment"
import type { Screen } from "@/lib/game-client/navigation"
import { useState } from "react"
import { GameApp } from "@/components/game/game-app"
import { GameDefinition } from "@/lib/wiz"
import { gameContent } from "@/lib/content/game-content"
import { conversationScenario } from "@/lib/dev/conversations/scenario"
import { ConversationRules } from "@/lib/wiz/conversations/conversation-rules"

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

function ConditionalConversationFrame() {
  const [preview] = useState(() => {
    try {
      const key = new URLSearchParams(location.search).get("key") ?? ""
      const payload = JSON.parse(sessionStorage.getItem(key) ?? "null")
      if (!payload) return { error: "会話デバッグ画面から再生してください。" }
      const content = { ...gameContent, conversations: payload.conversations }
      const definition = new GameDefinition(content)
      const state = conversationScenario(definition, payload.scenario)
      const script = definition.catalog.data.conversations?.find(
        (entry) => entry.id === payload.id
      )
      if (!script) return { error: "台本が見つかりません。" }
      const rules = new ConversationRules(definition.catalog)
      const subject = {
        resident: script.participants[0],
        place: script.place,
      }
      if (
        !rules.canStart(state, script.trigger, subject) ||
        rules.reasons(state, script.trigger, script, subject).length
      )
        return { error: "現在の条件では再生できません。" }
      const screen: Screen =
        script.trigger === "inn"
          ? { name: "room", room: definition.catalog.data.rooms[0].id }
          : script.trigger === "talk" || script.trigger === "visit"
            ? { name: "town" }
            : { name: "expedition" }
      return {
        start: {
          content,
          initialState: {
            ...state,
            conversation: { ...state.conversation!, active: script.id },
          },
          screen,
          environment: seededEnvironment(
            Number.isInteger(payload.seed) ? payload.seed : 1
          ),
        },
      }
    } catch (error) {
      return { error: String(error) }
    }
  })
  return preview.start ? (
    <GameApp preview={preview.start} />
  ) : (
    <p role="alert">{preview.error}</p>
  )
}
