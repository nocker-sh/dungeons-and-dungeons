import { expect, test } from "vite-plus/test"
import { buildContent } from "@/builder/lib/build-content"
import { Session } from "@/builder/lib/session"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { GameStateBuilder } from "@/lib/wiz/testing/state-builder"
import { ExplorationRules } from "@/lib/wiz/rules/exploration-rules"

const built = buildContent([])
const catalog = new Session(built, 1).catalog
const scouts = [
  ...catalog.data.party,
  ...catalog.data.recruits.map((entry) => entry.member),
].filter((member) => member.exploration === "scout")

for (const layer of catalog.data.layers)
  for (const seed of [1, 7])
    test(`${layer.id}, seed=${seed}: every authored mystery keeps its surveyed outcome across Session reloads`, () => {
      expect(scouts.length).toBeGreaterThan(0)
      const targets = layer.stations.flatMap((from) =>
        from.next.flatMap((id) => {
          const to = layer.stations.find((station) => station.id === id)!
          return to.mystery && !to.event ? [{ from, to }] : []
        })
      )
      expect(targets.length).toBeGreaterThan(0)
      for (const scout of scouts)
        for (const { from, to } of targets) {
          let play = new Session(built, seed)
          let builder = GameStateBuilder.from(play.state, play.catalog)
          if (!play.state.members.some((member) => member.id === scout.id))
            builder = builder.withJoined(scout.id)
          const companions = builder
            .build()
            .members.filter((member) => member.id !== scout.id)
            .slice(0, 2)
            .map((member) => member.id)
          expect(companions).toHaveLength(2)
          // Membership, lineup, unlocked layer and position are local conditions.
          // Survey records and arrival results are produced only by real operations.
          const initial = builder
            .withParty([...companions, scout.id])
            .withReached(play.catalog.layerIndex(layer.id))
            .inExpedition({ layer: layer.id, at: from.id, visited: [from.id] })
            .build()
          play.patch((state) => Object.assign(state, initial))
          const route = () => play.queries.route(play.state)!
          const command = { type: "survey", to: to.id } as const
          const before = JSON.parse(JSON.stringify(play.dump()))
          for (let read = 0; read < 2; read++) {
            expect(
              route().paths.find((path) => path.id === to.id)
            ).toMatchObject({
              canSurvey: true,
              surveyed: false,
            })
            expect(play.dump()).toEqual(before)
          }
          const unavailable = new Session(built, seed, before)
          unavailable.patch((state) => {
            state.members.find((member) => member.id === scout.id)!.hp = 0
          })
          const withoutScout = JSON.parse(JSON.stringify(unavailable.dump()))
          expect(
            unavailable.queries
              .route(unavailable.state)!
              .paths.find((path) => path.id === to.id)!.canSurvey
          ).toBe(false)
          expect(unavailable.send(command)).toMatchObject({
            code: "UNAVAILABLE",
          })
          expect(unavailable.dump()).toEqual(withoutScout)

          const events = play.must(command)
          const revealed = events.find((event) => event.type === "surveyed")
          if (!revealed || revealed.type !== "surveyed")
            throw new Error("No survey result")
          expect(revealed.station).toBe(to.id)
          const surveyed = JSON.parse(JSON.stringify(play.dump()))
          if (to.boss) expect(surveyed.rng).toBe(before.rng)
          else expect(surveyed.rng).not.toBe(before.rng)
          expect(surveyed.serial).toBe(before.serial)
          expect(route().surveyLeft).toBe(ExplorationRules.surveyLimit - 1)
          expect(route().paths.find((path) => path.id === to.id)).toMatchObject(
            {
              canSurvey: false,
              surveyed: true,
            }
          )
          expect(
            route().stations.find((station) => station.id === to.id)!.event
          ).toBe(revealed.kind)
          expect(play.send(command)).toBeInstanceOf(GameCommandError)
          expect(play.dump()).toEqual(surveyed)
          const views = route()
          const uninterrupted = play
          play = new Session(built, seed, surveyed)
          expect(play.dump()).toEqual(surveyed)
          expect(route()).toEqual(views)
          expect(play.send(command)).toBeInstanceOf(GameCommandError)
          expect(play.dump()).toEqual(surveyed)

          const action = { type: "advance", to: to.id } as const
          const arrived = play.must(action)
          expect(arrived).toEqual(uninterrupted.must(action))
          expect(arrived).toContainEqual({
            type: "arrived",
            station: to.id,
            kind: revealed.kind,
          })
          expect(play.dump()).toEqual(uninterrupted.dump())
          expect(play.queries.problems(play.state)).toEqual([])
          const after = JSON.parse(JSON.stringify(play.dump()))
          const arrivedViews = {
            route: route(),
            battle: play.queries.battle(play.state),
            party: play.queries.party(play.state),
          }
          play = new Session(built, seed, after)
          expect(play.dump()).toEqual(after)
          expect({
            route: route(),
            battle: play.queries.battle(play.state),
            party: play.queries.party(play.state),
          }).toEqual(arrivedViews)
        }
    }, 30000)
