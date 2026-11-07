import { expect, it } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { realContent } from "@/lib/wiz/testing/real-content"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { Bag } from "@/lib/wiz/rules/bag"
import type { GameState } from "@/lib/wiz/state/state-schema"

const definition = new GameDefinition(realContent())
const smithy = definition.catalog.data.smithy!
it.each(smithy.recipes)(
  "$id: crafting and every upgrade survive save resumption without partial payment",
  (recipe) => {
    const good = definition.catalog.good(recipe.good)!
    expect(["weapon", "armor"]).toContain(good.kind)
    const costs = [recipe, ...smithy.upgrades]
    const stock = new Map<string, number>()
    let gold = 0
    for (const cost of costs) {
      gold += cost.gold
      for (const material of cost.materials)
        stock.set(
          material.good,
          (stock.get(material.good) ?? 0) + material.count
        )
    }
    const initial = definition.initialState()
    // Supplies and town access are local conditions; the item and its plus levels come from real actions.
    let game = definition.create(testEnvironment({ random: 0.5 }), {
      ...initial,
      hero: { ...initial.hero, registrationPending: false },
      phase: { type: "town" },
      gold,
      bag: [...stock].map(([good, count]) => ({ good, count })),
    })
    const craft = { type: "craft" as const, recipe: recipe.id }
    const craftRow = game.queries
      .smithyRecipes(game.state)!
      .find((row) => row.recipe === recipe.id)!
    expect(craftRow.ready).toBe(true)
    expect(craftRow.gold).toBe(recipe.gold)
    const operations = [recipe, ...smithy.upgrades]
    let gearId: string | null = null
    for (const [index, cost] of operations.entries()) {
      const before = game.state
      const request = gearId
        ? { type: "upgrade" as const, gear: gearId }
        : craft
      const shortages = [
        ...(cost.gold > 0 ? [{ ...before, gold: cost.gold - 1 }] : []),
        ...cost.materials.map((material) => ({
          ...before,
          bag: [
            ...before.bag.filter((entry) => entry.good !== material.good),
            ...(material.count > 1
              ? [{ good: material.good, count: material.count - 1 }]
              : []),
          ],
        })),
      ]
      for (const state of shortages) {
        const denied = definition.create(testEnvironment(), state)
        const saved = denied.save()
        const row = gearId
          ? denied.queries
              .smithyUpgrades(denied.state)!
              .find((entry) => entry.gear === gearId)
          : denied.queries
              .smithyRecipes(denied.state)!
              .find((entry) => entry.recipe === recipe.id)
        expect(row?.ready).toBe(false)
        expect(denied.send(request)).toBeInstanceOf(GameCommandError)
        expect(denied.save()).toEqual(saved)
      }
      if (gearId) {
        const row = game.queries
          .smithyUpgrades(before)!
          .find((entry) => entry.gear === gearId)!
        expect(row).toMatchObject({
          ready: true,
          plus: index - 1,
          gold: cost.gold,
          max: false,
        })
        expect(
          row.materials.map((entry) => ({
            good: entry.good,
            count: entry.count,
          }))
        ).toEqual(cost.materials)
      }
      eventsOrThrow(game.send(request))
      if (!gearId) gearId = game.state.gear.at(-1)!.id
      const gear = game.state.gear.find((entry) => entry.id === gearId)!
      expect(gear).toMatchObject({
        good: good.id,
        plus: index,
        progress: 0,
        wear: 0,
        owner: null,
      })
      expect(game.state.gold).toBe(before.gold - cost.gold)
      for (const id of stock.keys()) {
        const spent = cost.materials
          .filter((entry) => entry.good === id)
          .reduce((sum, entry) => sum + entry.count, 0)
        expect(Bag.count(game.state.bag, id)).toBe(
          Bag.count(before.bag, id) - spent
        )
      }
      const expected: GameState = {
        ...before,
        gold: before.gold - cost.gold,
        bag: game.state.bag,
        gear:
          index === 0
            ? [...before.gear, gear]
            : before.gear.map((entry) =>
                entry.id === gearId ? { ...entry, plus: index } : entry
              ),
      }
      expect(game.state).toEqual(expected)
      const saved = game.save()
      const view = game.queries
        .smithyUpgrades(game.state)!
        .find((entry) => entry.gear === gearId)
      game = definition.create(testEnvironment({ random: 0.5 }))
      expect(game.restore(JSON.parse(JSON.stringify(saved)))).toBeUndefined()
      expect(game.state).toEqual(expected)
      expect(
        game.queries
          .smithyUpgrades(game.state)!
          .find((entry) => entry.gear === gearId)
      ).toEqual(view)
    }
    expect(game.state.gold).toBe(0)
    expect(game.state.bag).toEqual([])
    const max = game.queries
      .smithyUpgrades(game.state)!
      .find((entry) => entry.gear === gearId)!
    expect(max).toMatchObject({
      plus: smithy.upgrades.length,
      ready: false,
      max: true,
      next: null,
    })
    const final = game.save()
    expect(game.send({ type: "upgrade", gear: gearId! })).toMatchObject({
      code: "MAX",
    })
    expect(game.save()).toEqual(final)
  }
)
