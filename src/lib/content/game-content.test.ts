import { describe, expect, it } from "vite-plus/test"
import { gameContent } from "@/lib/content/game-content"
import {
  GameCatalog,
  GameCommandError,
  GameDefinition,
  inPhase,
} from "@/lib/wiz"
import { memberBySlug } from "@/lib/wiz/testing"

describe("作品のデータ", () => {
  it("JSON から組み立てたデータがエンジンの検証を通る", () => {
    expect(() => new GameCatalog(gameContent)).not.toThrow()
  })

  it("はじめから三人（主人公・アルダ・モート）・ロクス契約済みで、名前と外見を決める場面から始まる", () => {
    const game = new GameDefinition(gameContent).create()
    expect(game.state.phase.type).toBe("creating")
    expect(game.state.party).toHaveLength(3)
    expect(game.state.members).toHaveLength(3)
    expect(game.state.party).toEqual(
      ["hero", "alda", "mort"].map((slug) => memberBySlug(slug).id)
    )
    expect(game.state.members[0].lv).toBe(1)
    expect(game.state.demons).toEqual([
      { id: gameContent.startingDemon, lv: 1, exp: 0 },
    ])
    expect(game.state.contract).toBe(gameContent.startingDemon)
    expect(game.queries.hero(game.state).looks).toHaveLength(4)
    expect(game.queries.problems(game.state)).toEqual([])
  })

  it("三人は無料で揃っており、初期の仲間を二度雇えない。ほかの募集は控えに入る", () => {
    const definition = new GameDefinition(gameContent)
    const game = definition.create()
    const look = game.queries.hero(game.state).looks[0].id
    const created = inPhase(game, "creating")?.createHero("ノア", look)
    expect(created).not.toBeInstanceOf(GameCommandError)
    const party = game.state.party
    const recruits = game.queries.recruits(game.state)
    expect(recruits.some((recruit) => recruit.hired)).toBe(true)
    for (const recruit of recruits) {
      expect(recruit.affordable, recruit.name).toBe(true)
      expect(recruit.rank, recruit.name).toBe(null)
      if (!recruit.hired) continue
      const hired = inPhase(game, "town")?.recruit(recruit.id)
      expect(hired, recruit.name).toBeInstanceOf(GameCommandError)
      expect((hired as GameCommandError).code).toBe("ALREADY")
    }
    expect(game.state.party).toEqual(party)
    expect(game.state.party).toHaveLength(3)
    expect(game.state.gold).toBe(gameContent.startingGold)
    expect(game.queries.readiness(game.state)).toMatchObject({
      ready: true,
      short: 0,
    })
  })
})
