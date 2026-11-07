// @vitest-environment jsdom
import { act, cleanup, fireEvent, renderHook } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vite-plus/test"
import { useKeyboardNav } from "@/client/components/game/focus"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { realContent } from "@/lib/wiz/testing/real-content"
import { startedState } from "@/lib/wiz/testing/started-state"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"

const definition = new GameDefinition(realContent())
const sale = definition.catalog.data.shops
  .flatMap((shop) =>
    shop.goods.map((id) => ({
      shop: shop.id,
      good: definition.catalog.good(id)!,
    }))
  )
  .find(
    (entry) =>
      entry.good.kind === "item" &&
      entry.good.sellable !== false &&
      !entry.good.unlock &&
      entry.good.price! > 0
  )!
const roots: HTMLElement[] = []

afterEach(() => {
  cleanup()
  for (const root of roots.splice(0)) root.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function fixture() {
  const frames = new Map<number, FrameRequestCallback>()
  let serial = 0
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++serial, callback)
    return serial
  })
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id))
  const pad = {
    index: 0,
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
  }
  vi.stubGlobal("navigator", { getGamepads: () => [pad as unknown as Gamepad] })
  const initial = {
    ...startedState(definition),
    gold: sale.good.price! * 20,
    bag: [],
  }
  const game = definition.create(testEnvironment(), initial)
  const baseline = definition.create(testEnvironment(), initial)
  const buy = { type: "buy", shop: sale.shop, good: sale.good.id } as const
  const sell = { type: "sell", good: sale.good.id } as const
  // Earn the sellable item through a real purchase. Only DOM, input devices and
  // frame delivery are the environment boundary; the economy is the real engine.
  eventsOrThrow(game.send(buy))
  eventsOrThrow(baseline.send(buy))
  const root = document.createElement("div")
  root.className = "game"
  document.body.append(root)
  roots.push(root)
  let afterBuy = () => {}
  let closed = 0
  const buyButton = document.createElement("button")
  buyButton.textContent = "買う"
  buyButton.className = "word cta"
  buyButton.setAttribute("data-nav-button", "")
  buyButton.style.opacity = "1"
  buyButton.onclick = () => {
    eventsOrThrow(game.send(buy))
    afterBuy()
  }
  const oldButton = document.createElement("button")
  oldButton.textContent = "以前の操作"
  oldButton.className = "word"
  oldButton.setAttribute("data-nav-button", "")
  oldButton.style.opacity = "1"
  const sellButton = document.createElement("button")
  sellButton.textContent = "売る"
  sellButton.className = "word"
  sellButton.setAttribute("data-nav-button", "")
  sellButton.style.opacity = "1"
  sellButton.onclick = () => {
    eventsOrThrow(game.send(sell))
  }
  const closeButton = document.createElement("button")
  closeButton.textContent = "戻る"
  closeButton.className = "close-layer"
  closeButton.onclick = () => {
    closed++
  }
  root.append(buyButton, oldButton, sellButton, closeButton)
  const view = { current: root }
  const mount = renderHook(() => useKeyboardNav(view))
  return {
    frames,
    pad,
    game,
    baseline,
    buy,
    sell,
    view,
    mount,
    buyButton,
    oldButton,
    sellButton,
    afterBuy(callback: () => void) {
      afterBuy = callback
    },
    closed: () => closed,
  }
}

async function queueSelection(f: ReturnType<typeof fixture>) {
  act(() => f.oldButton.focus())
  const before = new Set(f.frames.keys())
  await act(async () => {
    f.oldButton.setAttribute("data-leaving", "1")
    await Promise.resolve()
  })
  const queued = [...f.frames].filter(([id]) => !before.has(id))
  expect(queued).toHaveLength(1)
  return queued[0]
}

test("disposing navigation cancels the actual MutationObserver's queued selection frame", async () => {
  const f = fixture()
  await queueSelection(f)
  f.mount.unmount()
  expect(f.frames.size).toBe(0)
})

test("a dispatched selection from an old owner cannot replace the new owner's sell confirmation with a purchase", async () => {
  const f = fixture()
  const [id, stale] = await queueSelection(f)
  f.frames.delete(id)
  f.mount.unmount()
  const next = renderHook(() => useKeyboardNav(f.view))
  act(() => f.sellButton.focus())
  act(() => stale(50))
  fireEvent.keyDown(window, { key: "Enter" })
  eventsOrThrow(f.baseline.send(f.sell))
  expect(f.game.save()).toEqual(f.baseline.save())
  expect(document.activeElement).toBe(f.sellButton)
  expect(f.sellButton.classList.contains("is-active")).toBe(true)
  next.unmount()
  expect(f.frames.size).toBe(0)
})

test("a dispatched gamepad poll from a disposed owner cannot buy or reserve another frame", () => {
  const f = fixture()
  act(() => f.buyButton.focus())
  const [id, stale] = [...f.frames][0]
  f.frames.delete(id)
  f.mount.unmount()
  f.pad.buttons[0].pressed = true
  act(() => stale(50))
  expect(f.game.save()).toEqual(f.baseline.save())
  expect(f.frames.size).toBe(0)
})

test("disposal during a real purchase ends that poll before back navigation and its next frame", () => {
  const f = fixture()
  act(() => f.buyButton.focus())
  f.afterBuy(() => f.mount.unmount())
  f.pad.buttons[0].pressed = true
  f.pad.buttons[1].pressed = true
  const [id, poll] = [...f.frames][0]
  f.frames.delete(id)
  act(() => poll(50))
  eventsOrThrow(f.baseline.send(f.buy))
  expect(f.game.save()).toEqual(f.baseline.save())
  expect(f.closed()).toBe(0)
  expect(f.frames.size).toBe(0)
})
