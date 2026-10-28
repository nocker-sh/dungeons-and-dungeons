import { describe, expect, it, vi } from "vite-plus/test"
import { Session } from "@/builder/lib/session"
import { arenaContent } from "@/builder/lib/simulation/arena-content"
import { battleTrials } from "@/builder/lib/simulation/battle-trials"
import { fightToEnd } from "@/builder/lib/simulation/fight-to-end"
import { runExpedition } from "@/builder/lib/simulation/expedition"
import { PUSH_PLAN } from "@/builder/lib/policy/expedition"

const stalled = [
  "foes.kamokutsu.hp=100000000",
  "foes.kamokutsu.atk=1",
  "party.*.stats.maxHp=1000000",
]

function arena(overrides: readonly string[]) {
  return new Session(arenaContent(overrides, ["kamokutsu"], false), 1)
}

function enterBattle(session: Session) {
  session.must({ type: "depart", layer: "arena" })
  session.must({ type: "advance", to: "n1" })
}

describe("シミュレーションの未完了", () => {
  it("探索が進まなくなっても、街へ帰った結果として返さない", () => {
    const session = arena([])
    const must = session.must.bind(session)
    // 操作は成功扱いでも移動が反映されない不具合を注入する。
    // 毎回同じ地点に留まるため、探索の打ち切りに必ず到達する。
    const stuck = vi
      .spyOn(session, "must")
      .mockImplementation((action) =>
        action.type === "advance" ? [] : must(action)
      )
    try {
      expect(() =>
        runExpedition(session, "arena", PUSH_PLAN, "attack")
      ).toThrow(/探索.*2000.*未完了/)
      expect(session.state.phase.type).toBe("expedition")
      expect(session.state.wipe).toBeNull()
    } finally {
      stuck.mockRestore()
    }
  })

  it.each(["retreated", "cleared", "wiped"] as const)(
    "実際に帰還した探索の結果 %s を保つ",
    (outcome) => {
      const session = arena(
        outcome === "cleared"
          ? ["foes.kamokutsu.hp=1"]
          : outcome === "wiped"
            ? ["foes.kamokutsu.hp=100000000", "foes.kamokutsu.atk=100000000"]
            : []
      )
      const plan =
        outcome === "retreated" ? { ...PUSH_PLAN, stopAt: 0 } : PUSH_PLAN
      const result = runExpedition(session, "arena", plan, "attack")
      expect(result.outcome).toBe(outcome)
      expect(session.state.phase.type).toBe("town")
    }
  )

  it("手数上限でも続いている戦闘を敗北として返さない", () => {
    const session = arena(stalled)
    enterBattle(session)
    expect(() => fightToEnd(session, "attack")).toThrow(/戦闘.*2000.*未完了/)
    expect(session.state.phase.type).toBe("battle")
    expect(
      session.queries.party(session.state).some((member) => member.hp > 0)
    ).toBe(true)
    expect(session.state.wipe).toBeNull()
  })

  it("未完了の戦闘を勝率の分母に含めない", () => {
    expect(() =>
      battleTrials({
        overrides: stalled,
        foes: ["kamokutsu"],
        boss: false,
        runs: 1,
        seed: 1,
        style: "attack",
        setup: {},
      })
    ).toThrow(/戦闘.*未完了/)
  })

  it("探索中の未完了戦闘を全滅として返さない", () => {
    const session = arena(stalled)
    expect(() => runExpedition(session, "arena", PUSH_PLAN, "attack")).toThrow(
      /戦闘.*未完了/
    )
    expect(session.state.phase.type).toBe("battle")
    expect(session.state.wipe).toBeNull()
  })

  it.each([true, false])("決着した戦闘の勝敗=%sは従来どおり返す", (won) => {
    const session = arena(
      won
        ? ["foes.kamokutsu.hp=1"]
        : ["foes.kamokutsu.hp=100000000", "foes.kamokutsu.atk=100000000"]
    )
    enterBattle(session)
    const result = fightToEnd(session, "attack")
    expect(result.won).toBe(won)
    expect(result.rounds).toBeGreaterThan(0)
    expect(session.state.phase.type).toBe(won ? "expedition" : "town")
    if (!won) expect(session.state.wipe).not.toBeNull()
  })
})
