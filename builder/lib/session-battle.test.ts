import assert from "node:assert/strict"
import { test } from "vite-plus/test"
import { Session } from "@/builder/lib/session"
import { SeededRandom } from "@/builder/lib/random"
import { arenaContent } from "@/builder/lib/simulation/arena-content"
import { startParty } from "@/builder/lib/policy/start-party"
import { battleAction } from "@/builder/lib/policy/battle"
import { realContent } from "@/lib/wiz/testing/real-content"

for (const foe of realContent().foes) {
  // The arena supplies a local encounter; enemy rules, party setup and actions are real.
  const built = arenaContent([], [foe.id, foe.id], false)
  for (const style of ["attack", "smart", "random"] as const)
    for (const seed of [1, 42])
      test(`${foe.id}: ${style} combat preserves both random streams and IDs across each restart, seed=${seed}`, () => {
        const uninterrupted = new Session(built, seed)
        startParty(uninterrupted)
        uninterrupted.must({ type: "depart", layer: "arena" })
        uninterrupted.must({ type: "advance", to: "n1" })
        assert.equal(uninterrupted.state.phase.type, "battle")
        assert.deepEqual(
          uninterrupted.queries
            .battle(uninterrupted.state)!
            .foes.map((entry) => entry.foe),
          [foe.id, foe.id]
        )
        let resumed = new Session(
          built,
          seed,
          JSON.parse(JSON.stringify(uninterrupted.dump()))
        )
        const policy = uninterrupted.random.fork(7)
        let resumedPolicy = new SeededRandom(policy.state)
        let turns = 0
        const view = (session: Session) => ({
          battle: session.queries.battle(session.state),
          party: session.queries.party(session.state),
          commands: session.state.party.map((id) =>
            session.queries.commands(session.state, id)
          ),
          route: session.queries.route(session.state),
          result: session.queries.result(session.state),
        })
        while (uninterrupted.state.phase.type === "battle" && turns < 400) {
          const saved = JSON.parse(JSON.stringify(resumed.dump()))
          resumed = new Session(built, seed, saved)
          resumedPolicy = new SeededRandom(
            JSON.parse(JSON.stringify(resumedPolicy.state))
          )
          assert.deepEqual(resumed.dump(), uninterrupted.dump())
          assert.deepEqual(view(resumed), view(uninterrupted))
          const expected = battleAction(uninterrupted, style, policy)
          const actual = battleAction(resumed, style, resumedPolicy)
          assert.deepEqual(actual, expected)
          assert.equal(resumedPolicy.state, policy.state)
          // A rejected policy command is a failure, rather than a hidden defensive fallback.
          const events = uninterrupted.must(expected)
          assert.deepEqual(resumed.must(actual), events)
          assert.deepEqual(resumed.dump(), uninterrupted.dump())
          assert.deepEqual(resumed.queries.problems(resumed.state), [])
          turns++
        }
        assert.ok(turns > 0)
        assert.notEqual(
          uninterrupted.state.phase.type,
          "battle",
          "combat must actually conclude"
        )
        const complete = uninterrupted.dump()
        const final = new Session(
          built,
          seed,
          JSON.parse(JSON.stringify(resumed.dump()))
        )
        assert.deepEqual(final.dump(), complete)
        assert.deepEqual(view(final), view(uninterrupted))
        assert.deepEqual(final.queries.problems(final.state), [])
      })
}
