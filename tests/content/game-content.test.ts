import { describe, expect, it } from "vite-plus/test"
import { gameContent } from "@/content/game-content"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"

describe("作品のデータ", () => {
  it("JSON から組み立てたデータがエンジンの検証を通る", () => {
    expect(() => new GameCatalog(gameContent)).not.toThrow()
  })

  it("はじめから三人（アルダ・モート・マユ）・ロクス契約済みで、名前を決める場面から始まり、主人公は仲間にいない", () => {
    const definition = new GameDefinition(gameContent)
    const game = definition.create()
    expect(game.state.phase.type).toBe("creating")
    expect(game.state.party).toHaveLength(3)
    expect(game.state.members).toHaveLength(3)
    expect(game.state.party).toEqual(
      ["alda", "mort", "mayu"].map((slug) => memberBySlug(slug).id)
    )
    expect(game.state.members.map((member) => member.id)).not.toContain(
      memberBySlug("hero").id
    )
    for (const member of game.state.members)
      expect(member.lv).toBe(definition.catalog.member(member.id)?.lv)
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
