import { expect, it } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { realContent } from "@/lib/wiz/testing/real-content"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { Bag } from "@/lib/wiz/rules/bag"

it("全ての本番契約を実際の出会い・保存再開・支払いで辿り、一度だけ仲間にする", () => {
  const definition = new GameDefinition(realContent())
  const contracts = definition.catalog.data.demons.filter(
    (demon) => demon.contract
  )
  expect(contracts.length).toBeGreaterThan(0)
  const stock = new Map<string, number>()
  let gold = 0
  let stones = 0
  for (const demon of contracts) {
    const cost = demon.contract!
    expect(cost.paper).toBeDefined()
    stock.set(cost.paper!, (stock.get(cost.paper!) ?? 0) + 1)
    for (const material of cost.materials)
      stock.set(material.good, (stock.get(material.good) ?? 0) + material.count)
    gold += cost.gold
    stones += cost.stones ?? 0
  }
  const initial = definition.initialState()
  // Registration, reached layer and supplies are local conditions; encounter flags are never injected.
  let game = definition.create(testEnvironment({ random: 0 }), {
    ...initial,
    hero: { ...initial.hero, registrationPending: false },
    phase: { type: "town" },
    reached: definition.catalog.data.layers.length - 1,
    gold,
    stones,
    bag: [...stock].map(([good, count]) => ({ good, count })),
  })
  const remaining = new Set(contracts.map((demon) => demon.id))
  const visited = new Set<string>()
  while (remaining.size) {
    const rows = game.queries.demonContracts(game.state)
    const next = rows.find((row) => remaining.has(row.id) && row.canInvoke)
    expect(
      next,
      `No reachable encounter remains: ${[...remaining].join(",")}`
    ).toBeDefined()
    if (!next) throw new Error("Contract encounters cannot advance")
    const demon = definition.catalog.demon(next.id)!
    const cost = demon.contract!
    const encounter = definition.catalog.data.conversations!.find(
      (entry) => entry.id === cost.encounter
    )!
    const request = { type: "contract-demon" as const, demon: demon.id }
    const unintroduced = game.save()
    expect(game.send(request)).toMatchObject({ code: "NOT_READY" })
    expect(game.save()).toEqual(unintroduced)
    const before = game.state
    eventsOrThrow(game.send({ type: "invoke-demon", demon: demon.id }))
    expect(game.state.conversation?.active).toBe(encounter.id)
    expect(Bag.count(game.state.bag, cost.paper!)).toBe(
      Bag.count(before.bag, cost.paper!) - 1
    )
    expect([game.state.gold, game.state.stones, game.state.demons]).toEqual([
      before.gold,
      before.stones,
      before.demons,
    ])
    const during = game.save()
    game = definition.create(testEnvironment({ random: 0 }))
    expect(game.restore(JSON.parse(JSON.stringify(during)))).toBeUndefined()
    expect(game.send({ type: "invoke-demon", demon: demon.id })).toBeInstanceOf(
      GameCommandError
    )
    expect(game.save()).toEqual(during)
    const finish = {
      type: "finish-conversation" as const,
      ...(encounter.choice ? { choice: 0 } : {}),
    }
    eventsOrThrow(game.send(finish))
    expect(game.state.conversation?.seen).toContain(encounter.id)
    const met = game.state
    // Re-meeting a not-yet-contracted demon never consumes another paper.
    eventsOrThrow(game.send({ type: "invoke-demon", demon: demon.id }))
    expect(game.state.bag).toEqual(met.bag)
    eventsOrThrow(game.send(finish))
    expect(
      game.state.conversation?.seen.filter((id) => id === encounter.id)
    ).toHaveLength(1)
    const eligible = game.state
    expect(
      game.queries
        .demonContracts(eligible)
        .find((entry) => entry.id === demon.id)?.canContract
    ).toBe(true)
    const shortages = [
      ...(cost.gold > 0 ? [{ ...eligible, gold: cost.gold - 1 }] : []),
      ...((cost.stones ?? 0) > 0
        ? [{ ...eligible, stones: cost.stones! - 1 }]
        : []),
      ...cost.materials.map((material) => ({
        ...eligible,
        bag: [
          ...eligible.bag.filter((entry) => entry.good !== material.good),
          ...(material.count > 1
            ? [{ good: material.good, count: material.count - 1 }]
            : []),
        ],
      })),
    ]
    for (const state of shortages) {
      const denied = definition.create(testEnvironment(), state)
      const saved = denied.save()
      expect(
        denied.queries
          .demonContracts(denied.state)
          .find((entry) => entry.id === demon.id)?.canContract
      ).toBe(false)
      expect(denied.send(request)).toBeInstanceOf(GameCommandError)
      expect(denied.save()).toEqual(saved)
    }
    eventsOrThrow(game.send(request))
    expect(game.state.gold).toBe(eligible.gold - cost.gold)
    expect(game.state.stones).toBe(eligible.stones - (cost.stones ?? 0))
    const goods = new Set(
      [...eligible.bag, ...game.state.bag].map((entry) => entry.good)
    )
    for (const good of goods) {
      const spent = cost.materials
        .filter((entry) => entry.good === good)
        .reduce((sum, entry) => sum + entry.count, 0)
      expect(Bag.count(game.state.bag, good)).toBe(
        Bag.count(eligible.bag, good) - spent
      )
    }
    expect(game.state.demons).toEqual([
      ...eligible.demons,
      { id: demon.id, lv: 1, exp: 0 },
    ])
    expect(game.state.contract).toBe(eligible.contract)
    expect(game.state).toEqual({
      ...eligible,
      gold: eligible.gold - cost.gold,
      stones: eligible.stones - (cost.stones ?? 0),
      bag: game.state.bag,
      demons: [...eligible.demons, { id: demon.id, lv: 1, exp: 0 }],
    })
    const contracted = game.save()
    game = definition.create(testEnvironment({ random: 0 }))
    expect(game.restore(JSON.parse(JSON.stringify(contracted)))).toBeUndefined()
    expect(game.send(request)).toMatchObject({ code: "ALREADY" })
    expect(game.save()).toEqual(contracted)
    expect(
      game.queries
        .demonContracts(game.state)
        .some((entry) => entry.id === demon.id)
    ).toBe(false)
    remaining.delete(demon.id)
    visited.add(demon.id)
  }
  expect(visited).toEqual(new Set(contracts.map((demon) => demon.id)))
  expect(game.state.gold).toBe(0)
  expect(game.state.stones).toBe(0)
  expect(game.state.bag).toEqual([])
})
