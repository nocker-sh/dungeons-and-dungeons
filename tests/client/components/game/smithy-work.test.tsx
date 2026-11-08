// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test"
import { useState } from "react"
import { playback } from "@/client/components/canvas/playback"
import { Shell } from "@/client/components/game/shell"
import { SmithyMenus } from "@/client/components/screens/shop/smithy-menus"
import { FxStore } from "@/client/components/stage/fx/store"
import { GameProvider } from "@/client/contexts/game-provider"
import { connectSave } from "@/client/game/connect-save"
import { MemoryStorage } from "@/client/game/memory-storage"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { Bag } from "@/lib/wiz/rules/bag"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { realContent } from "@/lib/wiz/testing/real-content"
import { startedState } from "@/lib/wiz/testing/started-state"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"

type Props = { menu: "craft" | "upgrade" }
function SmithySurface(props: Props) {
  const [notice, setNotice] = useState("")
  return (
    <SmithyMenus
      menu={props.menu}
      notice={notice}
      onNotice={setNotice}
      onClose={() => {}}
    />
  )
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  vi.spyOn(FxStore.prototype, "add").mockImplementation(() =>
    playback(Promise.resolve(), () => {})
  )
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const definition = new GameDefinition(realContent())
const initial = startedState(definition)
const smithy = definition.catalog.data.smithy!
const cases = smithy.recipes.flatMap((recipe) => {
  const costs = [recipe, ...smithy.upgrades]
  const stock = new Map<string, number>()
  for (const cost of costs)
    for (const material of cost.materials)
      stock.set(material.good, (stock.get(material.good) ?? 0) + material.count)
  // Town access and supplies are local conditions. Each later gear stage is made by actual commands.
  const preparation = definition.create(testEnvironment(), {
    ...initial,
    gear: [],
    gold: costs.reduce((sum, cost) => sum + cost.gold, 0),
    bag: [...stock].map(([good, count]) => ({ good, count })),
  })
  let gear: string | null = null
  return costs.flatMap((cost, step) => {
    const ready = preparation.state
    const action = gear
      ? { type: "upgrade" as const, gear }
      : { type: "craft" as const, recipe: recipe.id }
    const variants = [
      "ready",
      ...(cost.gold > 0 ? ["gold"] : []),
      ...cost.materials.map((material) => material.good),
    ]
    const rows = variants.map((mode) => ({
      recipe,
      step,
      cost,
      mode,
      ready,
      action,
    }))
    eventsOrThrow(preparation.send(action))
    if (!gear) gear = preparation.state.gear.at(-1)!.id
    return rows
  })
})

test.each(cases)(
  "$recipe.id/step=$step/$mode: real smithy controls preserve the operation, costs and save resumption",
  async (scenario) => {
    const input = scenario.action
    const ready = {
      ...scenario.ready,
      gold: scenario.cost.gold - (scenario.mode === "gold" ? 1 : 0),
      bag: scenario.cost.materials.flatMap((material) => {
        const count = material.count - (scenario.mode === material.good ? 1 : 0)
        return count ? [{ good: material.good, count }] : []
      }),
    }
    const game = definition.create(testEnvironment(), ready)
    const control = definition.create(testEnvironment(), ready)
    const storage = new MemoryStorage()
    storage.write(JSON.stringify(game.save()))
    const previous = storage.read()
    const write = storage.write.bind(storage)
    let fail = false
    vi.spyOn(storage, "write").mockImplementation((value) => {
      if (fail) throw Error("Storage unavailable")
      write(value)
    })
    const session = connectSave(game, storage)
    expect(session.status).toBe("restored")
    try {
      const menu = input.type === "craft" ? "craft" : "upgrade"
      render(
        <GameProvider game={game}>
          <Shell
            game={game}
            unreadable={null}
            onDiscard={async () => {}}
            saveFailed={false}
            preview={{
              screen: { name: "shop", shop: "smithy" },
              render: <SmithySurface menu={menu} />,
            }}
          />
        </GameProvider>
      )
      const row =
        input.type === "craft"
          ? game.queries
              .smithyRecipes(game.state)!
              .find((entry) => entry.recipe === scenario.recipe.id)!
          : game.queries
              .smithyUpgrades(game.state)!
              .find((entry) => entry.gear === input.gear)!
      expect(row.ready).toBe(scenario.mode === "ready")
      fireEvent.click(await screen.findByRole("button", { name: row.name }))
      const before = game.save()
      const label =
        scenario.mode === "gold"
          ? "お金が足りない"
          : scenario.mode !== "ready"
            ? "素材が足りない"
            : input.type === "craft"
              ? "作る"
              : `${game.queries.smithyUpgrades(game.state)!.find((entry) => entry.gear === input.gear)!.next!.name}にする`
      if (scenario.mode !== "ready") {
        fireEvent.click(screen.getByRole("button", { name: label }))
        expect(control.send(input)).toBeInstanceOf(GameCommandError)
        expect(game.save()).toEqual(before)
        expect(storage.read()).toBe(previous)
        expect(screen.queryByRole("status")).toBeNull()
        return
      }
      fail = true
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: label }))
      })
      eventsOrThrow(control.send(input))
      expect(game.save()).toEqual(control.save())
      expect(game.state.gold).toBe(0)
      expect(game.state.bag).toEqual([])
      const gear =
        input.type === "upgrade" ? input.gear : game.state.gear.at(-1)!.id
      expect(game.state.gear.find((entry) => entry.id === gear)).toMatchObject({
        good: scenario.recipe.good,
        plus: scenario.step,
      })
      const upgraded = game.queries
        .smithyUpgrades(game.state)!
        .find((entry) => entry.gear === gear)!
      expect(screen.getByRole("status").textContent).toBe(
        input.type === "craft"
          ? `${row.name}を作りました。バッグから装備できます。`
          : `${upgraded.name}に強化しました。`
      )
      if (menu === "upgrade" && upgraded.max)
        expect(screen.queryByRole("button", { name: /にする$/ })).toBeNull()
      for (const material of scenario.cost.materials)
        expect(
          Bag.count(ready.bag, material.good) -
            Bag.count(game.state.bag, material.good)
        ).toBe(material.count)
      expect(storage.read()).toBe(previous)
      const completed = game.save()
      const again = screen.queryByRole("button", { name: /足りない/ })
      if (again) fireEvent.click(again)
      else
        expect(
          game.queries
            .smithyUpgrades(game.state)!
            .find((entry) => entry.gear === gear)!.max
        ).toBe(true)
      expect(game.save()).toEqual(completed)
      expect(storage.read()).toBe(previous)
      fail = false
      await act(async () => {
        await session.retrySave!()
      })
      expect(JSON.parse(storage.read()!)).toEqual(completed)
      const restored = definition.create(testEnvironment())
      const resumed = connectSave(restored, storage)
      try {
        expect(resumed.status).toBe("restored")
        expect(restored.save()).toEqual(completed)
      } finally {
        resumed.disconnect()
      }
    } finally {
      session.disconnect()
    }
  }
)
