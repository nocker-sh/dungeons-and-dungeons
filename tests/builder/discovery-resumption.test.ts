import { expect, test } from "vite-plus/test"
import { buildContent } from "@/builder/lib/build-content"
import { Session } from "@/builder/lib/session"
import { GameStateBuilder } from "@/lib/wiz/testing/state-builder"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { Bag } from "@/lib/wiz/rules/bag"

const built = buildContent([])
const catalog = new Session(built, 1).catalog

for (const layer of catalog.data.layers)
  for (const seed of [1, 7])
    test(`${layer.id}, seed=${seed}: every discovery choice matches its offer and survives Session reloads without duplicate payment`, () => {
      const stations = layer.stations.filter((station) => station.discovery)
      expect(stations.length).toBeGreaterThan(0)
      for (const station of stations) {
        const from = layer.stations.find((entry) =>
          entry.next.includes(station.id)
        )
        expect(from, station.id).toBeDefined()
        let arrivalSeed: number | undefined
        for (let attempt = 0; attempt < 256; attempt++) {
          const candidate = new Session(built, seed + attempt)
          const approach = GameStateBuilder.from(
            candidate.state,
            candidate.catalog
          )
            .withReached(candidate.catalog.layerIndex(layer.id))
            .inExpedition({
              layer: layer.id,
              at: from!.id,
              visited: [from!.id],
            })
            .build()
          candidate.patch((state) => Object.assign(state, approach))
          const events = candidate.must({ type: "advance", to: station.id })
          if (
            events.some(
              (event) => event.type === "arrived" && event.kind === "discovery"
            )
          ) {
            arrivalSeed = seed + attempt
            break
          }
        }
        expect(
          arrivalSeed,
          `${station.id}: no native discovery arrival within seed search`
        ).toBeDefined()
        expect(station.discovery!.choices.length).toBeGreaterThan(0)
        for (const choice of station.discovery!.choices) {
          expect((choice.blessings ?? [undefined]).length).toBeGreaterThan(0)
          for (const skill of choice.blessings ?? [undefined]) {
            let play = new Session(built, arrivalSeed!)
            // Funds, materials, unlocked layer and the previous station are local
            // conditions. Arrival, pending outcomes and rewards use real commands.
            const initial = GameStateBuilder.from(play.state, play.catalog)
              .withGold(10000)
              .withBag(choice.costGoods ?? [])
              .inExpedition({
                layer: layer.id,
                at: from!.id,
                visited: [from!.id],
              })
              .withReached(play.catalog.layerIndex(layer.id))
              .build()
            play.patch((state) => Object.assign(state, initial))
            expect(
              play.must({ type: "advance", to: station.id })
            ).toContainEqual({
              type: "arrived",
              station: station.id,
              kind: "discovery",
            })
            const snapshot = () =>
              JSON.parse(JSON.stringify(play.dump())) as ReturnType<
                Session["dump"]
              >
            const command = {
              type: "discover",
              choice: choice.id,
              ...(skill ? { skill, member: play.state.party[0] } : {}),
            } as const
            const before = snapshot()
            const previousState = play.state
            const route = play.queries.route(play.state)!
            const offer = route.discovery!.choices.find(
              (entry) => entry.id === choice.id
            )!
            expect(offer.available, `${station.id}/${choice.id}`).toBe(true)
            expect(play.queries.route(play.state)).toEqual(route)
            expect(play.dump()).toEqual(before)
            const refuse = (
              session: Session,
              action: Parameters<Session["send"]>[0]
            ) => {
              const saved = JSON.parse(JSON.stringify(session.dump()))
              expect(session.send(action)).toBeInstanceOf(GameCommandError)
              expect(session.dump()).toEqual(saved)
            }
            refuse(play, { type: "acknowledge" })
            refuse(play, { type: "discover", choice: "__unknown-discovery__" })
            if (offer.cost > 0) {
              const poor = new Session(built, seed, before)
              poor.patch((state) => {
                state.gold = offer.cost - 1
              })
              expect(
                poor.queries
                  .route(poor.state)!
                  .discovery!.choices.find((entry) => entry.id === choice.id)!
                  .available
              ).toBe(false)
              refuse(poor, command)
            }
            for (const material of choice.costGoods ?? []) {
              const missing = new Session(built, seed, before)
              missing.patch((state) => {
                state.bag = state.bag.filter(
                  (entry) => entry.good !== material.good
                )
              })
              expect(
                missing.queries
                  .route(missing.state)!
                  .discovery!.choices.find((entry) => entry.id === choice.id)!
                  .available
              ).toBe(false)
              refuse(missing, command)
            }
            if (choice.healthCostRatio) {
              const injured = new Session(built, seed, before)
              injured.patch((state) => {
                for (const member of state.members)
                  if (state.party.includes(member.id)) member.hp = 1
              })
              expect(
                injured.queries
                  .route(injured.state)!
                  .discovery!.choices.find((entry) => entry.id === choice.id)!
                  .available
              ).toBe(false)
              refuse(injured, command)
            }
            const uninterrupted = play
            play = new Session(built, seed, before)
            expect(play.queries.route(play.state)).toEqual(route)
            expect(play.must(command)).toEqual(uninterrupted.must(command))
            expect(play.dump()).toEqual(uninterrupted.dump())
            expect(play.state.gold).toBe(previousState.gold - offer.cost)
            for (const good of catalog.data.goods)
              expect(Bag.count(play.state.bag, good.id)).toBe(
                Bag.count(previousState.bag, good.id) -
                  (choice.costGoods ?? [])
                    .filter((entry) => entry.good === good.id)
                    .reduce((sum, entry) => sum + entry.count, 0) +
                  (choice.goods ?? [])
                    .filter((entry) => entry.good === good.id)
                    .reduce((sum, entry) => sum + entry.count, 0)
              )
            for (const member of play.state.members) {
              const previous = previousState.members.find(
                (entry) => entry.id === member.id
              )!
              const shown =
                offer.healthChanges.find((entry) => entry.id === member.id) ??
                offer.payment.find((entry) => entry.id === member.id)
              expect(member.hp).toBe(shown?.after ?? previous.hp)
            }
            if (skill)
              expect(
                play.state.members.find(
                  (member) => member.id === command.member
                )!.blessing
              ).toBe(skill)
            const awarded = snapshot()
            const views = {
              route: play.queries.route(play.state),
              party: play.queries.party(play.state),
            }
            play = new Session(built, seed, awarded)
            expect(play.dump()).toEqual(awarded)
            expect({
              route: play.queries.route(play.state),
              party: play.queries.party(play.state),
            }).toEqual(views)
            refuse(play, command)
            expect(play.must({ type: "acknowledge" })).toEqual(
              uninterrupted.must({ type: "acknowledge" })
            )
            refuse(play, command)
            refuse(play, { type: "acknowledge" })
            expect(play.must({ type: "retreat" })).toEqual(
              uninterrupted.must({ type: "retreat" })
            )
            expect(play.dump()).toEqual(uninterrupted.dump())
            const returned = snapshot()
            play = new Session(built, seed, returned)
            expect(play.dump()).toEqual(returned)
            refuse(play, command)
            refuse(play, { type: "retreat" })
            expect(play.queries.problems(play.state)).toEqual([])
          }
        }
      }
    }, 30000)
