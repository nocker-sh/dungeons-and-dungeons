import { describe, expect, it } from "vitest"
import { GameDefinition, gameEnvironment } from "@/lib/wiz/definition"
import { realContent } from "@/lib/wiz/testing/real-content"
import { conversationScenario } from "@/lib/dev/conversations/scenario"
import { ConversationRules } from "./conversation-rules"

const residents = realContent().conversationResidents!
const places = realContent().conversationPlaces!
const [milena, lloyd] = residents
const [town, guild] = places
const line = (speaker: string, text = "テスト") => ({
  speaker,
  text,
  expression: "talk" as const,
})
const fixtures = [
  {
    id: "milena-first",
    title: "話す：最初",
    trigger: "talk" as const,
    participants: [milena],
    sets: ["test:met"],
    lines: [line(milena)],
    choice: {
      ask: "どうする？",
      options: [
        { label: "飲む", lines: [line(milena)], sets: ["test:drank"] },
        { label: "やめる", lines: [line(milena)] },
      ],
    },
  },
  {
    id: "milena-after",
    title: "話す：続き",
    trigger: "talk" as const,
    participants: [milena],
    requires: ["test:met"],
    excludes: ["test:drank"],
    lines: [line(milena)],
  },
  {
    id: "lloyd-night",
    title: "話す：夜",
    trigger: "talk" as const,
    participants: [lloyd],
    minimumNights: 3,
    lines: [line(lloyd)],
  },
  {
    id: "visit-guild-lloyd",
    title: "ギルド：ロイドが飲んでいる",
    trigger: "visit" as const,
    place: guild,
    chance: 0.5,
    once: true,
    participants: [lloyd, milena],
    requires: ["test:met"],
    lines: [line(lloyd), line(milena)],
  },
]
const content = {
  ...realContent(),
  demons: realContent().demons.map(
    ({ contract: _contract, ...demon }) => demon
  ),
  conversations: fixtures,
}
const definition = new GameDefinition(content)
const rules = new ConversationRules(definition.catalog)
const townState = (flags: string[] = [], nights = 1) =>
  conversationScenario(definition, {
    owned: [],
    party: [],
    demons: [],
    reached: 0,
    cleared: false,
    trigger: "talk",
    seen: [],
    flags,
    nights,
  })

