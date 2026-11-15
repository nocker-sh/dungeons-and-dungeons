import { seededEnvironment } from "@/development/seeded-environment"
import type { Screen } from "@/client/game/navigation"
import { useState } from "react"
import { GameApp } from "@/client/components/game/game-app"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { gameContent } from "@/content/game-content"
import { conversationScenario } from "@/development/conversations/scenario"
import { ConversationRules } from "@/lib/wiz/conversations/conversation-rules"

export function ConditionalConversationFrame() {
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
