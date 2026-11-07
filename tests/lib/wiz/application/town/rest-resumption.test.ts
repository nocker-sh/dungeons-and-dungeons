import { expect, test } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { aState } from "@/lib/wiz/testing/state-builder"
import { realContent } from "@/lib/wiz/testing/real-content"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

const content = realContent()
const definition = new GameDefinition(content)
const members = [
  ...new Map(
    [...content.party, ...content.recruits.map((entry) => entry.member)].map(
      (member) => [member.id, member] as const
    )
  ).values(),
]
const hero = members.find((member) => member.hero)!
let builder = aState(definition.catalog)
for (const member of members)
  if (!builder.build().members.some((entry) => entry.id === member.id))
    builder = builder.withJoined(member.id)
const roster = builder.build()
const lastLevel = Math.max(...content.balance.growthCurve.bands) + 1
const cost = (level: number) =>
  Math.max(
    1,
    Math.round(content.balance.expBase * level ** content.balance.expPower)
  )

for (const room of content.rooms)
  for (const target of members)
    for (const active of target.hero ? [true] : [true, false])
      test(`${room.id}: ${target.id}, active=${active}, growth and recovery survive JSON restoration`, () => {
        const others = members.filter(
          (member) => !member.hero && member.id !== target.id
        )
        const party =
          !target.hero && active
            ? [hero.id, target.id, others[0].id]
            : [hero.id, ...others.slice(0, 2).map((member) => member.id)]
        // A complete roster, injuries and stored experience are local initial conditions.
        // Recruitment and battle experience acquisition are not simulated here.
        const initial = {
          ...roster,
          gold: room.price * 3 + 1,
          party,
          members: roster.members.map((member) => {
            let exp = 1
            for (let level = member.lv; level < lastLevel; level++)
              exp += cost(level)
            return {
              ...member,
              exp,
              hp: 0,
              status: [{ kind: "poison" as const, turns: 3 }],
              fatigue: 95,
              dirt: 95,
              like: 10,
            }
          }),
        }
        let draws = 0
        const game = definition.create(
          testEnvironment({
            random: () => {
              draws++
              return 0.5
            },
          }),
          initial
        )
        const snapshot = game.save()
        if (room.price > 0) {
          const poor = definition.create(
            testEnvironment({
              random: () => {
                throw new Error("refusal used randomness")
              },
            }),
            { ...initial, gold: room.price - 1 }
          )
          const before = poor.save()
          expect(poor.send({ type: "rest", room: room.id })).toMatchObject({
            code: "NO_GOLD",
          })
          expect(poor.save()).toEqual(before)
        }
        const resumed = definition.create(testEnvironment(), initial)
        expect(
          resumed.restore(JSON.parse(JSON.stringify(snapshot)))
        ).toBeUndefined()
        const action = { type: "rest" as const, room: room.id }
        const events = eventsOrThrow(game.send(action))
        expect(eventsOrThrow(resumed.send(action))).toEqual(events)
        expect(resumed.state).toEqual(game.state)
        const levelUps = []
        let expectedDraws = 0
        for (const before of initial.members) {
          const after = game.state.members.find(
            (member) => member.id === before.id
          )!
          if (!party.includes(before.id)) {
            expect(after).toEqual(before)
            continue
          }
          const grows =
            room.levelUp && !definition.catalog.member(before.id)!.hero
          const level = grows ? Math.max(before.lv, lastLevel) : before.lv
          if (grows && level > before.lv) {
            expectedDraws += level - before.lv
            levelUps.push({
              member: before.id,
              from: before.lv,
              to: level,
              before: before.stats,
              after: after.stats,
            })
            for (const stat of ["maxHp", "str", "tec", "spd"] as const)
              expect(after.stats[stat]).toBeGreaterThanOrEqual(
                before.stats[stat]
              )
          } else expect(after.stats).toEqual(before.stats)
          const maximum = game.queries.member(game.state, before.id)!.maxHp
          expect(after).toEqual({
            ...before,
            lv: level,
            exp: grows ? 1 : before.exp,
            stats: after.stats,
            hp:
              room.heal === "full"
                ? maximum
                : Math.min(maximum, 1 + Math.ceil(maximum / 2)),
            used: [],
            status: [],
            fatigue: Math.max(0, Math.min(100, 95 + room.fatigue)),
            dirt: room.clean ? 0 : Math.max(0, Math.min(100, 95 + room.dirt)),
            like: before.id === hero.id ? before.like : before.like + 1,
          })
        }
        expect(draws).toBe(expectedDraws)
        expect(events).toEqual([{ type: "rested", room: room.id, levelUps }])
        expect(game.state).toEqual({
          ...initial,
          members: game.state.members,
          gold: initial.gold - room.price,
          nights: initial.nights + 1,
          chatted: [],
        })
        const restored = definition.create(testEnvironment(), initial)
        expect(
          restored.restore(JSON.parse(JSON.stringify(game.save())))
        ).toBeUndefined()
        expect(restored.state).toEqual(game.state)
        expect(restored.queries.party(restored.state)).toEqual(
          game.queries.party(game.state)
        )
        for (const member of members)
          expect(restored.queries.member(restored.state, member.id)).toEqual(
            game.queries.member(game.state, member.id)
          )
        if (room.levelUp) {
          const again = eventsOrThrow(restored.send(action))
          expect(again).toEqual([
            { type: "rested", room: room.id, levelUps: [] },
          ])
          for (const member of restored.state.members) {
            const before = game.state.members.find(
              (entry) => entry.id === member.id
            )!
            expect({
              lv: member.lv,
              exp: member.exp,
              stats: member.stats,
            }).toEqual({ lv: before.lv, exp: before.exp, stats: before.stats })
          }
        }
        if (!active) {
          const beforeSwap = restored.state
          const out = beforeSwap.party[1]
          expect(
            eventsOrThrow(restored.send({ type: "swap", out, in: target.id }))
          ).toEqual([{ type: "swapped", out, in: target.id }])
          expect(restored.state).toEqual({
            ...beforeSwap,
            party: beforeSwap.party.map((id) => (id === out ? target.id : id)),
          })
          expect(restored.queries.member(restored.state, target.id)!.row).toBe(
            "front"
          )
          const joined = definition.create(testEnvironment(), initial)
          expect(
            joined.restore(JSON.parse(JSON.stringify(restored.save())))
          ).toBeUndefined()
          expect(joined.state).toEqual(restored.state)
          eventsOrThrow(joined.send(action))
          const previous = beforeSwap.members.find(
            (member) => member.id === target.id
          )!
          const grown = joined.state.members.find(
            (member) => member.id === target.id
          )!
          expect(grown.lv).toBe(
            room.levelUp ? Math.max(previous.lv, lastLevel) : previous.lv
          )
          expect(grown.exp).toBe(room.levelUp ? 1 : previous.exp)
          expect(grown.like).toBe(previous.like + 1)
          expect(grown.status).toEqual([])
          expect(joined.state.gold).toBe(restored.state.gold - room.price)
          expect(
            joined.state.members.find((member) => member.id === out)
          ).toEqual(beforeSwap.members.find((member) => member.id === out))
        }
      })
