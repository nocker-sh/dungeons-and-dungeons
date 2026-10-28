import { describe, expect, it } from "vite-plus/test"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { createGame } from "@/lib/wiz/definition/create-game"
import type { GameAction } from "@/lib/wiz/commands"
import { aState } from "@/lib/wiz/testing/state-builder"
import { advancingClock } from "@/lib/wiz/testing/advancing-clock"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { seededRandom } from "@/lib/wiz/testing/seeded-random"
import { sequenceRandom } from "@/lib/wiz/testing/sequence-random"
import { sequentialIds } from "@/lib/wiz/testing/sequential-ids"
import { startedState } from "@/lib/wiz/testing/started-state"

/** 同じ台本を送る。断られてもよい。 */
const script: GameAction[] = [
  { type: "summon" },
  { type: "buy", shop: contentId("armory"), good: contentId("dagger") },
  { type: "appraise", shop: contentId("armory") },
  { type: "rest", room: contentId("attic") },
  { type: "depart", layer: contentId("layer0") },
  { type: "advance", to: "n1" },
  { type: "act", command: "guard" },
  { type: "foe-turn" },
]

function playScript(options: Parameters<typeof createGame>[0]) {
  const game = createGame({ initialState: aState().build(), ...options })
  for (const action of script) game.send(action)
  return game
}

