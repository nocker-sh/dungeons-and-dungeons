import { expect, test } from "vite-plus/test"
import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { turnActionFor } from "@/lib/wiz/testing/turn-action-for"
import type { GameState } from "@/lib/wiz/state/state-schema"

// 戦闘中に移行した旧保存の形: 隊列が2人で、外れた仲間は控えにいる
function shortPartyBattle(): { state: GameState; benched: string } {
  const full = aState().inBattle({ foes: ["kamokutsu"] }).build()
  const benched = full.party[full.party.length - 1]
  if (full.phase.type !== "battle") throw new Error("battle")
  const battle = full.phase.battle
  return {
    benched,
    state: {
      ...full,
      party: full.party.filter((id) => id !== benched),
      phase: {
        ...full.phase,
        battle: {
          ...battle,
          order: battle.order.filter((ref) => ref.id !== benched),
        },
      },
    },
  }
}

function fight(state: GameState) {
  const game = createTestGame({ state, random: 0 })
  const size = state.party.length
  let won = false
  for (let turn = 0; turn < 400 && game.state.phase.type === "battle"; turn++) {
    const actor = game.queries.battle(game.state)!.current
    const events = eventsOrThrow(
      game.send(
        actor.kind === "foe"
          ? { type: "foe-turn" }
          : turnActionFor(game, actor.id)
      )
    )
    won ||= events.some((event) => event.type === "victory")
    // 戦闘中は隊列に加えない
    if (game.state.phase.type === "battle")
      expect(game.state.party).toHaveLength(size)
  }
  return { game, won }
}

test("勝利の精算で、欠けた隊列を控えの仲間で埋める", () => {
  const { state, benched } = shortPartyBattle()
  const { game, won } = fight(state)
  expect(won).toBe(true)
  expect(game.state.phase.type).toBe("expedition")
  expect(game.state.party).toHaveLength(PARTY_SLOTS)
  expect(game.state.party).toContain(benched)
})

test("控えが倒れていれば埋めない", () => {
  const { state, benched } = shortPartyBattle()
  const { game } = fight({
    ...state,
    members: state.members.map((member) =>
      member.id === benched ? { ...member, hp: 0 } : member
    ),
  })
  expect(game.state.phase.type).not.toBe("battle")
  expect(game.state.party).not.toContain(benched)
})

test("満員の隊列は勝利後も変わらない", () => {
  const state = aState().inBattle({ foes: ["kamokutsu"] }).build()
  const { game } = fight(state)
  expect(game.state.party).toEqual(state.party)
})
