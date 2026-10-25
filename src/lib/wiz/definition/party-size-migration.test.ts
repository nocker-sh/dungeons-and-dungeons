import { describe, expect, it } from "vite-plus/test"
import { GameCatalog, PARTY_SLOTS, type GameState } from "@/lib/wiz"
import { stateProblems } from "@/lib/wiz/integrity"
import { fitPartySize } from "@/lib/wiz/definition/party-size-migration"
import {
  aState,
  contentId,
  createTestGame,
  realContent,
} from "@/lib/wiz/testing"

const catalog = new GameCatalog(realContent())
const [hero, alda, mayu, mort] = ["hero", "alda", "mayu", "mort"].map(contentId)

/** 以前の4人編成（主人公・アルダ・マユ・モート）で保存した状態。 */
function fourInTown(): GameState {
  const state = aState().withJoined("mayu").build()
  return { ...state, party: [hero, alda, mayu, mort] }
}

/** 4人で戦っている途中の状態。turn で動く番の人を決める。 */
function fourInBattle(turn: number, guarding: string[] = []): GameState {
  const state = aState()
    .withJoined("mayu")
    .inBattle({ foes: ["kamokutsu"], order: ["hero"] })
    .build()
  if (state.phase.type !== "battle") throw new Error("戦闘ではない")
  return {
    ...state,
    party: [hero, alda, mayu, mort],
    phase: {
      ...state.phase,
      battle: {
        ...state.phase.battle,
        order: [
          { kind: "member", id: hero },
          { kind: "foe", id: "foe-1" },
          { kind: "member", id: alda },
          { kind: "member", id: mayu },
          { kind: "member", id: mort },
        ],
        turn,
        guarding,
      },
    },
  }
}

describe("4人の古い保存を3人へ移す", () => {
  it("街の保存は並びの右から控えへ回し、雇った仲間と装備はそのまま", () => {
    const old = fourInTown()
    expect(stateProblems(old, catalog)).toContain("出撃メンバーが多すぎる")
    const moved = fitPartySize(old, catalog)
    expect(moved.party).toEqual([hero, alda, mayu])
    expect(moved.party).toHaveLength(PARTY_SLOTS)
    expect(moved.members).toBe(old.members)
    expect(moved.gear).toBe(old.gear)
    expect(stateProblems(moved, catalog)).toEqual([])
  })

  it("主人公が右端にいても主人公は残す", () => {
    const old = { ...fourInTown(), party: [alda, mayu, mort, hero] }
    expect(fitPartySize(old, catalog).party).toEqual([alda, mayu, hero])
  })

  it("3人以下の保存はそのまま返す", () => {
    const state = aState().build()
    expect(fitPartySize(state, catalog)).toBe(state)
  })

  it("戦闘中なら控えへ回った仲間を手番と防御から外し、動く番の人を保つ", () => {
    // 動く番はマユ（3番目）。モートが外れても、マユの番のまま
    const atMayu = fitPartySize(fourInBattle(3, [mort, alda]), catalog)
    if (atMayu.phase.type !== "battle") throw new Error("戦闘ではない")
    const battle = atMayu.phase.battle
    expect(battle.order.map((ref) => ref.id)).toEqual([
      hero,
      "foe-1",
      alda,
      mayu,
    ])
    expect(battle.order[battle.turn % battle.order.length].id).toBe(mayu)
    expect(battle.guarding).toEqual([alda])
    expect(stateProblems(atMayu, catalog)).toEqual([])
  })

  it("戦闘中に動く番の人が控えへ回ったら、次の人の番にする", () => {
    // 2巡目のモートの番（turn 9 = 9 % 5 = 4）。次は1番目の主人公
    const moved = fitPartySize(fourInBattle(9), catalog)
    if (moved.phase.type !== "battle") throw new Error("戦闘ではない")
    const battle = moved.phase.battle
    expect(battle.order[battle.turn % battle.order.length]).toEqual({
      kind: "member",
      id: hero,
    })
    expect(stateProblems(moved, catalog)).toEqual([])
  })

  it("保存から読み込むと3人へ移り、そのまま遊べる", () => {
    const game = createTestGame()
    const save = JSON.parse(JSON.stringify(game.save()))
    const four = fourInTown()
    expect(
      game.restore({ ...save, snapshot: JSON.parse(JSON.stringify(four)) })
    ).toBeUndefined()
    expect(game.state.party).toEqual([hero, alda, mayu])
    expect(game.queries.reserve(game.state).map((member) => member.id)).toEqual(
      [mort]
    )
    // 読み込んだ後の保存は3人のまま戻る
    const again = createTestGame()
    expect(again.restore(game.save())).toBeUndefined()
    expect(again.state.party).toEqual([hero, alda, mayu])
  })

  it("戦闘中の4人の保存も読み込め、手番を続けられる", () => {
    const game = createTestGame({ random: 0.5 })
    const save = JSON.parse(JSON.stringify(game.save()))
    expect(
      game.restore({
        ...save,
        snapshot: JSON.parse(JSON.stringify(fourInBattle(0))),
      })
    ).toBeUndefined()
    expect(game.state.party).toEqual([hero, alda, mayu])
    expect(game.queries.battle(game.state)?.current).toEqual({
      kind: "member",
      id: hero,
    })
    expect(game.send({ type: "act", command: "guard" })).not.toBeInstanceOf(
      Error
    )
  })
})
