import { expect, test } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { realContent } from "@/lib/wiz/testing/real-content"
import { startedState } from "@/lib/wiz/testing/started-state"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import { contentId } from "@/lib/wiz/testing/content-id"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { connectSave } from "@/client/game/connect-save"
import { MemoryStorage } from "@/client/game/memory-storage"

for (const failure of [new Error("Display failed"), undefined])
  test(`a failing display cannot prevent an earned purchase from being saved (error: ${String(failure)})`, () => {
    const definition = new GameDefinition(realContent())
    const game = definition.create(testEnvironment(), startedState(definition))
    const storage = new MemoryStorage()
    const order: string[] = []
    const stopFirst = game.subscribe(() => {
      order.push("first display")
      throw failure
    })
    const session = connectSave(game, storage, () => order.push("save"))
    const second = new Error("Another display failed")
    const stopSecond = game.subscribe(() => {
      order.push("second display")
      throw second
    })
    game.subscribe(() => order.push("last display"))
    const before = structuredClone(game.state)
    let threw = false
    try {
      game.send({
        type: "buy",
        shop: contentId("tools"),
        good: contentId("rope"),
      })
    } catch (error) {
      threw = true
      expect(error).toBe(failure)
    }
    expect(threw).toBe(true)
    expect(game.state.gold).toBeLessThan(before.gold)
    expect(game.getSnapshot().error).toBeNull()
    expect(order).toEqual([
      "first display",
      "save",
      "second display",
      "last display",
    ])
    expect(storage.read()).not.toBeNull()
    expect(JSON.parse(storage.read()!)).toEqual(game.save())
    const resumed = definition.create(testEnvironment())
    const resumedSession = connectSave(resumed, storage)
    expect(resumedSession.status).toBe("restored")
    expect(resumed.state).toEqual(game.state)
    stopFirst()
    stopSecond()
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("tools"),
        good: contentId("rope"),
      })
    )
    expect(game.state.gold).toBeLessThan(resumed.state.gold)
    expect(JSON.parse(storage.read()!)).toEqual(game.save())
    session.disconnect()
    resumedSession.disconnect()
  })

test("a display failure during restore still publishes the restored state to autosave", () => {
  const definition = new GameDefinition(realContent())
  const source = definition.create(testEnvironment(), startedState(definition))
  eventsOrThrow(
    source.send({
      type: "buy",
      shop: contentId("tools"),
      good: contentId("rope"),
    })
  )
  const saved = JSON.parse(JSON.stringify(source.save()))
  const target = definition.create(testEnvironment(), startedState(definition))
  const storage = new MemoryStorage()
  const failure = new Error("Restored display failed")
  const stop = target.subscribe(() => {
    throw failure
  })
  const session = connectSave(target, storage)
  expect(() => target.restore(saved)).toThrow(failure)
  expect(target.state).toEqual(source.state)
  expect(storage.read()).not.toBeNull()
  expect(JSON.parse(storage.read()!)).toEqual(source.save())
  stop()
  session.disconnect()
})
