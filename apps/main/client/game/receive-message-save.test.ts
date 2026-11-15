// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test"
import { receiveMessageSave } from "./receive-message-save"

const parent = { postMessage: vi.fn() }

beforeEach(() => {
  vi.useFakeTimers()
  parent.postMessage.mockClear()
  vi.stubGlobal("location", {
    search: "?save=message",
    hostname: "dnd.localhost",
  })
  vi.spyOn(window, "parent", "get").mockReturnValue(parent as unknown as Window)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const send = (data: unknown, origin = "https://dev.dnd.localhost") =>
  dispatchEvent(
    new MessageEvent("message", {
      data,
      origin,
      source: parent as unknown as Window,
    })
  )

it("does nothing unless the page asks for a message save", () => {
  vi.stubGlobal("location", { search: "", hostname: "dnd.localhost" })
  expect(receiveMessageSave()).toBeNull()
  expect(parent.postMessage).not.toHaveBeenCalled()
})

it("announces readiness to the studio and keeps the received save in memory", async () => {
  const pending = receiveMessageSave()!
  expect(parent.postMessage).toHaveBeenCalledWith(
    { type: "dnd-save-ready" },
    "https://dev.dnd.localhost"
  )
  send({ type: "dnd-save", save: "ignored" }, "https://evil.localhost")
  send({ type: "dnd-save", save: '{"a":1}' })
  const storage = await pending
  expect(storage.read()).toBe('{"a":1}')
  await storage.write("next")
  expect(storage.read()).toBe("next")
})

it("reports an unreadable save when nothing arrives", async () => {
  const pending = receiveMessageSave()!
  vi.advanceTimersByTime(10_000)
  const storage = await pending
  expect(() => storage.read()).toThrow("届きませんでした")
})

it("refuses outside the development host", async () => {
  vi.stubGlobal("location", {
    search: "?save=message",
    hostname: "dnd.nocker.sh",
  })
  const storage = await receiveMessageSave()!
  expect(() => storage.read()).toThrow()
  expect(parent.postMessage).not.toHaveBeenCalled()
})
