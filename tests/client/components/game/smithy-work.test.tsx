// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
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
import { fullRun } from "@/tests/full-run"

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

type Scenario = (typeof cases)[number]
/** 最後の強化の段。この強化で最大になる。 */
const lastStep = smithy.upgrades.length
const kindOf = (recipe: Scenario["recipe"]) =>
  definition.catalog.good(recipe.good)?.kind

/**
 * ふだんの実行（`vp test run`）で回す代表。全件は `vp run test:full` で回す。
 * 全レシピ・全段の費用・不足・保存の復元は、エンジン側の smithy-save-roundtrip.test.ts がふだんから回す。
 * - 生産：費用はレシピごとに違うので、どのレシピも成功とお金・素材ごとの不足を全部回す。
 * - 強化：費用と不足の判定は品物によらず段ごとに共通。全段・全不足は品物の種類（武器・防具など）ごとに
 *   最初のレシピで回し、種類ごとに段で変わる表示（攻撃力・耐久）も通す。
 *   ほかのレシピは、最初の強化と最大になる強化の成功を回す。
 * レシピや品物の種類が増えれば、データから自動で代表に入る。
 */
function representative(all: readonly Scenario[]) {
  const firstOfKind = new Map<unknown, string>()
  for (const scenario of all)
    if (!firstOfKind.has(kindOf(scenario.recipe)))
      firstOfKind.set(kindOf(scenario.recipe), scenario.recipe.id)
  const everyStage = new Set(firstOfKind.values())
  return all.filter(
    (scenario) =>
      scenario.step === 0 ||
      everyStage.has(scenario.recipe.id) ||
      (scenario.mode === "ready" &&
        (scenario.step === 1 || scenario.step === lastStep))
  )
}
const selected = fullRun ? cases : representative(cases)

test.each(selected)(
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
      // 鍛冶屋の行と操作の札は場面（main）の中にある。場面の外の隊列の札・バッグは名前を調べない
      const scene = within(screen.getByRole("main", { name: "場面" }))
      const row =
        input.type === "craft"
          ? game.queries
              .smithyRecipes(game.state)!
              .find((entry) => entry.recipe === scenario.recipe.id)!
          : game.queries
              .smithyUpgrades(game.state)!
              .find((entry) => entry.gear === input.gear)!
      expect(row.ready).toBe(scenario.mode === "ready")
      // 一覧の行は最初の描画で並ぶ（render の act で反映済み）ので待たない
      fireEvent.click(scene.getByRole("button", { name: row.name }))
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
        fireEvent.click(scene.getByRole("button", { name: label }))
        expect(control.send(input)).toBeInstanceOf(GameCommandError)
        expect(game.save()).toEqual(before)
        expect(storage.read()).toBe(previous)
        expect(screen.queryByRole("status")).toBeNull()
        return
      }
      fail = true
      await act(async () => {
        fireEvent.click(scene.getByRole("button", { name: label }))
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
        expect(scene.queryByRole("button", { name: /にする$/ })).toBeNull()
      for (const material of scenario.cost.materials)
        expect(
          Bag.count(ready.bag, material.good) -
            Bag.count(game.state.bag, material.good)
        ).toBe(material.count)
      expect(storage.read()).toBe(previous)
      const completed = game.save()
      const again = scene.queryByRole("button", { name: /足りない/ })
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

// 作品データが変わっても、ふだんの代表が空になったり分岐の種類を落としたりしていないか
test("default slice keeps every smithy branch class", () => {
  const slice = representative(cases)
  const classes = (
    list: readonly Scenario[],
    key: (scenario: Scenario) => string | null
  ) => [...new Set(list.map(key).filter((value) => value !== null))].sort()
  expect(slice.length).toBeGreaterThan(0)
  for (const key of [
    // 生産・強化それぞれの、成功・お金の不足・素材の不足
    (scenario: Scenario) =>
      `${scenario.action.type}/${scenario.mode === "ready" || scenario.mode === "gold" ? scenario.mode : "material"}`,
    // 品物の種類ごとの、全段・全不足
    (scenario: Scenario) =>
      `${kindOf(scenario.recipe)}/${scenario.step}/${scenario.mode}`,
    // どのレシピも、生産の全不足と、最初の強化・最大になる強化の成功
    (scenario: Scenario) =>
      scenario.step === 0 ||
      (scenario.mode === "ready" &&
        (scenario.step === 1 || scenario.step === lastStep))
        ? `${scenario.recipe.id}/${scenario.step}/${scenario.mode}`
        : null,
  ])
    expect(classes(slice, key)).toEqual(classes(cases, key))
})