describe("プレイの持ち物（hunt）", () => {
  it("購読者は操作のたびに一度だけ呼ばれ、外すと呼ばれない", () => {
    const game = createGame({
      content: realContent(),
      initialState: aState().build(),
      random: () => 0.5,
    })
    let calls = 0
    const unsubscribe = game.subscribe(() => {
      calls += 1
    })
    game.send({ type: "summon" })
    expect(calls).toBe(1)
    // 断られた操作でも写しが変わるので知らせる
    game.send({ type: "advance", to: "n1" })
    expect(calls).toBe(2)
    game.restore({ nothing: true })
    expect(calls).toBe(3)
    unsubscribe()
    game.send({ type: "summon" })
    expect(calls).toBe(3)
  })

  it("写しは凍っていて、成功のあとは理由が消える", () => {
    const game = createGame({
      content: realContent(),
      initialState: aState().build(),
      random: () => 0.5,
    })
    expect(Object.isFrozen(game.getSnapshot())).toBe(true)
    expect(game.getSnapshot().error).toBe(null)
    expect(game.getSnapshot().state).toBe(game.state)
    game.send({ type: "advance", to: "n1" })
    expect(game.getSnapshot().error).toBe("WRONG_PHASE")
    game.send({ type: "choose-demon", demon: game.state.demons[0].id })
    expect(game.getSnapshot().error).toBe(null)
  })

  it("断られた操作は状態の同じ写しを保つ", () => {
    const game = createGame({
      content: realContent(),
      initialState: aState().build(),
      random: () => 0.5,
    })
    const before = game.state
    expect(game.send({ type: "retreat" })).toBeInstanceOf(GameCommandError)
    expect(game.state).toBe(before)
    expect(game.getSnapshot().state).toBe(before)
  })

  it("保存は JSON にして戻しても同じ中身になる", () => {
    const game = playScript({
      content: realContent(),
      random: seededRandom(9),
      ids: sequentialIds("gear"),
    })
    const save = game.save()
    expect(JSON.parse(JSON.stringify(save))).toEqual(save)
    expect(save.schemaVersion).toBe(1)
    expect(typeof save.contentVersion).toBe("string")
  })

  it("同じデータ・同じ乱数なら、作り直しても同じ結果になる", () => {
    for (const seed of [1, 5, 13, 77]) {
      const first = playScript({
        content: realContent(),
        random: seededRandom(seed),
        ids: sequentialIds("gear"),
      })
      const second = playScript({
        content: realContent(),
        random: seededRandom(seed),
        ids: sequentialIds("gear"),
      })
      expect(second.state, `seed ${seed}`).toEqual(first.state)
      expect(second.save()).toEqual(first.save())
    }
  })

  it("時計を差し替えても結果は変わらない（時計は結果に効かせない）", () => {
    const fixed = playScript({
      content: realContent(),
      random: seededRandom(4),
      ids: sequentialIds("gear"),
      clock: () => 0,
    })
    const moving = playScript({
      content: realContent(),
      random: seededRandom(4),
      ids: sequentialIds("gear"),
      clock: advancingClock(1000, 500),
    })
    expect(moving.state).toEqual(fixed.state)
  })

  it("IDの作り方を変えると装備の個体IDだけが変わる", () => {
    const options = {
      content: realContent(),
      random: seededRandom(4),
    }
    const first = playScript({ ...options, ids: sequentialIds("a") })
    const second = playScript({
      ...options,
      random: seededRandom(4),
      ids: sequentialIds("b"),
    })
    expect(first.state.gear.map((gear) => gear.id)).not.toEqual(
      second.state.gear.map((gear) => gear.id)
    )
    expect(first.state.gold).toBe(second.state.gold)
    expect(first.state.gear.map((gear) => gear.good)).toEqual(
      second.state.gear.map((gear) => gear.good)
    )
  })

  it("同じ乱数の台本で買った武器の個体は再現できる", () => {
    const results = Array.from({ length: 2 }, () => {
      const game = createGame({
        content: realContent(),
        initialState: aState().withGold(1000).build(),
        random: sequenceRandom([0.9, 0.1, 0.0]),
        ids: sequentialIds("gear"),
      })
      for (let index = 0; index < 2; index++)
        eventsOrThrow(
          game.send({
            type: "buy",
            shop: contentId("armory"),
            good: contentId("dagger"),
          })
        )
      return game.state.gear.slice(-2)
    })
    expect(results[0]).toEqual(results[1])
    expect(results[0].map((gear) => gear.id)).toEqual(["gear-1", "gear-2"])
  })

  it("一つの定義から作ったプレイは、状態を共有しない", () => {
    const definition = new GameDefinition(realContent())
    const first = definition.create(undefined, startedState(definition))
    const second = definition.create(undefined, startedState(definition))
    expect(first.state).toEqual(second.state)
    expect(first.state).not.toBe(second.state)
    first.send({
      type: "buy",
      shop: contentId("armory"),
      good: contentId("dagger"),
    })
    expect(first.state.gold).not.toBe(second.state.gold)
    expect(second.state.gear.length).toBe(startedState(definition).gear.length)
    // 定義が持つデータと規則は使い回す
    expect(first.queries).not.toBe(second.queries)
    expect(Object.isFrozen(definition)).toBe(true)
    expect(Object.isFrozen(definition.rules)).toBe(true)
  })

  it("はじめからの状態は何度作っても同じで、作り直しても混ざらない", () => {
    const definition = new GameDefinition(realContent())
    const first = definition.initialState()
    const second = definition.initialState()
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    // 初期装備の個体IDは環境に頼らず連番
    expect(first.gear.map((gear) => gear.id)).toEqual(
      first.gear.map((_, index) => `starter-${index + 1}`)
    )
    expect(first.gear).toHaveLength(2) // 主人公以外の二人の仲間の初期防具
    expect(first.gear.some((gear) => gear.owner === contentId("hero"))).toBe(
      false
    )
  })

  it("同じデータから別に組み立てた定義でも、保存を読み合える", () => {
    const first = new GameDefinition(realContent())
    const second = new GameDefinition(new GameCatalog(realContent()))
    expect(second.identity).toBe(first.identity)
    const game = playScript({
      content: realContent(),
      random: seededRandom(2),
      ids: sequentialIds("gear"),
    })
    const other = second.create()
    expect(other.restore(JSON.parse(JSON.stringify(game.save())))).toBe(
      undefined
    )
    expect(other.state).toEqual(game.state)
  })

  it("形の合わない操作を送っても、購読者は一度だけ呼ばれる", () => {
    const game = createGame({
      content: realContent(),
      initialState: aState().build(),
      random: () => 0.5,
    })
    let calls = 0
    game.subscribe(() => {
      calls += 1
    })
    expect((game.sendUnknown({ type: "ghost" }) as GameCommandError).code).toBe(
      "INVALID_ACTION"
    )
    expect(calls).toBe(1)
  })

  it("規則を差し替えると保存の構成が変わり、読み合えない", () => {
    const plain = createGame({ content: realContent() })
    const other = createGame({
      content: realContent(),
      rules: {},
      rulesRevision: "rules-hunt",
    })
    expect(other.save().contentVersion).not.toBe(plain.save().contentVersion)
    expect(
      other.restore(JSON.parse(JSON.stringify(plain.save())))
    ).toBeInstanceOf(GameCommandError)
    expect(
      plain.restore(JSON.parse(JSON.stringify(other.save())))
    ).toBeInstanceOf(GameCommandError)
  })
})
