// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test"
import { playback } from "@/client/components/canvas/playback"
import { Screens } from "@/client/components/game/screens"
import { Shell } from "@/client/components/game/shell"
import { VisitScenesContext } from "@/client/components/game/use-visit-scene"
import { Camera } from "@/client/components/stage/camera"
import { FxStore } from "@/client/components/stage/fx/store"
import { StageContext, useStage } from "@/client/components/stage/use-stage"
import { GameProvider } from "@/client/contexts/game-provider"
import { connectSave } from "@/client/game/connect-save"
import { MemoryStorage } from "@/client/game/memory-storage"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { realContent } from "@/lib/wiz/testing/real-content"
import { startedState } from "@/lib/wiz/testing/started-state"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"

type Props = { shop: string }

// Keep the actual arrival and navigation machine, replacing only scene-art output.
function ShopSurface(props: Props) {
  const stage = useStage()
  return (
    <StageContext.Provider value={{ ...stage, art: async () => {} }}>
      <VisitScenesContext.Provider value={false}>
        <Screens
          initial={{ name: "shop", shop: props.shop }}
          bag={false}
          bagClose={0}
          closeBag={() => {}}
          standing={null}
          closeStand={() => {}}
        />
      </VisitScenesContext.Provider>
    </StageContext.Provider>
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
  vi.spyOn(Camera.prototype, "establish").mockImplementation(() =>
    playback(Promise.resolve(), () => {})
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
const cases = definition.catalog.data.shops.flatMap((shop) =>
  shop.goods.flatMap((id) => {
    const good = definition.catalog.good(id)!
    return ["ready", "short", ...(good.unlock ? ["locked"] : [])].map(
      (mode) => ({ shop: shop.id, good, mode })
    )
  })
)

test.each(cases)(
  "$shop/$good.id/$mode: actual shop controls agree with purchase rules and saved progress",
  async (sale) => {
    const price = sale.good.price!
    expect(price).toBeGreaterThan(0)
    const ready = {
      ...initial,
      reached: (sale.good.unlock ?? 0) - (sale.mode === "locked" ? 1 : 0),
      gold: price - (sale.mode === "short" ? 1 : 0),
      bag: [],
    }
    const game = definition.create(testEnvironment(), ready)
    const control = definition.create(testEnvironment(), ready)
    const storage = new MemoryStorage()
    storage.write(JSON.stringify(game.save()))
    const previous = storage.read()
    const nativeWrite = storage.write.bind(storage)
    let fail = false
    vi.spyOn(storage, "write").mockImplementation((value) => {
      if (fail) throw Error("Storage unavailable")
      nativeWrite(value)
    })
    const session = connectSave(game, storage)
    expect(session.status).toBe("restored")
    try {
      render(
        <GameProvider game={game}>
          <Shell
            game={game}
            unreadable={null}
            onDiscard={async () => {}}
            saveFailed={false}
            preview={{
              screen: { name: "shop", shop: sale.shop },
              render: <ShopSurface shop={sale.shop} />,
            }}
          />
        </GameProvider>
      )
      fireEvent.click(await screen.findByRole("button", { name: "購入" }))
      const action = {
        type: "buy" as const,
        shop: sale.shop,
        good: sale.good.id,
      }
      const before = game.save()
      if (sale.mode === "locked") {
        expect(
          screen.queryByRole("button", { name: sale.good.name })
        ).toBeNull()
        expect(control.send(action)).toMatchObject({ code: "LOCKED" })
        expect(game.save()).toEqual(before)
        expect(storage.read()).toBe(previous)
        return
      }
      const offered = game.queries
        .shop(game.state, sale.shop)!
        .goods.find((entry) => entry.id === sale.good.id)!
      expect(offered.affordable).toBe(sale.mode === "ready")
      fireEvent.click(screen.getByRole("button", { name: offered.name }))
      if (sale.mode === "short") {
        fireEvent.click(screen.getByRole("button", { name: "お金が足りない" }))
        expect(control.send(action)).toMatchObject({ code: "NO_GOLD" })
        expect(game.save()).toEqual(before)
        expect(storage.read()).toBe(previous)
        return
      }
      fail = true
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: `${price}G で買う` })
        )
      })
      expect(eventsOrThrow(control.send(action))).toEqual([
        { type: "bought", good: sale.good.id, price },
      ])
      expect(game.save()).toEqual(control.save())
      expect(game.state.gold).toBe(0)
      expect(
        game.queries
          .shop(game.state, sale.shop)!
          .goods.find((entry) => entry.id === sale.good.id)!.own
      ).toBe(offered.own + (sale.good.stones ?? 1))
      expect(storage.read()).toBe(previous)
      const purchased = game.save()
      fireEvent.click(screen.getByRole("button", { name: "お金が足りない" }))
      expect(game.save()).toEqual(purchased)
      expect(storage.read()).toBe(previous)
      fail = false
      await act(async () => {
        await session.retrySave!()
      })
      expect(JSON.parse(storage.read()!)).toEqual(purchased)
      const resumed = definition.create(testEnvironment())
      const restoredSession = connectSave(resumed, storage)
      expect(resumed.save()).toEqual(purchased)
      restoredSession.disconnect()
    } finally {
      session.disconnect()
    }
  }
)
