// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test"
import { GameApp } from "@/client/components/game/game-app"
import { connectSave } from "@/client/game/connect-save"
import { MemoryStorage } from "@/client/game/memory-storage"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import type { Game } from "@/lib/wiz/game/game"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { realContent } from "@/lib/wiz/testing/real-content"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

test.each(["sync", "async"])(
  "%s: the actual save warning keeps the newest failed progress until a successful retry",
  async (failure) => {
    const content = realContent()
    const definition = new GameDefinition(content)
    const initial = aState(definition.catalog).withGold(10_000).build()
    const write = Object.getOwnPropertyDescriptor(
      MemoryStorage.prototype,
      "write"
    )!.value as (this: MemoryStorage, value: string) => void
    const pending = deferred()
    let mode: "pass" | "fail" | "pending" = "pass"
    const writes = vi
      .spyOn(MemoryStorage.prototype, "write")
      .mockImplementation(function (this: MemoryStorage, value: string) {
        if (mode === "pending")
          return pending.promise.then(() => write.call(this, value))
        if (mode === "fail") {
          const error = new Error("storage unavailable")
          if (failure === "async") return Promise.reject(error)
          throw error
        }
        write.call(this, value)
      })
    const onReady = vi.fn<(game: Game) => void>()
    // The background scene and dimensions are local conditions. Boot, warning, retry,
    // native purchases, autosave and decoding use the actual application pipeline.
    const view = render(
      <GameApp
        preview={{
          content,
          initialState: initial,
          environment: testEnvironment(),
          screen: { name: "town", intro: false },
          render: <></>,
        }}
        onReady={onReady}
      />
    )
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1))
    const game = onReady.mock.calls[0][0]
    const purchase = () =>
      eventsOrThrow(
        game.send({
          type: "buy",
          shop: contentId("tools"),
          good: contentId("rope"),
        })
      )
    act(() => {
      purchase()
    })
    const storage = writes.mock.contexts[0] as MemoryStorage
    expect(storage).toBeInstanceOf(MemoryStorage)
    const checkpoint = storage!.read()
    expect(JSON.parse(checkpoint!)).toEqual(game.save())
    mode = "fail"
    await act(async () => {
      purchase()
    })
    expect(storage!.read()).toBe(checkpoint)
    const unsaved = game.save()
    expect(unsaved).not.toEqual(JSON.parse(checkpoint!))
    expect(screen.getByText("保存できていません")).toBeDefined()
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "もう一度保存" }))
    })
    expect(screen.getByText("保存できていません")).toBeDefined()
    expect(storage!.read()).toBe(checkpoint)
    expect(game.save()).toEqual(unsaved)

    mode = "pending"
    const before = writes.mock.calls.length
    const button = screen.getByRole("button", {
      name: "もう一度保存",
    }) as HTMLButtonElement
    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
    })
    expect(writes).toHaveBeenCalledTimes(before + 1)
    expect(button.disabled).toBe(true)
    expect(button.getAttribute("aria-busy")).toBe("true")
    expect(screen.getByRole("button", { name: "保存しています…" })).toBe(button)
    mode = "fail"
    await act(async () => {
      purchase()
    })
    const latest = game.save()
    expect(latest).not.toEqual(unsaved)
    expect(storage!.read()).toBe(checkpoint)
    await act(async () => {
      pending.resolve()
      await pending.promise
    })
    expect(JSON.parse(storage!.read()!)).toEqual(unsaved)
    expect(screen.getByText("保存できていません")).toBeDefined()
    expect(button.disabled).toBe(false)
    expect(game.save()).toEqual(latest)
    mode = "pass"
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "もう一度保存" }))
    })
    expect(screen.queryByText("保存できていません")).toBeNull()
    expect(JSON.parse(storage!.read()!)).toEqual(latest)
    expect(game.save()).toEqual(latest)

    const restored = definition.create(testEnvironment())
    const resumed = connectSave(restored, storage!)
    try {
      expect(resumed.status).toBe("restored")
      expect(restored.state).toEqual(game.state)
    } finally {
      resumed.disconnect()
    }
    act(() => {
      purchase()
    })
    expect(JSON.parse(storage!.read()!)).toEqual(game.save())
    expect(screen.queryByText("保存できていません")).toBeNull()
    const saved = storage!.read()
    view.unmount()
    purchase()
    expect(storage!.read()).toBe(saved)
  }
)
