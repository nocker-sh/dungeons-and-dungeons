import { describe, expect, it } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import { Bag } from "@/lib/wiz/rules/bag"

function journey(reached = 1) {
  const definition = new GameDefinition(realContent())
  const initial = definition.initialState()
  const game = definition.create(testEnvironment({ random: 0 }), {
    ...initial,
    hero: { ...initial.hero, registrationPending: false },
    phase: { type: "town" },
    reached,
    gold: 500,
    bag: [],
  })
  return { game, definition }
}
function move(game: ReturnType<typeof journey>["game"], tile: string) {
  eventsOrThrow(game.send({ type: "move-world", tile }))
}
function finish(game: ReturnType<typeof journey>["game"]) {
  eventsOrThrow(
    game.send({
      type: "finish-conversation",
      ...(game.queries.activeConversation(game.state)?.choice
        ? { choice: 0 }
        : {}),
    })
  )
}

describe("村・契約書・別のバイオームの約束", () => {
  it("[feature:W009] 一度だけの契約書と約束の品は売却できず、加入の道を失わない", () => {
    const { game } = journey()
    const save = game.save()
    const goods = [
      "contract-paper-nui",
      "contract-paper-tris",
      "contract-paper-haro",
      "contract-paper-zaza",
      "golden-apple",
      "wetland-flower",
    ]
    expect(
      game.restore({
        ...save,
        snapshot: {
          ...save.snapshot,
          bag: goods.map((good) => ({ good, count: 1 })),
        },
      })
    ).toBeUndefined()
    const before = game.save()
    for (const good of goods) {
      expect(game.send({ type: "sell", good })).toBeInstanceOf(GameCommandError)
      expect(game.save()).toEqual(before)
      expect(
        game.queries.sellables(game.state).some((entry) => entry.id === good)
      ).toBe(false)
    }
  })

  it("[feature:W043] 初期三人がいない既存保存でも、ロクスと村で情報を聞いて道を開ける", () => {
    const { game } = journey()
    const save = game.save()
    const hero = game.state.party[0]
    expect(
      game.restore({
        ...save,
        snapshot: {
          ...save.snapshot,
          members: save.snapshot.members.filter((member) => member.id === hero),
          party: [hero],
          gear: [],
        },
      })
    ).toBeUndefined()
    move(game, "world-road")
    move(game, "world-village")
    eventsOrThrow(game.send({ type: "visit-world" }))
    expect(game.state.conversation?.active).toBe("world-village-directions-lox")
    finish(game)
    expect(game.state.conversation?.flags).toContain("world:forest-path")
    move(game, "world-forest-road")
    expect(game.state.journey?.at).toBe("world-forest-road")
  })

  it("[feature:W041] 0層突破前・斜め・非隣接・未知の道は移動できず、資産も位置も変えない", () => {
    for (const [reached, tile] of [
      [0, "world-road"],
      [1, "world-village"],
      [1, "world-mountain"],
    ] as const) {
      const { game } = journey(reached)
      const before = game.save()
      expect(game.send({ type: "move-world", tile })).toBeInstanceOf(
        GameCommandError
      )
      expect(game.save()).toEqual(before)
    }
    const { game } = journey()
    move(game, "world-road")
    move(game, "world-village")
    expect(
      game.queries
        .worldMap(game.state)!
        .tiles.find((tile) => tile.id === "world-orchard")!.visible
    ).toBe(false)
    expect(
      game.send({ type: "move-world", tile: "world-forest-road" })
    ).toBeInstanceOf(GameCommandError)
  })
  it("[feature:W043] 村の情報で道を表示し、一度だけ契約書を受け取って別のバイオームへ採集に行く", () => {
    const { game } = journey()
    move(game, "world-road")
    move(game, "world-village")
    eventsOrThrow(game.send({ type: "visit-world" }))
    expect(game.state.conversation?.active).toBe("world-village-directions")
    expect(Bag.count(game.state.bag, contentId("contract-paper-nui"))).toBe(1)
    const protectedSave = game.save()
    expect(
      game.send({ type: "sell", good: contentId("contract-paper-nui") })
    ).toBeInstanceOf(GameCommandError)
    expect(game.save()).toEqual(protectedSave)
    expect(
      game.queries
        .sellables(game.state)
        .some((entry) => entry.id === contentId("contract-paper-nui"))
    ).toBe(false)
    expect(
      game.send({ type: "move-world", tile: "world-north-road" })
    ).toBeInstanceOf(GameCommandError)
    finish(game)
    expect(
      game.queries
        .worldMap(game.state)!
        .tiles.find((tile) => tile.id === "world-orchard")!.visible
    ).toBe(true)
    move(game, "world-forest-road")
    move(game, "world-orchard")
    eventsOrThrow(game.send({ type: "visit-world" }))
    expect(Bag.count(game.state.bag, contentId("golden-apple"))).toBe(1)
    const before = game.save()
    expect(game.send({ type: "visit-world" })).toBeInstanceOf(GameCommandError)
    expect(game.save()).toEqual(before)
  })
  it("[feature:W042] 初訪問は歩き、訪れた拠点だけへ移動する。保存・再開でも位置と採集済みを保つ", () => {
    const { game } = journey()
    expect(
      game.send({ type: "travel-world", tile: "world-village" })
    ).toBeInstanceOf(GameCommandError)
    move(game, "world-road")
    move(game, "world-village")
    eventsOrThrow(game.send({ type: "visit-world" }))
    finish(game)
    eventsOrThrow(game.send({ type: "travel-world", tile: "world-town" }))
    eventsOrThrow(game.send({ type: "travel-world", tile: "world-village" }))
    const before = game.save()
    expect(game.restore(JSON.parse(JSON.stringify(before)))).toBeUndefined()
    expect(game.save()).toEqual(before)
    expect(Bag.count(game.state.bag, contentId("contract-paper-nui"))).toBe(1)
    expect(game.send({ type: "visit-world" })).toBeInstanceOf(GameCommandError)
    expect(game.save()).toEqual(before)
  })
  it("[feature:W044] 契約書の呼び出しで要求を聞く。再会は無料、品と契約料は加入時だけ払う", () => {
    const { game } = journey()
    const before = game.save()
    expect(
      game.send({ type: "invoke-demon", demon: contentId("nui") })
    ).toBeInstanceOf(GameCommandError)
    expect(game.save()).toEqual(before)
    move(game, "world-road")
    move(game, "world-village")
    eventsOrThrow(game.send({ type: "visit-world" }))
    finish(game)
    eventsOrThrow(game.send({ type: "invoke-demon", demon: contentId("nui") }))
    expect(game.state.conversation?.active).toBe("nui-encounter")
    expect(Bag.count(game.state.bag, contentId("contract-paper-nui"))).toBe(0)
    expect(
      game.queries
        .activeConversation(game.state)!
        .lines.some((line) => line.text.includes("金のリンゴ"))
    ).toBe(true)
    finish(game)
    expect(
      game.queries.worldMap(game.state)!.requests[0].materials[0].locations[0]
        .tile
    ).toBe("world-orchard")
    expect(
      game.send({ type: "contract-demon", demon: contentId("nui") })
    ).toBeInstanceOf(GameCommandError)
    const bag = game.state.bag
    const gold = game.state.gold
    eventsOrThrow(game.send({ type: "invoke-demon", demon: contentId("nui") }))
    finish(game)
    expect(game.state.bag).toEqual(bag)
    expect(game.state.gold).toBe(gold)
    move(game, "world-forest-road")
    move(game, "world-orchard")
    eventsOrThrow(game.send({ type: "visit-world" }))
    eventsOrThrow(game.send({ type: "travel-world", tile: "world-town" }))
    eventsOrThrow(
      game.send({ type: "contract-demon", demon: contentId("nui") })
    )
    expect(game.state.gold).toBe(400)
    expect(Bag.count(game.state.bag, contentId("golden-apple"))).toBe(0)
    expect(game.state.contract).toBe(contentId("lox"))
    const contracted = game.save()
    expect(
      game.send({ type: "contract-demon", demon: contentId("nui") })
    ).toBeInstanceOf(GameCommandError)
    expect(game.save()).toEqual(contracted)
  })
  it.each([
    { condition: "ready", ready: true },
    { condition: "called", ready: true },
    { condition: "seen", ready: true },
    { condition: "no-paper", ready: false },
    { condition: "registration", ready: false },
    { condition: "conversation", ready: false },
    { condition: "creating", ready: false },
    { condition: "owned", ready: false },
  ] as const)(
    "呼び出しの表示と実行が一致し、試算は状態を変えない：$condition",
    ({ condition, ready }) => {
      const { game: base, definition } = journey()
      const state = base.state
      const demon = contentId("nui")
      const paper = contentId("contract-paper-nui")
      const free = condition === "called" || condition === "seen"
      const game = definition.create(testEnvironment({ random: 0 }), {
        ...state,
        phase: { type: condition === "creating" ? "creating" : "town" },
        hero: {
          ...state.hero,
          registrationPending: condition === "registration",
        },
        bag:
          free || condition === "no-paper" ? [] : [{ good: paper, count: 1 }],
        demons:
          condition === "owned"
            ? [...state.demons, { id: demon, lv: 1, exp: 0 }]
            : state.demons,
        conversation: {
          seen: condition === "seen" ? ["nui-encounter"] : [],
          last: null,
          active: condition === "conversation" ? "nui-encounter" : null,
          flags:
            condition === "called" || condition === "conversation"
              ? [`demon-called:${demon}`]
              : [],
        },
      })
      const before = game.save()
      const offered =
        game.queries
          .demonContracts(game.state)
          .find((entry) => entry.id === demon)?.canInvoke ?? false
      expect(offered).toBe(ready)
      expect(game.save()).toEqual(before)
      const result = game.send({ type: "invoke-demon", demon })
      expect(result instanceof GameCommandError).toBe(!ready)
      if (!ready) {
        expect(game.save()).toEqual(before)
        return
      }
      expect(game.state.conversation?.active).toBe("nui-encounter")
      expect(Bag.count(game.state.bag, paper)).toBe(0)
      expect(
        game.state.conversation?.flags?.filter(
          (flag) => flag === `demon-called:${demon}`
        )
      ).toHaveLength(1)
    }
  )
  it("契約書を使わない相手には呼び出しを案内せず、直接話せる", () => {
    const content = realContent()
    const demon = contentId("nui")
    const definition = new GameDefinition({
      ...content,
      demons: content.demons.map((entry) =>
        entry.id === demon
          ? { ...entry, contract: { ...entry.contract!, paper: undefined } }
          : entry
      ),
    })
    const initial = definition.initialState()
    const game = definition.create(testEnvironment({ random: 0 }), {
      ...initial,
      hero: { ...initial.hero, registrationPending: false },
      phase: { type: "town" },
      reached: 1,
    })
    const before = game.save()
    const candidate = game.queries
      .demonContracts(game.state)
      .find((entry) => entry.id === demon)!
    expect(candidate.canInvoke).toBe(false)
    expect(candidate.canMeet).toBe(true)
    const result = game.send({ type: "invoke-demon", demon })
    expect(result).toBeInstanceOf(GameCommandError)
    expect(result).toMatchObject({ code: "UNKNOWN" })
    expect(game.save()).toEqual(before)
    eventsOrThrow(
      game.send({
        type: "start-conversation",
        trigger: "talk",
        resident: demon,
      })
    )
    expect(game.state.conversation?.active).toBe("nui-encounter")
  })
  it("初期の三人と役割を保ち、初回案内を優先し、再訪で繰り返さない", () => {
    const { game, definition } = journey()
    expect(game.state.party).toEqual([
      contentId("hero"),
      contentId("alda"),
      contentId("mort"),
    ])
    expect(
      game.queries
        .party(game.state)
        .map((member) => definition.catalog.member(member.id)!.role)
    ).toEqual(["summoner", "tank", "healer"])
    // 街・ギルドのホールの初回の場面は、はじめから遊ぶ流れ（登録前）で流す
    for (const place of [
      "inn",
      "shop",
      "armory",
      "tools",
      "apothecary",
      "smithy",
      "secret",
      "outskirts",
    ]) {
      const script = definition.catalog.data.conversations!.find(
        (entry) => entry.id === `tutorial-first-${place}`
      )!
      eventsOrThrow(
        game.send({
          type: "start-conversation",
          trigger: "visit",
          place: script.place,
        })
      )
      expect(game.state.conversation?.active).toBe(script.id)
      finish(game)
      expect(
        game.queries
          .conversations(game.state, "visit", { place: script.place })
          .find((entry) => entry.conversation.id === script.id)!.reasons
      ).toContain("一度限りの会話を既読")
    }
    expect(game.queries.problems(game.state)).toEqual([])
  })
})
