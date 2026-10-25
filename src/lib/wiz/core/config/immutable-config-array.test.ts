import { describe, expect, it } from "vite-plus/test"
import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"

describe("immutableConfig array ownership", () => {
  it("sparse shapeと追加data propertyをdescriptorごと所有する", () => {
    const metadata = { label: "before" }
    const marker = Symbol("marker")
    const markerValue = { value: 1 }
    const input: ({ readonly nested: { value: number } } | undefined)[] = []
    input.length = 2
    input[1] = { nested: { value: 2 } }
    Object.defineProperty(input, "metadata", {
      configurable: true,
      enumerable: false,
      value: metadata,
      writable: true,
    })
    Object.defineProperty(input, marker, {
      configurable: true,
      enumerable: true,
      value: markerValue,
      writable: true,
    })

    const owned = immutableConfig(input)
    metadata.label = "after"
    markerValue.value = 9
    input[1]!.nested.value = 8

    expect(Object.hasOwn(owned, 0)).toBe(false)
    expect(Object.hasOwn(owned, 1)).toBe(true)
    expect(owned[1]).toEqual({ nested: { value: 2 } })
    expect(Reflect.get(owned, "metadata")).toEqual({ label: "before" })
    expect(Reflect.get(owned, marker)).toEqual({ value: 1 })
    expect(Object.getOwnPropertyDescriptor(owned, "metadata")?.enumerable).toBe(false)
    expect(Object.isFrozen(Reflect.get(owned, "metadata"))).toBe(true)
    expect(Object.isFrozen(Reflect.get(owned, marker))).toBe(true)
  })

  it("arrayの循環参照を維持して不変化する", () => {
    const input: unknown[] = []
    input.push(input)

    const owned = immutableConfig(input)

    expect(owned).not.toBe(input)
    expect(owned[0]).toBe(owned)
    expect(Object.isFrozen(owned)).toBe(true)
  })

  it("arrayのaccessorを実行せず拒否する", () => {
    let reads = 0
    const input: unknown[] = []
    Object.defineProperty(input, "metadata", {
      get: () => {
        reads += 1
        return { value: 1 }
      },
    })

    expect(() => immutableConfig(input)).toThrow(
      "Immutable config does not support accessor properties",
    )
    expect(reads).toBe(0)
  })

  it("genericのprototypeを失うarray subclassを拒否する", () => {
    class WeightedEntries extends Array<number> {
      total(): number {
        return this.reduce((sum, value) => sum + value, 0)
      }
    }

    expect(() => immutableConfig(new WeightedEntries(1, 2))).toThrow(
      "Immutable config only supports plain arrays",
    )
  })
})
