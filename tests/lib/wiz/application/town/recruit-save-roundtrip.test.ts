import { expect, it } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { realContent } from "@/lib/wiz/testing/real-content"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { PARTY_SLOTS } from "@/lib/wiz/content/constants"

const definition = new GameDefinition(realContent())
const cases = definition.catalog.data.recruits.flatMap((recruit) =>
  [false, true].map((vacant) => ({ recruit, vacant }))
)
it.each(cases)(
  "$recruit.id / vacant=$vacant: hiring, starter ownership and equipment constraints survive reload",
  ({ recruit, vacant }) => {
    const initial = definition.initialState()
    // Registration, the offered board, funds and an optional reserve slot are local starting conditions.
    let game = definition.create(testEnvironment({ random: 0.5 }), {
      ...initial,
      hero: { ...initial.hero, registrationPending: false },
      phase: { type: "town" },
      board: [recruit.id],
      gold: recruit.price,
      party: vacant ? initial.party.slice(0, PARTY_SLOTS - 1) : initial.party,
    })
    const request = { type: "recruit" as const, recruit: recruit.id }
    const before = game.state
    const row = game.queries
      .recruits(before)
      .find((entry) => entry.id === recruit.id)
    const owned = before.members.some((entry) => entry.id === recruit.member.id)
    if (recruit.retired || owned) {
      expect(recruit.retired ? row === undefined : row?.hired).toBe(true)
      const saved = game.save()
      expect(game.send(request)).toBeInstanceOf(GameCommandError)
      expect(game.save()).toEqual(saved)
      expect(game.restore(JSON.parse(JSON.stringify(saved)))).toBeUndefined()
      return
    }
    expect(row).toMatchObject({
      hired: false,
      affordable: true,
      price: recruit.price,
      joins: before.party.length < PARTY_SLOTS,
    })
    if (recruit.price > 0) {
      const short = definition.create(testEnvironment(), {
        ...before,
        gold: recruit.price - 1,
      })
      expect(short.queries.recruits(short.state)[0].affordable).toBe(false)
      const saved = short.save()
      expect(short.send(request)).toMatchObject({ code: "NO_GOLD" })
      expect(short.save()).toEqual(saved)
    }
    const unavailable = definition.create(testEnvironment(), {
      ...before,
      board: [],
    })
    const notOffered = unavailable.save()
    expect(unavailable.send(request)).toMatchObject({ code: "UNAVAILABLE" })
    expect(unavailable.save()).toEqual(notOffered)
    eventsOrThrow(game.send(request))
    const hired = game.state.members.find(
      (entry) => entry.id === recruit.member.id
    )!
    expect(hired).toMatchObject({
      id: recruit.member.id,
      lv: recruit.member.lv,
      exp: 0,
      stats: recruit.member.stats,
    })
    expect(game.state.gold).toBe(0)
    expect(game.state.recruited).toEqual([...before.recruited, recruit.id])
    expect(game.state.members).toEqual([...before.members, hired])
    expect(game.state.party.length).toBe(
      Math.min(PARTY_SLOTS, before.party.length + 1)
    )
    expect(new Set(game.state.party)).toEqual(
      new Set(
        before.party.length < PARTY_SLOTS
          ? [...before.party, recruit.member.id]
          : before.party
      )
    )
    const starting = game.state.gear.filter(
      (entry) => entry.owner === recruit.member.id
    )
    expect(starting.map((entry) => entry.good).sort()).toEqual(
      [
        ...(recruit.member.weapon ? [recruit.member.weapon] : []),
        ...(recruit.member.gear ?? []),
      ].sort()
    )
    expect(game.state.gear).toEqual([...before.gear, ...starting])
    expect(new Set(game.state.gear.map((entry) => entry.id)).size).toBe(
      game.state.gear.length
    )
    expect(game.state).toEqual({
      ...before,
      gold: 0,
      members: [...before.members, hired],
      recruited: [...before.recruited, recruit.id],
      party: game.state.party,
      gear: [...before.gear, ...starting],
    })
    const view = game.queries.member(game.state, recruit.member.id)
    const saved = game.save()
    game = definition.create(testEnvironment({ random: 0.5 }))
    expect(game.restore(JSON.parse(JSON.stringify(saved)))).toBeUndefined()
    expect(game.queries.member(game.state, recruit.member.id)).toEqual(view)
    expect(game.queries.recruits(game.state)[0].hired).toBe(true)
    expect(game.send(request)).toMatchObject({ code: "ALREADY" })
    expect(game.save()).toEqual(saved)
    for (const gear of starting) {
      const display = game.queries
        .gear(game.state)
        .find((entry) => entry.gear === gear.id)!
      const kind = definition.catalog.good(gear.good)!.kind
      const fixed =
        !!recruit.member.unique &&
        (kind === "weapon" || !!recruit.member.fixedArmor)
      expect(display.locked).toBe(fixed)
      const before = game.save()
      if (fixed) {
        expect(game.send({ type: "unequip", gear: gear.id })).toMatchObject({
          code: "FIXED_GEAR",
        })
        expect(game.save()).toEqual(before)
        for (const member of game.state.members.filter(
          (entry) => entry.id !== recruit.member.id
        )) {
          expect(
            game.queries
              .equipOptions(game.state, member.id)
              .some((entry) => entry.gear === gear.id)
          ).toBe(false)
          expect(
            game.send({ type: "equip", gear: gear.id, member: member.id })
          ).toBeInstanceOf(GameCommandError)
          expect(game.save()).toEqual(before)
        }
      } else {
        eventsOrThrow(game.send({ type: "unequip", gear: gear.id }))
        expect(
          game.state.gear.find((entry) => entry.id === gear.id)?.owner
        ).toBeNull()
        expect(
          game.queries
            .equipOptions(game.state, recruit.member.id)
            .some((entry) => entry.gear === gear.id)
        ).toBe(true)
        eventsOrThrow(
          game.send({ type: "equip", gear: gear.id, member: recruit.member.id })
        )
        expect(game.state.gear.find((entry) => entry.id === gear.id)).toEqual(
          gear
        )
        expect(game.state.gold).toBe(0)
      }
      const equipped = game.save()
      expect(game.restore(JSON.parse(JSON.stringify(equipped)))).toBeUndefined()
      for (const member of game.state.members)
        expect(member.hp).toBeLessThanOrEqual(
          definition.rules.party.stats(member, game.state).maxHp
        )
    }
  }
)
