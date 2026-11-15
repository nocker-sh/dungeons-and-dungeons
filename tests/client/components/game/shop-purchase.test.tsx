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
import { fullRun } from "@/tests/full-run"

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
type Sale = (typeof cases)[number]

/** 一覧の行と購入後の増え方が分かれる品物の種類。召喚石は個数で増えるので、素材とは別に数える。 */
const kindOf = (sale: Sale) => (sale.good.stones ? "stones" : sale.good.kind)
const unlockOf = (sale: Sale) => sale.good.unlock ?? 0
/** 局所的な初期条件の到達層。解放前は解放される層の一つ手前。 */
const reachedOf = (sale: Sale) =>
  unlockOf(sale) - (sale.mode === "locked" ? 1 : 0)
/** 解放が最も遅い（late）か最も早い組み合わせを、並び順で最初の1件だけ返す。 */
const byUnlock = (sales: readonly Sale[], late: boolean) => {
  const unlocks = sales.map(unlockOf)
  const unlock = late ? Math.max(...unlocks) : Math.min(...unlocks)
  return sales.filter((sale) => unlockOf(sale) === unlock).slice(0, 1)
}

/**
 * ふだんの `vp test run` で回す代表。同じ店の画面操作は品物ごとに同じ処理を通り、行のデータと文言だけが違う。
 * 店ごとに、並ぶ品物の種類（武器・防具・袋の品物・素材・召喚石）を1件ずつ実際に買い、所持金不足と（解放条件のある品があれば）解放前も1件ずつ確かめる。
 * 購入は種類ごとに解放が最も遅い品で行うので、その店の全商品の行が一度は並ぶ。
 * 所持金不足は最初から並ぶ品（最初の一覧）、解放前は最も遅く解放される品（最後の段の一つ手前の一覧）で確かめる。
 * 店・種類・解放段は作品データから選ぶので、新しい店や種類が増えれば代表にも入る。
 * 全店・全商品・全状況の画面操作は `vp run test:full` で回す。品物ごとの購入判定・保存再開・売却は
 * `shop-save-roundtrip.test.ts` がふだんから全件確かめる。
 */
function representative(all: readonly Sale[]) {
  const picks = new Set(
    [...new Set(all.map((sale) => sale.shop))].flatMap((shop) => {
      const own = all.filter((sale) => sale.shop === shop)
      const inMode = (mode: string) => own.filter((sale) => sale.mode === mode)
      return [
        ...[...new Set(own.map(kindOf))].flatMap((kind) =>
          byUnlock(
            inMode("ready").filter((sale) => kindOf(sale) === kind),
            true
          )
        ),
        ...byUnlock(inMode("short"), false),
        ...byUnlock(inMode("locked"), true),
      ]
    })
  )
  return all.filter((sale) => picks.has(sale))
}
const selected = fullRun ? cases : representative(cases)

test("ふだん回す代表は、全店の全状況・品物の種類ごとの購入・最初と最後の一覧を含む", () => {
  const slice = representative(cases)
  const shops = new Set(cases.map((sale) => sale.shop))
  expect(slice.length).toBeGreaterThan(0)
  expect(new Set(slice.map((sale) => sale.shop))).toEqual(shops)
  for (const shop of shops) {
    const own = cases.filter((sale) => sale.shop === shop)
    const picked = slice.filter((sale) => sale.shop === shop)
    expect(new Set(picked.map((sale) => sale.mode)), shop).toEqual(
      new Set(own.map((sale) => sale.mode))
    )
    expect(
      new Set(picked.filter((sale) => sale.mode === "ready").map(kindOf)),
      shop
    ).toEqual(new Set(own.map(kindOf)))
    // 全商品の行が並ぶ一覧（最後の解放段）と、最初から並ぶ一覧の両方を開く
    const reached = picked.map(reachedOf)
    expect(reached, shop).toContain(Math.max(...own.map(unlockOf)))
    expect(reached, shop).toContain(Math.min(...own.map(unlockOf)))
  }
})

// 画面の検査は行を品物の名前で探す。全件なら名前が重なった時点で行の検索が失敗するが、
// 代表では選んだ品の名前しか探さないので、店ごとの名前の重なりはデータから全件確かめる。
test("店ごとに、並ぶ品物の名前は重ならない", () => {
  for (const shop of definition.catalog.data.shops) {
    const names = shop.goods.map((id) => definition.catalog.good(id)!.name)
    expect(
      names.filter((name, index) => names.indexOf(name) !== index),
      shop.id
    ).toEqual([])
  }
})

test.each(selected)(
  "$shop/$good.id/$mode: actual shop controls agree with purchase rules and saved progress",
  async (sale) => {
    const price = sale.good.price!
    expect(price).toBeGreaterThan(0)
    const ready = {
      ...initial,
      reached: reachedOf(sale),
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
