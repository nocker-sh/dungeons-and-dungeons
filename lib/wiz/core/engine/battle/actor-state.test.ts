import { describe, expect, expectTypeOf, it } from "vite-plus/test"
import { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"
import { WizResourceOperationError } from "@/lib/wiz/core/domain/values/resource-set"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

const createState = () =>
  WizBattleActorState.create({
    attributes: { attack: 20, defense: 15, speed: 10 },
    resources: {
      health: { current: 100, maximum: 100 },
      mana: { current: 50, maximum: 50 },
    },
    custom: {},
  })

describe("resource operations", () => {
  it("damage and recovery return new immutable states", () => {
    const original = createState()
    const damaged = original.takeDamage(30)
    const restored = damaged.restoreHealth(10)

    expect(original.resources.current("health")).toBe(100)
    expect(damaged.resources.current("health")).toBe(70)
    expect(restored.resources.current("health")).toBe(80)
    expect(damaged).not.toBe(original)
  })

  it("damage is clamped at zero and recovery at maximum", () => {
    expect(createState().takeDamage(150).resources.current("health")).toBe(0)
    expect(
      createState().takeDamage(10).restoreHealth(50).resources.current("health")
    ).toBe(100)
  })

  it("mana spending is atomic and rejects insufficient resources", () => {
    const state = createState()
    expect(state.spendMana(20).resources.current("mana")).toBe(30)
    expect(() => state.spendMana(51)).toThrow(WizResourceOperationError)
    expect(state.resources.current("mana")).toBe(50)
  })

  it("mana recovery is clamped at maximum", () => {
    const state = createState().spendMana(30).restoreMana(50)
    expect(state.resources.current("mana")).toBe(50)
  })

  it("reports life and resource ratios from generic resources", () => {
    const state = createState().takeDamage(25).spendMana(10)
    expect(state.isAlive()).toBe(true)
    expect(state.healthRatio()).toBe(0.75)
    expect(state.manaRatio()).toBe(0.8)
    expect(state.hasMana(40)).toBe(true)
    expect(state.hasMana(41)).toBe(false)
  })
})

describe("attributes", () => {
  it("scales a selected attribute without changing the source state", () => {
    const original = createState()
    const scaled = original.scaleAttribute("attack", 1.5)

    expect(original.attributes.value("attack")).toBe(20)
    expect(scaled.attributes.value("attack")).toBe(30)
  })
})

describe("formula view", () => {
  it("flattens standard fields and custom numeric fields only at the formula boundary", () => {
    const state = WizBattleActorState.create({
      attributes: { attack: 25, defense: 12, speed: 18 },
      resources: {
        health: { current: 80, maximum: 100 },
        mana: { current: 30, maximum: 40 },
      },
      custom: { magic: 42 },
    })

    const view = state.toFormulaView()

    expect(view).toEqual({
      hp: 80,
      maxHp: 100,
      mp: 30,
      maxMp: 40,
      attack: 25,
      defense: 12,
      speed: 18,
      magic: 42,
    })
    expect(Object.isFrozen(view)).toBe(true)
  })

  it("custom data cannot overwrite the standard formula fields", () => {
    const state = WizBattleActorState.create({
      attributes: { attack: 25, defense: 12, speed: 18 },
      resources: {
        health: { current: 80, maximum: 100 },
        mana: { current: 30, maximum: 40 },
      },
      custom: { attack: "spoofed", hp: "spoofed", magic: 42 },
    })

    const view = state.toFormulaView()
    expect(view.attack).toBe(25)
    expect(view.hp).toBe(80)
    expect(view.magic).toBe(42)
    expectTypeOf(view.attack).toEqualTypeOf<number>()
  })
})

describe("ownership and validation", () => {
  it("owns nested custom data and freezes the public state", () => {
    const custom = { nested: { magic: 4 } }
    const state = WizBattleActorState.create({
      attributes: { attack: 20, defense: 15, speed: 10 },
      resources: {
        health: { current: 100, maximum: 100 },
        mana: { current: 50, maximum: 50 },
      },
      custom,
    })
    custom.nested.magic = 99

    expect(state.custom).toEqual({ nested: { magic: 4 } })
    expect(Object.isFrozen(state)).toBe(true)
    expect(Object.isFrozen(state.custom)).toBe(true)
  })

  it("rejects non-finite custom numeric fields", () => {
    expect(() =>
      WizBattleActorState.create({
        attributes: { attack: 20, defense: 15, speed: 10 },
        resources: {
          health: { current: 100, maximum: 100 },
          mana: { current: 50, maximum: 50 },
        },
        custom: { magic: { power: Number.NaN } },
      })
    ).toThrow(WizValueValidationError)
  })

  it("rejects direct construction", () => {
    expect(() =>
      Reflect.construct(WizBattleActorState, [
        Symbol("forged"),
        createState().toProperties(),
      ])
    ).toThrow(
      "WizBattleActorState must be created with create() or fromComponents()"
    )
  })
})
