import { describe, expect, it } from "vite-plus/test"
import {
  contentId,
  fixedClock,
  realContent,
  startedState,
  testEnvironment,
} from "@/lib/wiz/testing"
import { GameCommandError, GameDefinition } from "@/lib/wiz"

/** 名前を登録する前（はじめからの直後）の街。 */
function unregistered() {
  const definition = new GameDefinition(realContent())
  const started = startedState(definition)
  return definition.create(
    testEnvironment({ random: 0.5, clock: fixedClock(1000) }),
    { ...started, hero: { ...started.hero, registrationPending: true } }
  )
}

describe("名前の登録とダンジョン", () => {
  it("[feature:W001] 登録前はダンジョンへ出られず、状態を変えない", () => {
    const game = unregistered()
    expect(game.queries.readiness(game.state)).toMatchObject({
      ready: false,
      unregistered: true,
    })
    const before = game.state
    const result = game.send({ type: "depart", layer: contentId("layer0") })
    expect(result).toBeInstanceOf(GameCommandError)
    expect((result as GameCommandError).code).toBe("UNREGISTERED")
    expect(game.state).toBe(before)
  })

  it("[feature:W001] 登録すると出られる", () => {
    const game = unregistered()
    const registered = game.send({ type: "register-hero", name: "ノア" })
    expect(registered).not.toBeInstanceOf(GameCommandError)
    expect(game.queries.readiness(game.state).unregistered).toBe(false)
    const result = game.send({ type: "depart", layer: contentId("layer0") })
    expect(result).not.toBeInstanceOf(GameCommandError)
    expect(game.state.phase.type).toBe("expedition")
  })

  it("登録の印がない古い保存は、登録済みとして出られる", () => {
    const definition = new GameDefinition(realContent())
    const started = startedState(definition)
    const game = definition.create(
      testEnvironment({ random: 0.5, clock: fixedClock(1000) }),
      { ...started, hero: { ...started.hero, registrationPending: undefined } }
    )
    expect(game.queries.readiness(game.state).unregistered).toBe(false)
    const result = game.send({ type: "depart", layer: contentId("layer0") })
    expect(result).not.toBeInstanceOf(GameCommandError)
  })
})
