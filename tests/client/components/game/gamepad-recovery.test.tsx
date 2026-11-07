// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useRef } from "react"
import { afterEach, expect, test, vi } from "vite-plus/test"
import { useKeyboardNav } from "@/client/components/game/focus"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import type { Game } from "@/lib/wiz/game/game"
import type { GameAction } from "@/lib/wiz/commands"
import { Bag } from "@/lib/wiz/rules/bag"
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
      entry.good.kind === "item" && !entry.good.unlock && entry.good.price! > 0
  )!

type Props = { game: Game; action: GameAction }

function Controls(props: Props) {
  const root = useRef<HTMLDivElement>(null)
  useKeyboardNav(root)
  return (
    <div className="game" ref={root}>
      <div data-gamepad-scroll style={{ opacity: 1 }}>
        <button
          className="word cta"
          style={{ opacity: 1 }}
          onClick={() => eventsOrThrow(props.game.send(props.action))}
        >
          買う
        </button>
      </div>
    </div>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function fixture() {
  const frames = new Map<number, FrameRequestCallback>()
  let serial = 0
  let now = 0
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++serial, callback)
    return serial
  })
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id))
  const pad = {
    index: 0,
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, (_, index) => ({
      pressed: index === 0,
    })),
  }
  const access = vi.fn<() => ReadonlyArray<Gamepad | null>>(() => [
    pad as unknown as Gamepad,
  ])
  vi.stubGlobal("navigator", { getGamepads: access })
  const initial = {
    ...startedState(definition),
    gold: sale.good.price! * 20,
    bag: [],
  }
  const game = definition.create(testEnvironment(), initial)
  const view = render(
    <Controls
      game={game}
      action={{ type: "buy", shop: sale.shop, good: sale.good.id }}
    />
  )
  const button = screen.getByRole("button", { name: "買う" })
  act(() => button.focus())
  return {
    game,
    initial,
    pad,
    access,
    frames,
    button,
    view,
    tick(milliseconds = 50) {
      now += milliseconds
      act(() => {
        const callbacks = [...frames.values()]
        frames.clear()
        for (const callback of callbacks) callback(now)
      })
    },
    purchases(count: number) {
      expect(Bag.count(game.state.bag, sale.good.id)).toBe(count)
      expect(game.state.gold).toBe(initial.gold - sale.good.price! * count)
      expect(game.queries.problems(game.state)).toEqual([])
    },
  }
}

for (const failure of ["method", "getter", "missing"] as const)
  test(`${failure} gamepad access preserves keyboard play and recovers one held confirmation`, () => {
    const f = fixture()
    f.tick()
    f.purchases(1)
    f.tick()
    f.purchases(1)
    const before = f.game.save()
    if (failure === "method")
      f.access.mockImplementation(() => {
        throw new Error("Device unavailable")
      })
    else
      Object.defineProperty(
        navigator,
        "getGamepads",
        failure === "getter"
          ? {
              configurable: true,
              get() {
                throw new Error("Device unavailable")
              },
            }
          : { configurable: true, value: undefined }
      )
    expect(() => f.tick()).not.toThrow()
    expect(f.frames.size).toBe(1)
    expect(f.game.save()).toEqual(before)
    fireEvent.keyDown(f.button, { key: "Enter" })
    f.purchases(2)
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [f.pad],
    })
    f.tick()
    f.purchases(3)
    f.tick()
    f.purchases(3)
    f.pad.buttons[0].pressed = false
    f.tick()
    f.pad.buttons[0].pressed = true
    f.tick()
    f.purchases(4)
    f.view.unmount()
    expect(f.frames.size).toBe(0)
  })

for (const disconnected of ["empty", "flag"] as const)
  test(`a ${disconnected} disconnect forgets only the absent device's held confirmation`, () => {
    const f = fixture()
    const other = {
      ...f.pad,
      index: 1,
      buttons: f.pad.buttons.map(() => ({ pressed: false })),
    }
    f.access.mockImplementation(() => [
      f.pad as unknown as Gamepad,
      other as unknown as Gamepad,
    ])
    f.tick()
    f.purchases(1)
    const before = f.game.save()
    f.access.mockImplementation(() =>
      disconnected === "empty"
        ? [null, other as unknown as Gamepad]
        : [
            { ...f.pad, connected: false } as unknown as Gamepad,
            other as unknown as Gamepad,
          ]
    )
    f.tick()
    expect(f.game.save()).toEqual(before)
    f.access.mockImplementation(() => [
      f.pad as unknown as Gamepad,
      other as unknown as Gamepad,
    ])
    f.tick()
    f.purchases(2)
    f.tick()
    f.purchases(2)
    other.buttons[0].pressed = true
    f.tick()
    f.purchases(3)
    f.access.mockImplementation(() => [null, other as unknown as Gamepad])
    f.tick()
    f.purchases(3)
  })

test("right-stick scrolling resumes after a device failure without accumulating the missing time", () => {
  const f = fixture()
  f.pad.buttons[0].pressed = false
  f.pad.axes[3] = 1
  const area = f.button.closest<HTMLElement>("[data-gamepad-scroll]")!
  f.tick()
  expect(area.scrollTop).toBe(0)
  f.tick()
  const step = area.scrollTop
  expect(step).toBeGreaterThan(0)
  const saved = f.game.save()
  f.access.mockImplementation(() => {
    throw new Error("Device unavailable")
  })
  expect(() => f.tick(10000)).not.toThrow()
  expect(area.scrollTop).toBe(step)
  f.access.mockImplementation(() => [f.pad as unknown as Gamepad])
  f.tick(10000)
  expect(area.scrollTop).toBe(step * 2)
  f.pad.axes[3] = 0
  f.tick()
  expect(area.scrollTop).toBe(step * 2)
  expect(f.game.save()).toEqual(saved)
  f.view.unmount()
  expect(f.frames.size).toBe(0)
})
