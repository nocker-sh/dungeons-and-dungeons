import { describe, expect, it } from "vite-plus/test"
import { nightTalks } from "@/content/looks/night-talks"
import { portraitStates } from "@/concept/portrait-types"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { realContent } from "@/lib/wiz/testing/real-content"
import { startedState } from "@/lib/wiz/testing/started-state"

describe("夜の雑談", () => {
  it("初期の3人で二人雑談ができ、選んだ仲間だけに一晩一度の親しさが付く", () => {
    const definition = new GameDefinition(realContent())
    const state = startedState(definition)
    const talks = nightTalks().filter((talk) =>
      talk.pair.every((id) => state.party.includes(id))
    )
    expect(talks.length).toBeGreaterThan(0)
    for (const talk of talks)
      for (const [, liked] of talk.choice.options) {
        const game = createTestGame({ state })
        const room = definition.catalog.data.rooms.find(
          (room) => room.price === 0
        )!
        eventsOrThrow(game.send({ type: "rest", room: room.id }))
        const before = game.save()
        expect(game.queries.canChatWith(game.state, liked)).toBe(true)
        eventsOrThrow(game.send({ type: "chat", liked }))
        for (const member of game.state.members)
          expect(member.like).toBe(
            before.snapshot.members.find((entry) => entry.id === member.id)!
              .like + (member.id === liked ? 1 : 0)
          )
        const chatted = game.save()
        expect(game.send({ type: "chat", liked })).toBeInstanceOf(
          GameCommandError
        )
        expect(game.save()).toEqual(chatted)
        expect(game.restore(chatted)).toBeUndefined()
        expect(game.queries.canChatWith(game.state, liked)).toBe(false)
        eventsOrThrow(game.send({ type: "rest", room: room.id }))
        expect(game.queries.canChatWith(game.state, liked)).toBe(true)
      }
  })

  it("名前の置換で台詞と返答の表情が失われない", () => {
    const talks = nightTalks()
    expect(talks.length).toBeGreaterThan(0)
    const expressions = portraitStates.map(({ value }) => value)
    for (const talk of talks) {
      for (const [, text, expression] of talk.lines) {
        expect(text).not.toMatch(/\{[\w-]+\}/)
        expect(expressions).toContain(expression)
      }
      for (const [label, , reply, expression] of talk.choice.options) {
        expect(label).not.toMatch(/\{[\w-]+\}/)
        expect(reply).not.toMatch(/\{[\w-]+\}/)
        expect(expressions).toContain(expression)
      }
    }
    expect(talks[0].choice.options[1][3]).toBe("shy")
  })
})
