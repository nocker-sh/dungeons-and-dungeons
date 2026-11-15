import { describe, expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { stateProblems } from "@/lib/wiz/integrity/state-problems"
import { fitPartySize } from "@/lib/wiz/definition/party-size-migration"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { catalogOf } from "@/lib/wiz/testing/catalog-of"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { createMember } from "@/lib/wiz/members/create-member"

const catalog = catalogOf(realContent())
const [hero, alda, mayu, mort, jig] = [
  "hero",
  "alda",
  "mayu",
  "mort",
  "jig",
].map(contentId)

/** 以前の4人編成（アルダ・マユ・モート・ジグ）で保存した状態。 */
function fourInTown(): GameState {
  const state = aState().withJoined("jig").build()
  return { ...state, party: [alda, mayu, mort, jig] }
}

/** 4人で戦っている途中の状態。turn で動く番の人を決める。 */
function fourInBattle(turn: number, guarding: string[] = []): GameState {
  const state = aState()
    .withJoined("jig")
    .inBattle({ foes: ["kamokutsu"], order: ["alda"] })
    .build()
  if (state.phase.type !== "battle") throw new Error("戦闘ではない")
  return {
    ...state,
    party: [alda, mayu, mort, jig],
    phase: {
      ...state.phase,
      battle: {
        ...state.phase.battle,
        order: [
          { kind: "member", id: alda },
          { kind: "foe", id: "foe-1" },
          { kind: "member", id: mayu },
          { kind: "member", id: mort },
          { kind: "member", id: jig },
        ],
        turn,
        guarding,
      },
    },
  }
}

describe("4人の古い保存を3人へ移す", () => {
  it("控えへ回る仲間に祝福がある探索・戦闘の保存も再開できる", () => {
    const blessing = realContent().skills.find((skill) => skill.blessing)!.id
    const battle = fourInBattle(0)
    if (battle.phase.type !== "battle") throw new Error("戦闘ではない")
    const phases: GameState["phase"][] = [
      battle.phase,
      { type: "expedition", expedition: battle.phase.expedition },
    ]
    for (const phase of phases) {
      const old = {
        ...battle,
        phase,
        members: battle.members.map((member) =>
          member.id === jig || member.id === alda
            ? { ...member, blessing }
            : member
        ),
      }
      const game = createTestGame()
      const save = { ...game.save(), snapshot: old }
      const before = JSON.stringify(save)
      expect(game.restore(save)).toBeUndefined()
      expect(
        game.state.members.find((member) => member.id === jig)?.blessing
      ).toBeUndefined()
      expect(
        game.state.members.find((member) => member.id === alda)?.blessing
      ).toBe(blessing)
      expect(game.state.gear).toEqual(old.gear)
      expect(game.state.gold).toBe(old.gold)
      expect(
        game.state.members.map(({ blessing: _blessing, ...member }) => member)
      ).toEqual(old.members.map(({ blessing: _blessing, ...member }) => member))
      expect(JSON.stringify(save)).toBe(before)
      expect(createTestGame().restore(game.save())).toBeUndefined()
    }
  })

  it("控えへ回る仲間の不明な祝福を、移行で消して受け入れない", () => {
    const game = createTestGame()
    const old = fourInBattle(0)
    const snapshot = {
      ...old,
      members: old.members.map((member) =>
        member.id === jig ? { ...member, blessing: "missing" } : member
      ),
    }
    const before = game.state
    expect(game.restore({ ...game.save(), snapshot })).toBeInstanceOf(
      GameCommandError
    )
    expect(game.state).toBe(before)
  })

  it.each(["duplicate", "unknown", "unhired", "order"])(
    "移行で取り除かれる場所の不正も拒否する: %s",
    (kind) => {
      const game = createTestGame()
      const old = fourInBattle(0)
      if (old.phase.type !== "battle") throw new Error("戦闘ではない")
      const invalid =
        kind === "duplicate"
          ? mayu
          : kind === "unknown"
            ? "missing"
            : contentId("alma")
      const snapshot =
        kind === "order"
          ? {
              ...old,
              phase: {
                ...old.phase,
                battle: {
                  ...old.phase.battle,
                  order: [
                    ...old.phase.battle.order,
                    { kind: "member" as const, id: "missing" },
                  ],
                },
              },
            }
          : { ...fourInTown(), party: [alda, mayu, mort, invalid] }
      const before = game.state
      expect(game.restore({ ...game.save(), snapshot })).toBeInstanceOf(
        GameCommandError
      )
      expect(game.state).toBe(before)
    }
  )

  it("街の保存は並びの右から控えへ回し、雇った仲間と装備はそのまま", () => {
    const old = fourInTown()
    expect(stateProblems(old, catalog)).toContain("出撃メンバーが多すぎる")
    const moved = fitPartySize(old)
    expect(moved.party).toEqual([alda, mayu, mort])
    expect(moved.party).toHaveLength(PARTY_SLOTS)
    expect(moved.members).toBe(old.members)
    expect(moved.gear).toBe(old.gear)
    expect(stateProblems(moved, catalog)).toEqual([])
  })

  it("3人以下の保存はそのまま返す", () => {
    const state = aState().build()
    expect(fitPartySize(state)).toBe(state)
  })

  it("戦闘中なら控えへ回った仲間を手番と防御から外し、動く番の人を保つ", () => {
    // 動く番はモート（3番目）。ジグが外れても、モートの番のまま
    const atMort = fitPartySize(fourInBattle(3, [jig, mayu]))
    if (atMort.phase.type !== "battle") throw new Error("戦闘ではない")
    const battle = atMort.phase.battle
    expect(battle.order.map((ref) => ref.id)).toEqual([
      alda,
      "foe-1",
      mayu,
      mort,
    ])
    expect(battle.order[battle.turn % battle.order.length].id).toBe(mort)
    expect(battle.guarding).toEqual([mayu])
    expect(stateProblems(atMort, catalog)).toEqual([])
  })

  it("戦闘中に動く番の人が控えへ回ったら、次の人の番にする", () => {
    // 2巡目のジグの番（turn 9 = 9 % 5 = 4）。次は1番目のアルダ
    const moved = fitPartySize(fourInBattle(9))
    if (moved.phase.type !== "battle") throw new Error("戦闘ではない")
    const battle = moved.phase.battle
    expect(battle.order[battle.turn % battle.order.length]).toEqual({
      kind: "member",
      id: alda,
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
    expect(game.state.party).toEqual([alda, mayu, mort])
    expect(game.queries.reserve(game.state).map((member) => member.id)).toEqual(
      [jig]
    )
    // 読み込んだ後の保存は3人のまま戻る
    const again = createTestGame()
    expect(again.restore(game.save())).toBeUndefined()
    expect(again.state.party).toEqual([alda, mayu, mort])
  })

  it("プレイヤーを含む4人の保存は、プレイヤーを外した3人で読み込む", () => {
    // プレイヤーが戦っていた頃の4人編成（プレイヤー・アルダ・マユ・モート）
    const base = aState().build()
    const old: GameState = {
      ...base,
      members: [createMember(catalog.member(hero)!), ...base.members],
      party: [hero, alda, mayu, mort],
    }
    expect(stateProblems(old, catalog)).toEqual(
      expect.arrayContaining([
        "出撃メンバーが多すぎる",
        "プレイヤーが仲間に入っている",
      ])
    )
    const game = createTestGame()
    const save = JSON.parse(JSON.stringify(game.save()))
    expect(
      game.restore({ ...save, snapshot: JSON.parse(JSON.stringify(old)) })
    ).toBeUndefined()
    // プレイヤーが抜けて3人になるので、控えへ回る仲間はいない
    expect(game.state.party).toEqual([alda, mayu, mort])
    expect(game.state.members.some((member) => member.id === hero)).toBe(false)
    expect(game.queries.reserve(game.state)).toEqual([])
    expect(stateProblems(game.state, catalog)).toEqual([])
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
    expect(game.state.party).toEqual([alda, mayu, mort])
    expect(game.queries.battle(game.state)?.current).toEqual({
      kind: "member",
      id: alda,
    })
    expect(game.send({ type: "act", command: "guard" })).not.toBeInstanceOf(
      Error
    )
  })
})
