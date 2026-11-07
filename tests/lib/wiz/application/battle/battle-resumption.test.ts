import { expect, test } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { gameEnvironment } from "@/lib/wiz/definition/game-environment"
import type { Game } from "@/lib/wiz/game/game"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { statusKinds } from "@/lib/wiz/content/constants"
import { aState } from "@/lib/wiz/testing/state-builder"
import { realContent } from "@/lib/wiz/testing/real-content"
import { seededRandom } from "@/lib/wiz/testing/seeded-random"
import { sequentialIds } from "@/lib/wiz/testing/sequential-ids"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { turnActionFor } from "@/lib/wiz/testing/turn-action-for"

const content = realContent()
const definition = new GameDefinition(content)
const views = (game: Game) => ({
  battle: game.queries.battle(game.state),
  party: game.queries.party(game.state),
  commands: game.state.party.map((id) => game.queries.commands(game.state, id)),
  route: game.queries.route(game.state),
  result: game.queries.result(game.state),
})

for (const foe of content.foes)
  for (const affected of [false, true])
    test(`each turn resumes with identical combat and output: ${foe.id}, statuses=${affected}`, () => {
      // 戦闘開始・隊列・状態異常は局所条件。敵・装備・計算・操作は本番のものを使う。
      const initial = aState(definition.catalog)
        .withMembers(
          affected
            ? { status: statusKinds.map((kind) => ({ kind, turns: 2 })) }
            : {}
        )
        .inBattle({ foes: [foe.id, foe.id] })
        .build()
      const environment = () =>
        gameEnvironment({
          random: seededRandom(affected ? 17 : 91),
          clock: () => 42,
          ids: sequentialIds("battle-resume"),
        })
      const uninterrupted = definition.create(environment(), initial)
      // 乱数とIDの入力列は環境側で維持する。保存本文が乱数の内部状態まで持つとは扱わない。
      const resumedEnvironment = environment()
      let resumed = definition.create(resumedEnvironment, initial)
      let turns = 0
      while (uninterrupted.state.phase.type === "battle" && turns < 400) {
        const saved = JSON.parse(JSON.stringify(resumed.save()))
        resumed = definition.create(resumedEnvironment, initial)
        expect(resumed.restore(saved)).toBeUndefined()
        expect(resumed.state).toEqual(uninterrupted.state)
        expect(views(resumed)).toEqual(views(uninterrupted))
        expect(resumed.queries.problems(resumed.state)).toEqual([])
        const actor = resumed.queries.battle(resumed.state)!.current
        const before = resumed.save()
        const refused = resumed.send(
          actor.kind === "foe"
            ? { type: "act", command: "guard" }
            : { type: "foe-turn" }
        )
        expect(refused).toBeInstanceOf(GameCommandError)
        expect(refused).toMatchObject({ code: "NOT_YOUR_TURN" })
        expect(resumed.save()).toEqual(before)
        const action =
          actor.kind === "foe"
            ? { type: "foe-turn" as const }
            : turns % 3 === 0
              ? { type: "act" as const, command: "guard" as const }
              : turnActionFor(resumed, actor.id)
        const expected = eventsOrThrow(uninterrupted.send(action))
        expect(eventsOrThrow(resumed.send(action))).toEqual(expected)
        expect(resumed.state).toEqual(uninterrupted.state)
        for (const member of resumed.queries.party(resumed.state)) {
          expect(member.hp).toBeGreaterThanOrEqual(0)
          expect(member.hp).toBeLessThanOrEqual(member.maxHp)
        }
        turns++
      }
      expect(turns).toBeGreaterThan(0)
      expect(uninterrupted.state.phase.type).not.toBe("battle")
      const finished = definition.create(resumedEnvironment, initial)
      expect(
        finished.restore(JSON.parse(JSON.stringify(resumed.save())))
      ).toBeUndefined()
      expect(finished.state).toEqual(uninterrupted.state)
      expect(views(finished)).toEqual(views(uninterrupted))
      expect(finished.queries.problems(finished.state)).toEqual([])
    })
