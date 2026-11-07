import { expect, test } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { aState } from "@/lib/wiz/testing/state-builder"
import { realContent } from "@/lib/wiz/testing/real-content"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import { contentId } from "@/lib/wiz/testing/content-id"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

const content = realContent()
const definition = new GameDefinition(content)

for (const good of content.goods.filter((entry) => entry.kind === "item"))
  for (const expedition of [false, true])
    test(`${good.id}: field use and saved return preserve stock and effects, expedition=${expedition}`, () => {
      if (!good.effect) throw new Error(`${good.id}: missing item effect`)
      const effect = good.effect
      const allowed = ["heal", "refill", "cure", "revive"].includes(effect.type)
      const ally = contentId("alda")
      const skill = contentId("helmsplit")
      // Carried goods, injuries and spent skills are local conditions, not an exploration route.
      const builder = aState(definition.catalog)
        .withBag([{ good: good.id, count: 2 }])
        .withMember("alda", {
          hp: effect.type === "revive" ? 0 : 1,
          used: effect.type === "refill" ? [{ skill, count: 3 }] : [],
          status:
            effect.type === "cure"
              ? effect.kinds.map((kind) => ({ kind, turns: 3 }))
              : [],
        })
      const initial = (expedition ? builder.inExpedition() : builder).build()
      const game = definition.create(testEnvironment(), initial)
      expect(
        game.queries.items(game.state).find((entry) => entry.id === good.id)
      ).toMatchObject({ count: 2, field: allowed })
      const before = game.state
      const snapshot = game.save()
      const action = { type: "use" as const, good: good.id, member: ally }
      if (!allowed) {
        expect(game.send(action)).toMatchObject({ code: "UNAVAILABLE" })
        expect(game.save()).toEqual(snapshot)
        return
      }
      expect(game.send({ ...action, member: "missing" })).toMatchObject({
        code: "NO_TARGET",
      })
      expect(game.save()).toEqual(snapshot)
      const resumed = definition.create(testEnvironment(), initial)
      expect(
        resumed.restore(JSON.parse(JSON.stringify(snapshot)))
      ).toBeUndefined()
      const events = eventsOrThrow(game.send(action))
      expect(eventsOrThrow(resumed.send(action))).toEqual(events)
      expect(resumed.state).toEqual(game.state)
      const maximum = game.queries
        .party(game.state)
        .find((member) => member.id === ally)!.maxHp
      const members = before.members.map((member) => {
        if (member.id !== ally) return member
        if (effect.type === "heal" || effect.type === "revive")
          return { ...member, hp: Math.min(maximum, member.hp + effect.hp) }
        if (effect.type === "cure") return { ...member, status: [] }
        if (effect.type === "refill")
          return {
            ...member,
            used: effect.uses >= 3 ? [] : [{ skill, count: 3 - effect.uses }],
          }
        throw new Error("Unhandled field effect")
      })
      expect(game.state).toEqual({
        ...before,
        members,
        bag: [{ good: good.id, count: 1 }],
        ...(expedition ? { provisions: [{ good: good.id, count: 1 }] } : {}),
      })
      const previousMember = before.members.find(
        (member) => member.id === ally
      )!
      const updatedMember = members.find((member) => member.id === ally)!
      expect(events).toEqual([
        {
          type: "used",
          good: good.id,
          results: [
            {
              target: { kind: "member", id: ally },
              ...(effect.type === "heal" || effect.type === "revive"
                ? { heal: updatedMember.hp - previousMember.hp }
                : {}),
              ...(effect.type === "revive" ? { revived: true } : {}),
              ...(effect.type === "refill"
                ? { refill: Math.min(3, effect.uses) }
                : {}),
              ...(effect.type === "cure" ? { cured: effect.kinds } : {}),
            },
          ],
        },
      ])
      const after = definition.create(testEnvironment(), initial)
      expect(
        after.restore(JSON.parse(JSON.stringify(game.save())))
      ).toBeUndefined()
      expect(after.state).toEqual(game.state)
      expect(after.queries.items(after.state)).toEqual(
        game.queries.items(game.state)
      )
      expect(after.queries.party(after.state)).toEqual(
        game.queries.party(game.state)
      )
      expect(after.queries.supplies(after.state)).toEqual(
        game.queries.supplies(game.state)
      )
      expect(after.queries.problems(after.state)).toEqual([])
      if (expedition) {
        expect(eventsOrThrow(after.send({ type: "retreat" }))[0]).toMatchObject(
          { type: "returned", bonus: 0 }
        )
        expect(after.state.bag).toEqual([{ good: good.id, count: 1 }])
        const returned = after.save()
        expect(
          after.restore(JSON.parse(JSON.stringify(returned)))
        ).toBeUndefined()
        expect(after.send({ type: "retreat" })).toMatchObject({
          code: "WRONG_PHASE",
        })
        expect(after.save()).toEqual(returned)
      }
    })
