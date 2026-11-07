import { expect, test } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import type { Game } from "@/lib/wiz/game/game"
import { slotOf } from "@/lib/wiz/content/slot-of"
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
let builder = aState(definition.catalog)
for (const member of members)
  if (!builder.build().members.some((entry) => entry.id === member.id))
    builder = builder.withJoined(member.id)
const roster = builder.build()

function displayed(game: Game, id: string) {
  const member = game.queries.member(game.state, id)!
  return {
    hp: member.hp,
    maxHp: member.maxHp,
    str: member.str,
    tec: member.tec,
    spd: member.spd,
    attack: member.weapon?.attack ?? 1,
    durability: member.armor?.durability ?? 0,
    maxDurability: member.armor?.maxDurability ?? 0,
  }
}

for (const armor of content.goods.filter((good) => good.kind === "armor"))
  for (const target of members)
    test(`${armor.id}: ${target.id}, preview and actual armor transfer survive restoration`, () => {
      const accepts = (member: typeof target) =>
        !member.hero &&
        !member.pact &&
        !(member.unique && member.fixedArmor) &&
        (!armor.allowedJobs || armor.allowedJobs.includes(member.job))
      const donor = members.find(
        (member) => member.id !== target.id && accepts(member)
      )
      // A complete roster, an owned worn armor and full HP are local starting conditions.
      const initial = {
        ...roster,
        gear: [
          ...roster.gear.filter(
            (gear) =>
              gear.owner !== donor?.id ||
              slotOf(definition.catalog.good(gear.good)!) !== slotOf(armor)
          ),
          {
            id: "tested-armor",
            good: armor.id,
            owner: donor?.id ?? null,
            plus: 1,
            progress: 0,
            wear: 3,
            weapon: null,
          },
        ],
      }
      const setup = definition.create(testEnvironment(), initial)
      const game = definition.create(
        testEnvironment({
          random: () => {
            throw Error("Equipment must not draw randomness")
          },
        }),
        {
          ...initial,
          members: initial.members.map((member) => ({
            ...member,
            hp: setup.queries.member(setup.state, member.id)!.maxHp,
          })),
        }
      )
      const beforeState = game.state
      const before = game.save()
      const options = game.queries.equipOptions(game.state, target.id)
      const comparison = game.queries.armorComparison(
        game.state,
        target.id,
        "tested-armor"
      )
      expect(options.some((entry) => entry.gear === "tested-armor")).toBe(
        accepts(target)
      )
      expect(comparison !== null).toBe(accepts(target))
      expect(game.save()).toEqual(before)
      const action = {
        type: "equip" as const,
        member: target.id,
        gear: "tested-armor",
      }
      if (!accepts(target)) {
        expect(game.send(action)).toMatchObject({
          code:
            target.pact || (target.unique && target.fixedArmor)
              ? "FIXED_GEAR"
              : "WRONG_JOB",
        })
        expect(game.save()).toEqual(before)
        const restored = definition.create(testEnvironment(), roster)
        expect(
          restored.restore(JSON.parse(JSON.stringify(before)))
        ).toBeUndefined()
        expect(restored.send(action)).toEqual(game.send(action))
        expect(restored.save()).toEqual(before)
        return
      }
      expect(comparison!.before).toEqual(displayed(game, target.id))
      if (donor)
        expect(comparison!.previousOwner!.before).toEqual(
          displayed(game, donor.id)
        )
      const events = eventsOrThrow(game.send(action))
      expect(events[0]).toMatchObject({
        type: "equipped",
        gear: "tested-armor",
        member: target.id,
      })
      expect(comparison!.after).toEqual(displayed(game, target.id))
      if (donor)
        expect(comparison!.previousOwner!.after).toEqual(
          displayed(game, donor.id)
        )
      expect(game.state).toEqual({
        ...beforeState,
        gear: beforeState.gear.map((gear) =>
          gear.id === "tested-armor"
            ? { ...gear, owner: target.id }
            : gear.owner === target.id &&
                slotOf(definition.catalog.good(gear.good)!) === slotOf(armor)
              ? { ...gear, owner: null }
              : gear
        ),
        members: beforeState.members.map((member) => ({
          ...member,
          hp: Math.min(
            member.hp,
            game.queries.member(game.state, member.id)!.maxHp
          ),
        })),
      })
      const equipped = game.save()
      expect(game.send(action)).toMatchObject({ code: "ALREADY" })
      expect(game.save()).toEqual(equipped)
      const restored = definition.create(testEnvironment(), roster)
      expect(
        restored.restore(JSON.parse(JSON.stringify(equipped)))
      ).toBeUndefined()
      expect(restored.state).toEqual(game.state)
      expect(displayed(restored, target.id)).toEqual(comparison!.after)
      const removal = restored.queries.armorRemovalComparison(
        restored.state,
        "tested-armor"
      )!
      expect(removal.before).toEqual(displayed(restored, target.id))
      const removalState = restored.state
      eventsOrThrow(restored.send({ type: "unequip", gear: "tested-armor" }))
      expect(removal.after).toEqual(displayed(restored, target.id))
      expect(restored.state).toEqual({
        ...removalState,
        gear: removalState.gear.map((gear) =>
          gear.id === "tested-armor" ? { ...gear, owner: null } : gear
        ),
        members: removalState.members.map((member) => ({
          ...member,
          hp: Math.min(
            member.hp,
            restored.queries.member(restored.state, member.id)!.maxHp
          ),
        })),
      })
      const removed = restored.save()
      expect(
        restored.send({ type: "unequip", gear: "tested-armor" })
      ).toMatchObject({ code: "ALREADY" })
      expect(restored.save()).toEqual(removed)
      expect(game.restore(JSON.parse(JSON.stringify(removed)))).toBeUndefined()
      expect(game.state).toEqual(restored.state)
    })
