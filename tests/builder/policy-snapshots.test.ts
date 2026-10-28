import { describe, expect, it, vi } from "vite-plus/test"
import { battleAction } from "@/builder/lib/policy/battle"
import {
  expeditionAction,
  DEFAULT_PLAN,
  PUSH_PLAN,
} from "@/builder/lib/policy/expedition"
import { arenaContent } from "@/builder/lib/simulation/arena-content"
import { Session } from "@/builder/lib/session"
import { SeededRandom } from "@/builder/lib/random"

const built = arenaContent([], ["kamokutsu"], false)

describe("同じ手番で読み取った表示を方針へ渡す", () => {
  it.each(["member", "foe"] as const)(
    "%sの手番で操作と乱数の続きが変わらない",
    (kind) => {
      const session = new Session(built, 1)
      session.must({ type: "depart", layer: "arena" })
      session.must({ type: "advance", to: "n1" })
      session.patch((state) => {
        if (state.phase.type !== "battle") throw new Error("戦闘中ではない")
        state.phase.battle.turn = state.phase.battle.order.findIndex(
          (actor) => actor.kind === kind
        )
      })
      const view = session.queries.battle(session.state)!
      expect(view.current.kind).toBe(kind)
      const query = vi.spyOn(session.queries, "battle")
      try {
        for (const style of ["attack", "smart", "random"] as const) {
          const freshRandom = new SeededRandom(42)
          const expected = battleAction(session, style, freshRandom)
          expect(query.mock.calls.length).toBe(1)
          query.mockClear()
          const snapshotRandom = new SeededRandom(42)
          expect(battleAction(session, style, snapshotRandom, view)).toEqual(
            expected
          )
          expect(snapshotRandom.state).toBe(freshRandom.state)
          expect(query.mock.calls.length).toBe(0)
        }
      } finally {
        query.mockRestore()
      }
    }
  )

  it("探索の方針も操作と乱数を保ち、道のりを読み直さない", () => {
    const session = new Session(built, 1)
    session.must({ type: "depart", layer: "arena" })
    const route = session.queries.route(session.state)!
    const query = vi.spyOn(session.queries, "route")
    try {
      for (const plan of [
        DEFAULT_PLAN,
        PUSH_PLAN,
        { ...PUSH_PLAN, stopAt: 0 },
      ]) {
        const freshRandom = new SeededRandom(42)
        const expected = expeditionAction(session, plan, freshRandom)
        expect(query.mock.calls.length).toBe(1)
        query.mockClear()
        const snapshotRandom = new SeededRandom(42)
        expect(expeditionAction(session, plan, snapshotRandom, route)).toEqual(
          expected
        )
        expect(snapshotRandom.state).toBe(freshRandom.state)
        expect(query.mock.calls.length).toBe(0)
      }
    } finally {
      query.mockRestore()
    }
  })
})
