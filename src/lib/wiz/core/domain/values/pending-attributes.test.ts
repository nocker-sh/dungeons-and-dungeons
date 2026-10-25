import { describe, expect, it } from "vite-plus/test"
import { WizPendingAttributes } from "@/lib/wiz/core/domain/values/pending-attributes"
import { WizImmutableValue } from "@/lib/wiz/core/immutable-value"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

describe("construction", () => {
  it("creates from an empty value", () => {
    const pending = WizPendingAttributes.fromPlain({})
    expect(pending.total).toBe(0)
  })

  it("creates via fromPlain()", () => {
    const pending = WizPendingAttributes.fromPlain({
      strength: 2,
      dexterity: 1,
    })
    expect(pending.get("strength")).toBe(2)
    expect(pending.get("dexterity")).toBe(1)
  })

  it("入力を所有し、不正なallocationを拒否する", () => {
    const source = { strength: 2 }
    const pending = WizPendingAttributes.fromPlain(source)
    source.strength = 99

    expect(pending.get("strength")).toBe(2)
    expect(Object.isFrozen(pending.toPlain())).toBe(true)
    expect(WizImmutableValue.is(pending)).toBe(true)
    expect(() => WizPendingAttributes.fromPlain({ strength: -1 })).toThrow(WizValueValidationError)
    expect(() => WizPendingAttributes.fromPlain({ strength: 1.5 })).toThrow(WizValueValidationError)
  })
})

describe("get", () => {
  it("returns allocated value for existing attribute", () => {
    const pending = WizPendingAttributes.fromPlain({ strength: 3 })
    expect(pending.get("strength")).toBe(3)
  })

  it("returns 0 for unallocated attribute", () => {
    const pending = WizPendingAttributes.fromPlain({})
    expect(pending.get("wisdom")).toBe(0)
  })
})

describe("total", () => {
  it("returns 0 for empty", () => {
    expect(WizPendingAttributes.fromPlain({}).total).toBe(0)
  })

  it("sums all allocated values", () => {
    const pending = WizPendingAttributes.fromPlain({
      strength: 2,
      dexterity: 3,
      vitality: 1,
    })
    expect(pending.total).toBe(6)
  })
})

describe("vitalityBonus", () => {
  it("returns vitality value when allocated", () => {
    const pending = WizPendingAttributes.fromPlain({ vitality: 5 })
    expect(pending.vitalityBonus).toBe(5)
  })

  it("returns 0 when vitality is not allocated", () => {
    const pending = WizPendingAttributes.fromPlain({ strength: 3 })
    expect(pending.vitalityBonus).toBe(0)
  })
})

describe("allocate", () => {
  it("increments the specified attribute by 1", () => {
    const pending = WizPendingAttributes.fromPlain({})
    const allocated = pending.allocate("strength")
    expect(allocated.get("strength")).toBe(1)
  })

  it("stacks on existing allocation", () => {
    const pending = WizPendingAttributes.fromPlain({ strength: 2 })
    const allocated = pending.allocate("strength")
    expect(allocated.get("strength")).toBe(3)
  })

  it("does not modify the original", () => {
    const original = WizPendingAttributes.fromPlain({ strength: 1 })
    original.allocate("strength")
    expect(original.get("strength")).toBe(1)
  })

  it("returns a new instance", () => {
    const original = WizPendingAttributes.fromPlain({})
    const allocated = original.allocate("dexterity")
    expect(allocated).not.toBe(original)
  })
})

describe("reset", () => {
  it("returns empty pending attributes", () => {
    const pending = WizPendingAttributes.fromPlain({
      strength: 3,
      dexterity: 2,
    })
    const resetted = pending.reset()
    expect(resetted.total).toBe(0)
    expect(resetted.get("strength")).toBe(0)
    expect(resetted.get("dexterity")).toBe(0)
  })

  it("does not modify the original", () => {
    const original = WizPendingAttributes.fromPlain({ strength: 3 })
    original.reset()
    expect(original.get("strength")).toBe(3)
  })

  it("returns a new instance", () => {
    const original = WizPendingAttributes.fromPlain({ strength: 3 })
    const resetted = original.reset()
    expect(resetted).not.toBe(original)
  })
})

describe("entries", () => {
  it("returns empty array for empty attributes", () => {
    expect(WizPendingAttributes.fromPlain({}).entries()).toEqual([])
  })

  it("returns key-value pairs for allocated attributes", () => {
    const pending = WizPendingAttributes.fromPlain({
      strength: 2,
      wisdom: 1,
    })
    const entries = pending.entries()
    expect(entries).toContainEqual(["strength", 2])
    expect(entries).toContainEqual(["wisdom", 1])
    expect(entries.length).toBe(2)
    expect(Object.isFrozen(entries)).toBe(true)
    expect(Object.isFrozen(entries[0])).toBe(true)
  })

  it("excludes zero-value attributes", () => {
    const pending = WizPendingAttributes.fromPlain({
      strength: 0,
      wisdom: 1,
    })
    const entries = pending.entries()
    expect(entries.length).toBe(1)
    expect(entries[0]).toEqual(["wisdom", 1])
  })
})

describe("toPlain / fromPlain round-trip", () => {
  it("round-trips correctly", () => {
    const original = WizPendingAttributes.fromPlain({
      strength: 2,
      dexterity: 1,
      agility: 3,
    })
    const plain = original.toPlain()
    const restored = WizPendingAttributes.fromPlain(plain)
    expect(restored.get("strength")).toBe(2)
    expect(restored.get("dexterity")).toBe(1)
    expect(restored.get("agility")).toBe(3)
    expect(restored.total).toBe(original.total)
  })

  it("returns plain object with correct shape", () => {
    const pending = WizPendingAttributes.fromPlain({ vitality: 4 })
    const plain = pending.toPlain()
    expect(plain).toEqual({ vitality: 4 })
  })
})

describe("immutability", () => {
  it("is frozen", () => {
    const pending = WizPendingAttributes.fromPlain({ strength: 1 })
    expect(Object.isFrozen(pending)).toBe(true)
  })

  it("allocate returns new frozen instance", () => {
    const original = WizPendingAttributes.fromPlain({})
    const allocated = original.allocate("strength")
    expect(Object.isFrozen(allocated)).toBe(true)
    expect(allocated).not.toBe(original)
  })

  it("reset returns new frozen instance", () => {
    const original = WizPendingAttributes.fromPlain({ strength: 3 })
    const resetted = original.reset()
    expect(Object.isFrozen(resetted)).toBe(true)
    expect(resetted).not.toBe(original)
  })
})
