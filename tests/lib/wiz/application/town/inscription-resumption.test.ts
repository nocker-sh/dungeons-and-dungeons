import { expect, test } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { realContent } from "@/lib/wiz/testing/real-content"
import { aState } from "@/lib/wiz/testing/state-builder"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

const content = realContent()
const definition = new GameDefinition(content)
const roster = aState(definition.catalog).build()
const book = content.smithy!.skillBook!
const noDraws = () =>
  testEnvironment({
    random: () => {
      throw Error("Inscription cannot draw randomness")
    },
    ids: () => {
      throw Error("Inscription cannot allocate gear")
    },
  })

for (const good of content.goods.filter((entry) => entry.kind === "weapon"))
  for (const owner of [
    null,
    ...roster.members
      .filter(
        (member) =>
          definition.catalog.canEquip(member.id, good.id) &&
          !definition.rules.party.equipment.isSlotFixed(member, "weapon")
      )
      .slice(0, 1)
      .map((member) => member.id),
  ])
    for (const slot of [1, 2])
      test(`${good.id}: owner=${owner}, slot ${slot}, every offered inscription and refusal survives JSON restoration`, () => {
        const weapon = definition.rules.weapons.forGood(good, () => 0.5)!
        const gear = {
          id: "inscription-target",
          good: good.id,
          plus: 2,
          progress: 0,
          wear: 0,
          owner,
          weapon,
        }
        // An owned weapon, two books and previously used skills are local starting conditions.
        const initial = {
          ...roster,
          gear: [
            ...roster.gear.filter(
              (entry) =>
                entry.owner !== owner ||
                definition.catalog.good(entry.good)?.kind !== "weapon"
            ),
            gear,
          ],
          bag: [{ good: book, count: 2 }],
          members: roster.members.map((member) => {
            const skill = definition.rules.party.skills
              .battleSkills(member, roster)
              .find(
                (id) =>
                  (definition.rules.party.skills.maxUses(member, roster, id) ??
                    0) > 0
              )
            return skill ? { ...member, used: [{ skill, count: 1 }] } : member
          }),
        }
        const probe = definition.create(noDraws(), initial)
        const before = probe.save()
        const row = probe.queries
          .inscriptions(probe.state)!
          .inscriptions.find((entry) => entry.gear === gear.id)!
        const expected = definition.rules.weapons
          .pool(good)
          .filter((id) => !weapon.skills.includes(id))
        expect(row.candidates.map((entry) => entry.id)).toEqual(expected)
        expect(probe.save()).toEqual(before)
        const invalid = new Set([
          ...weapon.skills,
          ...content.skills
            .filter((entry) => entry.blessing)
            .map((entry) => entry.id),
          "unknown-skill",
        ])
        for (const skill of invalid) {
          expect(
            probe.send({ type: "inscribe", gear: gear.id, slot, skill })
          ).toMatchObject({
            code:
              weapon.skills.includes(skill) &&
              definition.rules.weapons.pool(good).includes(skill)
                ? "ALREADY"
                : "UNAVAILABLE",
          })
          expect(probe.save()).toEqual(before)
        }
        expect(
          probe.sendUnknown({
            type: "inscribe",
            gear: gear.id,
            slot: 0,
            skill: weapon.skills[0],
          })
        ).toMatchObject({ code: "INVALID_ACTION" })
        expect(probe.save()).toEqual(before)
        for (const skill of expected) {
          const request = {
            type: "inscribe" as const,
            gear: gear.id,
            slot,
            skill,
          }
          const short = definition.create(noDraws(), { ...initial, bag: [] })
          const savedShort = short.save()
          expect(short.send(request)).toMatchObject({ code: "NO_MATERIALS" })
          expect(short.save()).toEqual(savedShort)
          const game = definition.create(noDraws(), initial)
          const resumed = definition.create(noDraws(), roster)
          expect(
            resumed.restore(JSON.parse(JSON.stringify(game.save())))
          ).toBeUndefined()
          const events = eventsOrThrow(game.send(request))
          expect(events).toEqual([
            { type: "inscribed", gear: gear.id, slot, skill },
          ])
          expect(eventsOrThrow(resumed.send(request))).toEqual(events)
          const skills = weapon.skills.map((id, index) =>
            index === slot ? skill : id
          )
          expect(game.state).toEqual({
            ...initial,
            bag: [{ good: book, count: 1 }],
            gear: initial.gear.map((entry) =>
              entry.id === gear.id
                ? { ...gear, weapon: { ...weapon, skills } }
                : entry
            ),
          })
          expect(resumed.state).toEqual(game.state)
          const after = game.save()
          expect(game.send(request)).toMatchObject({ code: "ALREADY" })
          expect(game.save()).toEqual(after)
          expect(
            resumed.restore(JSON.parse(JSON.stringify(after)))
          ).toBeUndefined()
          expect(resumed.state).toEqual(game.state)
          expect(resumed.queries.inscriptions(resumed.state)!.books).toBe(1)
          const updated = resumed.queries
            .inscriptions(resumed.state)!
            .inscriptions.find((entry) => entry.gear === gear.id)!
          expect(updated.candidates.some((entry) => entry.id === skill)).toBe(
            false
          )
          expect(
            updated.candidates.some((entry) => entry.id === weapon.skills[slot])
          ).toBe(true)
          expect(resumed.send(request)).toMatchObject({ code: "ALREADY" })
          expect(resumed.save()).toEqual(after)
        }
      })
