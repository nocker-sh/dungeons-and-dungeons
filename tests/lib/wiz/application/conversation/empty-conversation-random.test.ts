import { expect, it, vi } from "vite-plus/test"
import { SeededRandom } from "@/builder/lib/random"
import { conversationScenario } from "@/development/conversations/scenario"
import { ConversationRules } from "@/lib/wiz/conversations/conversation-rules"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { realContent } from "@/lib/wiz/testing/real-content"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import { sequentialIds } from "@/lib/wiz/testing/sequential-ids"

const definition = new GameDefinition(realContent())
const rules = new ConversationRules(definition.catalog)
const cases = (
  ["inn", "talk", "visit", "branch", "chest", "item"] as const
).flatMap((trigger) => {
  // Hero-only ownership and the phase are explicit local conditions, not a claimed story route.
  const state = conversationScenario(definition, {
    owned: [],
    party: [],
    demons: [],
    reached: 0,
    cleared: false,
    trigger,
    seen: [],
  })
  const subjects =
    trigger === "talk"
      ? (definition.catalog.data.conversationResidents ?? []).map(
          (resident) => ({ resident })
        )
      : trigger === "visit"
        ? (definition.catalog.data.conversationPlaces ?? []).map((place) => ({
            place,
          }))
        : [{}]
  return subjects.flatMap((subject) =>
    rules.canStart(state, trigger, subject) &&
    rules.available(state, trigger, subject).length === 0
      ? [
          {
            state,
            trigger,
            subject,
            name: `${trigger}:${JSON.stringify(subject)}`,
          },
        ]
      : []
  )
})

it("canonical content provides eligible empty-candidate rejection cases", () => {
  expect(cases.length).toBeGreaterThan(0)
})

it.each(cases)(
  "$name: rejection keeps state, IDs and the next random draw unchanged",
  ({ state, trigger, subject }) => {
    const random = new SeededRandom(41)
    const ids = vi.fn(sequentialIds())
    const game = definition.create(
      testEnvironment({ random: random.next, ids }),
      state
    )
    const before = game.save()
    const stream = random.state
    const allocations = ids.mock.calls.length
    const untouched = new SeededRandom(stream)
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(
        game.send({ type: "start-conversation", trigger, ...subject })
      ).toMatchObject({ code: "NOT_READY" })
      expect(game.save()).toEqual(before)
      expect(random.state).toBe(stream)
      expect(ids.mock.calls).toHaveLength(allocations)
    }
    expect(random.next()).toBe(untouched.next())
  }
)
