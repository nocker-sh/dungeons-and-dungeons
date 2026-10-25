import { describe, expect, it } from "vite-plus/test"
import { WizStandardRuntimeEnvironment } from "@/lib/wiz/core/presets/runtime-environment"
import { WizDice } from "@/lib/wiz/core/services/wiz-dice"
import { WizWorldEnvironment, WizWorldEnvironmentValueError } from "@/lib/wiz/core/world/world"

describe("WizStandardRuntimeEnvironment", () => {
  it("seed・clock・IDを固定したruntimeを再現できる", () => {
    const createEnvironment = () =>
      WizStandardRuntimeEnvironment.create({
        dice: WizDice.withSeed(123),
        clock: () => 4_242,
        nextId: () => "fixed-id",
      })
    const first = createEnvironment()
    const second = createEnvironment()

    expect(first.dice.roll2d6().rolls).toEqual(second.dice.roll2d6().rolls)
    expect(first.clock()).toBe(4_242)
    expect(first.nextId()).toBe("fixed-id")
    expect(Object.isFrozen(first)).toBe(true)
  })

  it("headless environmentをstandard dependencyへ変換できる", () => {
    const environment = WizStandardRuntimeEnvironment.fromWorldEnvironment(
      WizWorldEnvironment.create({
        random: () => 0,
        now: () => 10,
        nextId: () => "world-id",
      }),
    )

    expect(environment.dice.roll1d6().rolls).toEqual([1])
    expect(environment.clock()).toBe(10)
    expect(environment.nextId()).toBe("world-id")
  })

  it("standardから直接作ってもclockとIDの壊れた値を拒否する", () => {
    const environment = WizStandardRuntimeEnvironment.create({
      clock: () => Number.POSITIVE_INFINITY,
      nextId: () => " ",
    })

    expect(() => environment.clock()).toThrow(WizWorldEnvironmentValueError)
    expect(() => environment.nextId()).toThrow(WizWorldEnvironmentValueError)
  })
})
