import { describe, expect, expectTypeOf, it } from "vite-plus/test"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"

const service = new WizObjectService()

describe("ownImmutable", () => {
  it("plain objectとarrayをdefensive copyしてdeep freezeする", () => {
    const input = {
      entries: [{ label: "before" }],
    }

    const result = service.ownImmutable(input)
    input.entries[0]!.label = "after"
    input.entries.push({ label: "added" })

    expect(result).not.toBe(input)
    expect(result.entries).not.toBe(input.entries)
    expect(result.entries).toEqual([{ label: "before" }])
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.entries)).toBe(true)
    expect(Object.isFrozen(result.entries[0])).toBe(true)
    expect(Reflect.set(result.entries[0]!, "label", "getter mutation")).toBe(
      false
    )
    expect(result.entries[0]!.label).toBe("before")
  })

  it("戻り値をnested fieldまでreadonlyとして公開する", () => {
    const result = service.ownImmutable({
      entries: [{ label: "before" }],
    })
    const ownAgain = <T>(value: WizDeepReadonly<T>): WizDeepReadonly<T> =>
      service.ownImmutable<T>(value)

    expectTypeOf(result).toEqualTypeOf<
      WizDeepReadonly<{
        entries: {
          label: string
        }[]
      }>
    >()
    expectTypeOf(ownAgain(result)).toEqualTypeOf<typeof result>()
  })

  it("同じserviceが所有済みの値は安全にstructural shareする", () => {
    const first = service.ownImmutable({
      entries: [{ value: 1 }],
    })
    const second = service.ownImmutable(first)

    expect(second).toBe(first)
    expect(second.entries).toBe(first.entries)
  })

  it("immutable value contractを宣言したclass instanceを共有してprototypeを維持する", () => {
    class ImmutableBox {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true

      constructor(readonly value: number) {
        WizImmutableValue.freeze(this)
      }
    }

    const box = new ImmutableBox(7)
    const result = service.ownImmutable({ box })
    const ownedBox = service.ownImmutable(box)

    expect(result.box).toBe(box)
    expect(result.box).toBeInstanceOf(ImmutableBox)
    expectTypeOf(ownedBox).toEqualTypeOf<ImmutableBox>()
  })

  it("外側だけfreezeされたclass instanceは拒否する", () => {
    class ShallowBox {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true
      readonly entries = [{ value: 1 }]

      constructor() {
        WizImmutableValue.freeze(this)
      }
    }

    expect(() => service.ownImmutable({ box: new ShallowBox() })).toThrow(
      "Cannot own shallow-frozen nested value: Array"
    )
  })

  it("contractを宣言してdeep freezeされたclass instanceは共有する", () => {
    class ImmutableBox {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true
      readonly entries: readonly Readonly<{ value: number }>[]

      constructor() {
        this.entries = Object.freeze([Object.freeze({ value: 1 })])
        WizImmutableValue.freeze(this)
      }
    }

    const box = new ImmutableBox()
    const result = service.ownImmutable({ box })

    expect(result.box).toBe(box)
    expect(result.box.entries).toEqual([{ value: 1 }])
  })

  it("immutable Array subclassを通常配列へ変換せず共有する", () => {
    class DicePool extends Array<number> {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true

      constructor(...values: number[]) {
        super(...values)
        WizImmutableValue.freeze(this)
      }

      total(): number {
        return this.reduce((sum, value) => sum + value, 0)
      }
    }

    const pool = new DicePool(1, 2, 3)
    const result = service.ownImmutable({ pool })

    expect(result.pool).toBe(pool)
    expect(result.pool).toBeInstanceOf(DicePool)
    expect(result.pool.total()).toBe(6)
  })

  it("freezeしても内部状態を変更できるbuilt-inは拒否する", () => {
    const date = Object.freeze(new Date("2026-01-01T00:00:00.000Z"))
    class MutableMapSubclass extends Map<string, string> {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true

      constructor() {
        super([["status", "before"]])
        WizImmutableValue.freeze(this)
      }
    }

    expect(() => service.ownImmutable({ date })).toThrow(
      "Cannot own mutable built-in instance: Date"
    )
    expect(() =>
      service.ownImmutable({ value: new MutableMapSubclass() })
    ).toThrow("Cannot own mutable built-in instance: MutableMapSubclass")
  })

  it("mutable class instanceは拒否する", () => {
    class MutableBox {
      constructor(readonly value: number) {}
    }

    expect(() => service.ownImmutable({ box: new MutableBox(7) })).toThrow(
      "Cannot own mutable class instance: MutableBox"
    )
  })

  it("freeze済みでもclosure可変性を隠せるfunctionはimmutable dataとして拒否する", () => {
    let count = 0
    const increment = Object.freeze(() => {
      count += 1
      return count
    })

    expect(() => service.ownImmutable(increment)).toThrow(
      "Cannot own function as immutable data"
    )
    expect(() => service.ownImmutable({ increment })).toThrow(
      "Cannot own function as immutable data"
    )
  })

  it("immutable classのown function propertyも拒否する", () => {
    class CallableBox {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true
      readonly read = Object.freeze(() => 1)

      constructor() {
        WizImmutableValue.freeze(this)
      }
    }

    expect(() => service.ownImmutable(new CallableBox())).toThrow(
      "Cannot own function property as immutable data: read"
    )
  })

  it("contractなしでfreeze済みのclassは拒否する", () => {
    class DeclaredBox {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true

      constructor(readonly value: number) {
        WizImmutableValue.freeze(this)
      }
    }
    class UndeclaredBox {
      constructor(readonly value: number) {
        Object.freeze(this)
      }
    }

    const declared = new DeclaredBox(1)

    expect(service.ownImmutable(declared)).toBe(declared)
    expect(() => service.ownImmutable(new UndeclaredBox(1))).toThrow(
      "Cannot own class without immutable value contract: UndeclaredBox"
    )
  })

  it("Object.freezeでは隠せないprivate可変fieldを持つ未宣言classを拒否する", () => {
    class PrivatelyMutableBox {
      readonly #entries: number[] = []

      constructor() {
        Object.freeze(this)
      }

      add(value: number): void {
        this.#entries.push(value)
      }

      size(): number {
        return this.#entries.length
      }
    }

    const box = new PrivatelyMutableBox()
    box.add(1)
    expect(box.size()).toBe(1)
    expect(() => service.ownImmutable(box)).toThrow(
      "Cannot own class without immutable value contract: PrivatelyMutableBox"
    )
  })
})
