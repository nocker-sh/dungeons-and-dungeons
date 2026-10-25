import { describe, expect, it } from "vite-plus/test"
import { GameCommandError, GameDefinition, inPhase } from "@/lib/wiz"
import {
  contentId,
  createTestPlay,
  eventsOrThrow,
  realContent,
} from "@/lib/wiz/testing"

/** 本物の「はじめから」（主人公を作る場面）のプレイ。 */
function freshPlay(content: unknown = realContent()) {
  const definition = new GameDefinition(content)
  return definition.create()
}

describe("主人公を作る", () => {
  it("[feature:W029] はじめからロクスと契約済みで、主人公を作る場面から始まる", () => {
    const game = freshPlay()
    expect(game.state.phase.type).toBe("creating")
    expect(game.state.demons).toEqual([{ id: contentId("lox"), lv: 1, exp: 0 }])
    expect(game.state.contract).toBe(contentId("lox"))
    expect(game.state.stones).toBe(realContent().startingStones)
    // 作る場面では街の操作も出撃も通らない
    expect(
      game.send({ type: "depart", layer: contentId("layer0") })
    ).toBeInstanceOf(GameCommandError)
    expect(game.send({ type: "summon" })).toBeInstanceOf(GameCommandError)
  })

  it("[feature:W029] 外見と名前を決めると街へ出て、名前がそのまま札に出る", () => {
    const game = freshPlay()
    const hero = game.queries.hero(game.state)
    expect(hero.creating).toBe(true)
    expect(hero.looks.map((look) => look.id)).toEqual(realContent().hero.looks)
    expect(hero.suggestion).toBe(realContent().hero.name)
    const [first, second] = realContent().hero.looks
    const events = eventsOrThrow(
      game.send({ type: "create-hero", name: " ノア ", look: second })
    )
    expect(events).toEqual([
      { type: "hero-created", name: "ノア", look: second },
    ])
    expect(game.state.phase.type).toBe("town")
    const hired = game.queries.party(game.state).find((entry) => entry.hero)!
    expect(hired.name).toBe("ノア")
    expect(hired.look).toBe(second)
    expect(game.queries.look(game.state, contentId("hero"))).toBe(second)
    // 作り終えた後にもう一度は通らない
    expect(
      game.send({ type: "create-hero", name: "別名", look: first })
    ).toBeInstanceOf(GameCommandError)
  })

  it("[feature:W029] 空・長すぎる・カタカナでない名前と、候補にない外見は断る", () => {
    const reasons = (name: string, look = realContent().hero.looks[0]) => {
      const game = freshPlay()
      const failed = game.send({ type: "create-hero", name, look })
      return failed instanceof GameCommandError ? failed.code : null
    }
    expect(reasons("　 ")).toBe("INVALID_ACTION")
    expect(reasons("ア".repeat(7))).toBe("INVALID_ACTION")
    expect(reasons("のあ")).toBe("INVALID_ACTION")
    expect(reasons("ノア", "ghost")).toBe("UNKNOWN")
    expect(reasons("ア".repeat(6))).toBe(null)
    // 場面の準備・CLI 用に、登録前の仮の呼び名のままでも作れる
    expect(reasons(realContent().hero.name)).toBe(null)
    // 断られた操作は状態を変えない
    const game = freshPlay()
    const before = game.state
    game.send({
      type: "create-hero",
      name: "",
      look: realContent().hero.looks[0],
    })
    expect(game.state).toBe(before)
  })

  it("[feature:W030] 街では名前を変えられる。同じ名前・空の名前は断る", () => {
    const { game } = createTestPlay()
    eventsOrThrow(game.send({ type: "rename-hero", name: "ミナ" }))
    expect(game.state.hero.name).toBe("ミナ")
    expect(game.queries.hero(game.state).name).toBe("ミナ")
    const same = game.send({ type: "rename-hero", name: " ミナ " })
    expect((same as GameCommandError).code).toBe("ALREADY")
    const empty = game.send({ type: "rename-hero", name: "" })
    expect((empty as GameCommandError).code).toBe("INVALID_ACTION")
    // 探索中は変えられない
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    expect(game.send({ type: "rename-hero", name: "レン" })).toBeInstanceOf(
      GameCommandError
    )
    expect(game.state.hero.name).toBe("ミナ")
  })

  it("[feature:W029] フェーズは作る場面の操作だけを公開する", () => {
    const game = freshPlay()
    const creating = inPhase(game, "creating")
    expect(creating).not.toBe(null)
    expect(inPhase(game, "town")).toBe(null)
    const step = creating!.createHero("ノア", realContent().hero.looks[0])
    expect(step).not.toBeInstanceOf(GameCommandError)
    expect((step as { next: { kind: string } }).next.kind).toBe("town")
  })
})