describe("住人との会話と場所の場面", () => {
  it("話しかけた住人の台本だけを候補にし、フラグと夜の数で出し分ける", () => {
    expect(
      rules
        .available(townState(), "talk", { resident: milena })
        .map((e) => e.id)
    ).toEqual(["milena-first"])
    expect(
      rules
        .available(townState(["test:met"]), "talk", { resident: milena })
        .map((e) => e.id)
    ).toEqual(["milena-first", "milena-after"])
    expect(
      rules
        .available(townState(["test:met", "test:drank"]), "talk", {
          resident: milena,
        })
        .map((e) => e.id)
    ).toEqual(["milena-first"])
    expect(rules.available(townState(), "talk", { resident: lloyd })).toEqual(
      []
    )
    expect(
      rules.available(townState([], 3), "talk", { resident: lloyd }).length
    ).toBe(1)
  })
  it("街の場面は街でだけ、登録された住人と場所だけで始まる", () => {
    const state = townState()
    expect(rules.canStart(state, "talk", { resident: milena })).toBe(true)
    expect(rules.canStart(state, "talk", { resident: "nobody" })).toBe(false)
    expect(rules.canStart(state, "visit", { place: guild })).toBe(true)
    expect(rules.canStart(state, "visit", { place: "nowhere" })).toBe(false)
    expect(
      rules.canStart(
        { ...state, hero: { ...state.hero, registrationPending: true } },
        "talk",
        { resident: milena }
      )
    ).toBe(false)
  })
  it("場所の場面は場所が合い、確率に当たったときだけ選ばれる", () => {
    const state = townState(["test:met"])
    expect(rules.select(state, "visit", () => 0.9, { place: guild })).toBe(null)
    expect(rules.select(state, "visit", () => 0.1, { place: guild })?.id).toBe(
      "visit-guild-lloyd"
    )
    expect(rules.select(state, "visit", () => 0.1, { place: town })).toBe(null)
  })
  it("[feature:W032] 見終えたらフラグを立て、選んだ答えのフラグも足す", () => {
    const game = definition.create(
      gameEnvironment({ random: () => 0 }),
      townState()
    )
    expect(
      Array.isArray(
        game.send({
          type: "start-conversation",
          trigger: "talk",
          resident: milena,
        })
      )
    ).toBe(true)
    const before = game.state
    expect(
      Array.isArray(game.send({ type: "finish-conversation", choice: 5 }))
    ).toBe(false)
    expect(game.state).toBe(before)
    expect(
      Array.isArray(game.send({ type: "finish-conversation", choice: 0 }))
    ).toBe(true)
    expect(game.state.conversation?.flags).toEqual(["test:met", "test:drank"])
    expect(game.state.gold).toBe(before.gold)
    const saved = game.save()
    const loaded = definition.create()
    expect(loaded.restore(saved)).toBeUndefined()
    expect(loaded.state.conversation?.flags).toEqual(["test:met", "test:drank"])
  })
  it("場所に入ると場面が始まり、一度きりの場面は二度と出ない", () => {
    const game = definition.create(
      gameEnvironment({ random: () => 0 }),
      townState(["test:met"])
    )
    expect(
      Array.isArray(
        game.send({
          type: "start-conversation",
          trigger: "visit",
          place: guild,
        })
      )
    ).toBe(true)
    expect(game.state.conversation?.active).toBe("visit-guild-lloyd")
    const loaded = definition.create()
    expect(loaded.restore(game.save())).toBeUndefined()
    game.send({ type: "finish-conversation" })
    expect(
      Array.isArray(
        game.send({
          type: "start-conversation",
          trigger: "visit",
          place: guild,
        })
      )
    ).toBe(false)
  })
  it("同じ場所の場面は宿の一晩に一度まで", () => {
    const repeatable = {
      ...fixtures[3],
      id: "visit-guild-daily",
      once: false,
      chance: undefined,
      requires: [],
    }
    const daily = new GameDefinition({
      ...content,
      conversations: [fixtures[0], repeatable],
    })
    const state = conversationScenario(daily, {
      owned: [],
      party: [],
      demons: [],
      reached: 0,
      cleared: false,
      trigger: "visit",
      seen: [],
    })
    const game = daily.create(gameEnvironment({ random: () => 0 }), state)
    const enter = () =>
      Array.isArray(
        game.send({
          type: "start-conversation",
          trigger: "visit",
          place: guild,
        })
      )
    expect(enter()).toBe(true)
    game.send({ type: "finish-conversation" })
    expect(enter()).toBe(false)
    const nextNight = daily.create(gameEnvironment({ random: () => 0 }), {
      ...game.state,
      nights: game.state.nights + 1,
    })
    expect(
      Array.isArray(
        nextNight.send({
          type: "start-conversation",
          trigger: "visit",
          place: guild,
        })
      )
    ).toBe(true)
  })
  it("立てる会話のないフラグ、場所のない場面、探索での住人を起動時に拒否", () => {
    const [first, after, , visit] = fixtures
    expect(
      () =>
        new GameDefinition({
          ...realContent(),
          conversations: [after],
        })
    ).toThrow("立てる会話がない")
    expect(
      () =>
        new GameDefinition({
          ...realContent(),
          conversations: [first, { ...visit, place: undefined }],
        })
    ).toThrow("場所は入ったときの場面だけ")
    expect(
      () =>
        new GameDefinition({
          ...realContent(),
          conversations: [{ ...first, trigger: "chest" }],
        })
    ).toThrow("住人は探索に同行しない")
  })
})
