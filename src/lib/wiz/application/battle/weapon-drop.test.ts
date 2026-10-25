import { describe, expect, it } from "vite-plus/test"
import {
  aContent,
  aState,
  createTestGame,
  fightToEnd,
  realContent,
} from "@/lib/wiz/testing"
import { GameCatalog } from "@/lib/wiz"

/** 敵が武器の個体をそのまま落とす（balance.weaponDrop・仮）。 */
describe("敵の武器の落とし物", () => {
  function battleWith(chance: number, random: number) {
    const content = aContent()
      .withBalance({ weaponDrop: { chance } })
      .withWeaponPower(400)
      .build()
    return createTestGame({
      content,
      random,
      state: aState(content)
        .inBattle({ foes: ["kamokutsu"] })
        .build(),
    })
  }

  it("[feature:W006] 確率に当たると、鑑定と同じ候補から武器の個体を落とし、戦利品に入る", () => {
    // 乱数0なら確率に当たる
    const game = battleWith(1, 0)
    const before = game.state.gear.length
    const events = fightToEnd(game)
    const victory = events.find((event) => event.type === "victory")
    const weapons = victory?.type === "victory" ? (victory.weapons ?? []) : []
    expect(weapons).toHaveLength(1)
    expect(game.state.gear).toHaveLength(before + 1)
    const gear = game.state.gear.find((entry) => entry.id === weapons[0])!
    expect(gear.unidentified).toBe(true)
    expect(
      game.queries.gear(game.state).find((entry) => entry.gear === gear.id)
    ).toMatchObject({
      name: expect.stringMatching(/^だれかの/),
      stat: "未鑑定",
      weapon: null,
      rarity: null,
      plus: 0,
    })
    expect(gear.owner).toBeNull()
    expect(gear.weapon).not.toBeNull()
    const pool = new GameCatalog(realContent()).weaponDropPool(
      game.state.reached
    )
    expect(pool).toContain(gear.good)
    const route = game.queries.route(game.state)!
    expect(route.pending).toMatchObject({ kind: "loot", weapons })
    expect(route.loot.weapons).toEqual(weapons)
    expect(game.queries.problems(game.state)).toEqual([])
  })

  it("[feature:W006] 確率に外れると武器は落とさない", () => {
    const game = battleWith(0.5, 0.99)
    const before = game.state.gear.length
    const events = fightToEnd(game)
    const victory = events.find((event) => event.type === "victory")
    expect(victory?.type === "victory" && victory.weapons).toBeFalsy()
    expect(game.state.gear).toHaveLength(before)
  })

  it("[feature:W005] 全滅すると、その探索で落とした武器も失い、失った物に残る", () => {
    const game = battleWith(1, 0)
    fightToEnd(game)
    const dropped = game.queries.route(game.state)!.loot.weapons!
    const good = game.state.gear.find((entry) => entry.id === dropped[0])!.good
    // 次の戦闘で全滅させる
    const weak = createTestGame({
      content: aContent()
        .withBalance({ weaponDrop: { chance: 1 } })
        .withFoe("kamokutsu", { atk: 9999 })
        .build(),
      random: 0,
      state: aState()
        .withMembers({ hp: 1 })
        .inBattle({
          foes: ["kamokutsu"],
          order: ["foe-1", "hero", "alda", "mort"],
        })
        .build(),
    })
    const state = {
      ...weak.state,
      gear: game.state.gear,
      phase:
        weak.state.phase.type === "battle" &&
        game.state.phase.type === "expedition"
          ? {
              ...weak.state.phase,
              expedition: {
                ...weak.state.phase.expedition,
                loot: game.state.phase.expedition.loot,
              },
            }
          : weak.state.phase,
    }
    expect(weak.restore({ ...weak.save(), snapshot: state })).toBeUndefined()
    fightToEnd(weak)
    expect(weak.state.phase.type).toBe("town")
    expect(weak.state.gear.some((entry) => entry.id === dropped[0])).toBe(false)
    expect(weak.state.wipe?.unidentifiedWeapons).toContainEqual({
      good,
      count: 1,
    })
    expect(
      weak.queries
        .result(weak.state)
        ?.goods.some(
          (entry) => entry.good === good && entry.name.startsWith("だれかの")
        )
    ).toBe(true)
  })
})
