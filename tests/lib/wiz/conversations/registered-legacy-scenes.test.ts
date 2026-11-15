import { expect, it } from "vite-plus/test"
import { ConversationRules } from "@/lib/wiz/conversations/conversation-rules"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { aState } from "@/lib/wiz/testing/state-builder"
import { realContent } from "@/lib/wiz/testing/real-content"
import { catalogOf } from "@/lib/wiz/testing/catalog-of"

const definition = new GameDefinition(catalogOf(realContent()))
const rules = new ConversationRules(definition.catalog)
const arrival = definition.catalog.data.conversations!.find(
  (entry) => entry.id === "first-job-way-home"
)!

it("登録の印を付ける前の版で登録した保存では、登録前だけの到着の場面を流さない", () => {
  // 登録済みで、会話の印（hero:registered）を持たない旧保存
  const legacy = aState().build()
  expect(legacy.hero.registrationPending).not.toBe(true)
  expect(legacy.conversation?.flags ?? []).not.toContain("hero:registered")
  const ids = rules
    .available(legacy, "visit", { place: arrival.place })
    .map((entry) => entry.id)
  expect(ids).not.toContain(arrival.id)
})

it("登録前の保存では、到着の場面をいつもどおり流す", () => {
  const base = aState().build()
  const unregistered = {
    ...base,
    hero: { ...base.hero, registrationPending: true },
  }
  const ids = rules
    .available(unregistered, "visit", { place: arrival.place })
    .map((entry) => entry.id)
  expect(ids).toContain(arrival.id)
})
