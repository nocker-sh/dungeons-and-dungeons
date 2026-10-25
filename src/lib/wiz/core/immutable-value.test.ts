import { describe, expect, it } from "vite-plus/test"

import {
  WIZ_IMMUTABLE_VALUE,
  type WizDeepReadonly,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"

class ImmutableToken<TId extends string> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true

  constructor(readonly id: TId) {
    WizImmutableValue.freeze(this)
  }

  withId<TNextId extends string>(id: TNextId): ImmutableToken<TNextId> {
    return new ImmutableToken(id)
  }
}

describe("WizDeepReadonly", () => {
  it("plain tupleをdeep readonlyにし、immutable classのexact typeを維持する", () => {
    type ReadonlyTuple = WizDeepReadonly<[{ count: number }, string[]]>
    const tuple = [{ count: 1 }, ["safe"]] as unknown as ReadonlyTuple
    const token = new ImmutableToken("origin")
    const readonlyToken: WizDeepReadonly<ImmutableToken<"origin">> = token
    const exactToken: ImmutableToken<"origin"> = readonlyToken

    const verifyReadonlyTuple = (value: ReadonlyTuple) => {
      // @ts-expect-error tuple entryはreadonly
      value[0].count = 2
      // @ts-expect-error nested arrayもreadonly
      value[1].push("mutated")
    }

    void verifyReadonlyTuple
    expect(tuple[0].count).toBe(1)
    expect(exactToken.withId("next").id).toBe("next")
  })
})

describe("WizImmutableValue", () => {
  it("static utility自体を生成・差し替えできない", () => {
    expect(() => Reflect.construct(WizImmutableValue, [])).toThrow(TypeError)
    expect(Object.isFrozen(WizImmutableValue)).toBe(true)
    expect(Object.isFrozen(WizImmutableValue.prototype)).toBe(true)
  })

  it("prototypeから継承したmarkerをinstance自身のcontractとして扱わない", () => {
    const forgedPrototype = Object.create(Object.prototype)
    Object.defineProperty(forgedPrototype, WIZ_IMMUTABLE_VALUE, {
      configurable: false,
      enumerable: false,
      value: true,
      writable: false,
    })
    const forged = Object.freeze(Object.create(Object.freeze(forgedPrototype)))

    expect(WizImmutableValue.is(forged)).toBe(false)
  })
})
