import { expect, test } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { aState } from "@/lib/wiz/testing/state-builder"
import { realContent } from "@/lib/wiz/testing/real-content"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { contentId } from "@/lib/wiz/testing/content-id"
import { effectSpec } from "@/lib/wiz/rules/item-effect-spec"
import { Bag } from "@/lib/wiz/rules/bag"

const content = realContent()
const definition = new GameDefinition(content)
const foe = content.foes.reduce((strongest, candidate) =>
  candidate.hp > strongest.hp ? candidate : strongest
)

for (const good of content.goods.filter((entry) => entry.kind === "item"))
  test(`${good.id}: item targets, stock, effects and queries resume together`, () => {
    if (!good.effect) throw new Error(`${good.id}: missing item effect`)
    const effect = good.effect
    const spec = effectSpec(effect)
    const ally = contentId("alda")
    const initial = aState(definition.catalog)
      .withBag([{ good: good.id, count: 2 }])
      .withMember("alda", {
        hp: effect.type === "revive" ? 0 : 1,
        used:
          effect.type === "refill"
            ? [{ skill: contentId("helmsplit"), count: 3 }]
            : [],
        status:
          effect.type === "cure"
            ? effect.kinds.map((kind) => ({ kind, turns: 3 }))
            : [],
      })
      .inBattle({
        foes: [foe.id, foe.id],
        order: ["hero", "foe-1", "foe-2", "alda", "mort"],
      })
      .build()
    const actionFor = {
      type: "act" as const,
      command: "item" as const,
      good: good.id,
    }
    for (const bag of [[], initial.bag]) {
      const uncarried = definition.create(testEnvironment(), {
        ...initial,
        bag,
        provisions: [],
      })
      const before = uncarried.save()
      expect(
        uncarried.queries.commands(uncarried.state, contentId("hero"))!.items
      ).toEqual([])
      expect(uncarried.send(actionFor)).toMatchObject({ code: "NO_ITEM" })
      expect(uncarried.save()).toEqual(before)
    }
    if (["heal", "refill", "cure", "revive"].includes(effect.type)) {
      const healthy = definition.create(
        testEnvironment(),
        aState(definition.catalog)
          .withBag([{ good: good.id, count: 2 }])
          .inBattle({
            foes: [foe.id],
            order: ["hero", "foe-1", "alda", "mort"],
          })
          .build()
      )
      const before = healthy.save()
      const view = healthy.queries
        .commands(healthy.state, contentId("hero"))!
        .items.find((entry) => entry.id === good.id)
      expect(view).toMatchObject({ count: 2, usable: false, targets: [] })
      expect(healthy.send(actionFor)).toMatchObject({ code: "NO_EFFECT" })
      expect(healthy.save()).toEqual(before)
    }
    // Battle, injuries, spent skills and the carried items are local initial conditions.
    const game = definition.create(testEnvironment({ random: 0 }), initial)
    const actor = game.queries.battle(game.state)!.current.id
    const item = game.queries
      .commands(game.state, actor)!
      .items.find((entry) => entry.id === good.id)
    expect(item).toMatchObject({ count: 2, usable: true })
    const toAlly = spec.target === "ally" || spec.target === "allies"
    if (toAlly) {
      expect(item!.targets).toContain(ally)
      const before = game.save()
      expect(
        game.send({
          type: "act",
          command: "item",
          good: good.id,
          target: "missing",
        })
      ).toMatchObject({ code: "NO_EFFECT" })
      expect(game.save()).toEqual(before)
    }
    const restored = definition.create(testEnvironment({ random: 0 }), initial)
    expect(
      restored.restore(JSON.parse(JSON.stringify(game.save())))
    ).toBeUndefined()
    const action = {
      type: "act" as const,
      command: "item" as const,
      good: good.id,
      target: toAlly ? ally : "foe-1",
    }
    const events = eventsOrThrow(game.send(action))
    expect(eventsOrThrow(restored.send(action))).toEqual(events)
    expect(restored.state).toEqual(game.state)
    expect(Bag.count(game.state.bag, good.id)).toBe(1)
    expect(Bag.count(game.state.provisions ?? [], good.id)).toBe(1)
    const acted = events.find((event) => event.type === "acted")
    if (!acted || acted.type !== "acted") throw new Error("No item action")
    expect(acted).toMatchObject({
      command: "item",
      good: good.id,
      name: good.name,
    })
    expect(acted.results.length).toBeGreaterThan(0)
    if (spec.target === "self")
      expect(acted.results.map((result) => result.target.id)).toEqual([actor])
    if (spec.target === "ally")
      expect(acted.results.map((result) => result.target.id)).toEqual([ally])
    for (const result of acted.results) {
      if (effect.type === "heal" || effect.type === "revive")
        expect(result.heal).toBeGreaterThan(0)
      else if (effect.type === "refill")
        expect(result.refill).toBeGreaterThan(0)
      else if (effect.type === "damage")
        expect(result.damage).toBeGreaterThan(0)
      else if (effect.type === "cure")
        expect(result.cured).toEqual(effect.kinds)
      else if (effect.type === "status")
        expect(result.status ?? result.resisted).toBe(effect.status.kind)
      else throw new Error("Unhandled item effect")
    }
    const completed = definition.create(testEnvironment({ random: 0 }), initial)
    expect(
      completed.restore(JSON.parse(JSON.stringify(restored.save())))
    ).toBeUndefined()
    expect(completed.state).toEqual(restored.state)
    expect(completed.queries.battle(completed.state)).toEqual(
      restored.queries.battle(restored.state)
    )
    expect(completed.queries.party(completed.state)).toEqual(
      restored.queries.party(restored.state)
    )
    expect(completed.queries.commands(completed.state, actor)).toEqual(
      restored.queries.commands(restored.state, actor)
    )
    expect(completed.queries.problems(completed.state)).toEqual([])
    const before = completed.save()
    const repeated = completed.send(action)
    expect(repeated).toBeInstanceOf(GameCommandError)
    expect(repeated).toMatchObject({ code: "NOT_YOUR_TURN" })
    expect(completed.save()).toEqual(before)
  })
