import { describe, expect, it } from "vite-plus/test"
import { GameCommandError, GameDefinition } from "@/lib/wiz"
import {
  contentId,
  eventsOrThrow,
  realContent,
  testEnvironment,
} from "@/lib/wiz/testing"
import { Bag } from "@/lib/wiz/rules/bag"

function play(
  options: {
    reached?: number
    gold?: number
    apple?: number
    stones?: number
  } = {}
) {
  const definition = new GameDefinition(realContent())
  const initial = definition.initialState()
  const game = definition.create(testEnvironment({ random: 0 }), {
    ...initial,
    hero: { ...initial.hero, registrationPending: false },
    phase: { type: "town" },
    reached: options.reached ?? 0,
    gold: options.gold ?? 1000,
    stones: options.stones ?? 3,
    bag: [
      { good: contentId("golden-apple"), count: options.apple ?? 2 },
      { good: contentId("contract-paper-nui"), count: 1 },
      { good: contentId("contract-paper-zaza"), count: 1 },
    ].filter((entry) => entry.count > 0),
  })
  return { game, definition }
}
function meet(game: ReturnType<typeof play>["game"], slug = "nui") {
  eventsOrThrow(
    game.send({
      type: "invoke-demon",
      demon: contentId(slug),
    })
  )
  expect(game.state.conversation?.active).toBe(`${slug}-encounter`)
  eventsOrThrow(game.send({ type: "finish-conversation", choice: 0 }))
}

describe("物語で出会う悪魔", () => {
  it("[feature:W040] 出会いを読んでから、指定した相手へ素材と契約料を一度だけ払う", () => {
    const { game } = play()
    const before = game.save()
    expect(
      (
        game.send({
          type: "contract-demon",
          demon: contentId("nui"),
        }) as GameCommandError
      ).code
    ).toBe("NOT_READY")
    expect(game.save()).toEqual(before)
    meet(game)
    const met = game.state
    eventsOrThrow(
      game.send({ type: "contract-demon", demon: contentId("nui") })
    )
    expect(game.state.gold).toBe(met.gold - 100)
    expect(game.state.stones).toBe(met.stones)
    expect(Bag.count(game.state.bag, contentId("golden-apple"))).toBe(1)
    expect(game.state.demons.map((demon) => demon.id)).toEqual([
      contentId("lox"),
      contentId("nui"),
    ])
    expect(game.state.contract).toBe(contentId("lox"))
    const contracted = game.save()
    expect(
      (
        game.send({
          type: "contract-demon",
          demon: contentId("nui"),
        }) as GameCommandError
      ).code
    ).toBe("ALREADY")
    expect(game.save()).toEqual(contracted)
    expect(game.restore(JSON.parse(JSON.stringify(contracted)))).toBeUndefined()
    expect(game.save()).toEqual(contracted)
  })
  it.each([
    { gold: 99, expected: "NO_GOLD" },
    { apple: 0, expected: "NO_MATERIALS" },
  ])("不足した契約は一切消費しない：$expected", ({ expected, ...options }) => {
    const { game } = play(options)
    meet(game)
    const saved = game.save()
    expect(
      (
        game.send({
          type: "contract-demon",
          demon: contentId("nui"),
        }) as GameCommandError
      ).code
    ).toBe(expected)
    expect(game.save()).toEqual(saved)
    expect(
      game.queries
        .demonContracts(game.state)
        .find((entry) => entry.id === contentId("nui"))?.canContract
    ).toBe(false)
  })
  it("進行前と友達未加入では呼び出さず、契約前の再会では要求を確認できる", () => {
    const { game } = play()
    expect(
      game.send({
        type: "start-conversation",
        trigger: "talk",
        resident: contentId("tris"),
      })
    ).toBeInstanceOf(GameCommandError)
    const { game: later } = play({ reached: 2 })
    expect(
      later.send({
        type: "start-conversation",
        trigger: "talk",
        resident: contentId("zaza"),
      })
    ).toBeInstanceOf(GameCommandError)
    meet(later)
    eventsOrThrow(later.send({ type: "invoke-demon", demon: contentId("nui") }))
    expect(later.state.conversation?.active).toBe("nui-encounter")
    eventsOrThrow(later.send({ type: "finish-conversation", choice: 0 }))
    eventsOrThrow(
      later.send({ type: "contract-demon", demon: contentId("nui") })
    )
    meet(later, "zaza")
    expect(later.state.conversation?.seen).toContain("zaza-encounter")
  })
  it("会話で親しくなり、同じ話を繰り返しても増えない。返答の好悪では差をつけない", () => {
    const { game, definition } = play()
    meet(game)
    eventsOrThrow(
      game.send({ type: "contract-demon", demon: contentId("nui") })
    )
    for (let index = 0; index < 12; index++) {
      eventsOrThrow(
        game.send({
          type: "start-conversation",
          trigger: "talk",
          resident: contentId("nui"),
        })
      )
      eventsOrThrow(game.send({ type: "finish-conversation" }))
    }
    const view = game.queries
      .demons(game.state)
      .find((entry) => entry.id === contentId("nui"))!
    expect(view.bond.count).toBe(12)
    expect(view.bond.label).toBe("大切な相棒")
    expect(view.lv).toBe(1)
    const complete = definition.create(testEnvironment(), {
      ...game.state,
      conversation: { ...game.state.conversation!, active: "nui-talk-01" },
    })
    eventsOrThrow(complete.send({ type: "finish-conversation" }))
    expect(
      complete.queries
        .demons(complete.state)
        .find((entry) => entry.id === contentId("nui"))!.bond.count
    ).toBe(12)
    expect(complete.state.demons).toEqual(game.state.demons)
    const dialogue = definition.catalog.data.conversations!.find(
      (entry) => entry.id === "nui-bond-1"
    )!
    expect(dialogue.choice!.options.map((entry) => entry.sets)).toEqual([
      [],
      [],
    ])
  })
  it("友達の共同会話はどちらへの話しかけでも出て、二人とも親しさを一度だけ得る", () => {
    const { game, definition } = play({ reached: 2 })
    const initial = {
      ...game.state,
      demons: [
        ...game.state.demons,
        { id: contentId("nui"), lv: 1, exp: 0 },
        { id: contentId("zaza"), lv: 1, exp: 0 },
      ],
      conversation: { seen: [], last: null, active: null },
    }
    for (const slug of ["nui", "zaza"]) {
      const inspect = definition.create(testEnvironment(), initial)
      const available = inspect.queries.conversations(inspect.state, "talk", {
        resident: contentId(slug),
      })
      expect(
        available.find(
          (entry) => entry.conversation.id === "nui-zaza-friends-1"
        )!.reasons
      ).toEqual([])
    }
    const paired = definition.create(testEnvironment(), {
      ...initial,
      conversation: { ...initial.conversation, active: "nui-zaza-friends-1" },
    })
    eventsOrThrow(paired.send({ type: "finish-conversation" }))
    for (const slug of ["nui", "zaza"])
      expect(
        paired.queries
          .demons(paired.state)
          .find((entry) => entry.id === contentId(slug))!.bond.count
      ).toBe(1)
    const saved = paired.save()
    expect(paired.restore(JSON.parse(JSON.stringify(saved)))).toBeUndefined()
    expect(
      paired.state.conversation?.seen.filter(
        (id) => id === "nui-zaza-friends-1"
      )
    ).toHaveLength(1)
  })
})
