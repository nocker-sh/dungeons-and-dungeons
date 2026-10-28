import { describe, expect, expectTypeOf, it } from "vite-plus/test"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizWorld, WizWorldModule } from "@/lib/wiz/core/world/world"
import {
  WizWorldMessage,
  WizWorldMessageCatalog,
  type WizWorldMessageValue,
  WizWorldMessageValueError,
} from "@/lib/wiz/core/world/world-message"

type Messages = {
  readonly FOUND_ITEM: Readonly<{
    itemName: string
    quantity: number
    tags: readonly string[]
  }>
  readonly WORLD_STARTED: Readonly<Record<string, never>>
}

describe("WizWorldMessageCatalog", () => {
  it("headless tokenを型付きtemplateで表示する", () => {
    const catalog = WizWorldMessageCatalog.create<Messages>({
      FOUND_ITEM: ({ itemName, quantity }) => `${itemName} x${quantity}`,
      WORLD_STARTED: () => "started",
    })
    const tags = ["rare"]
    const message = WizWorldMessage.create("FOUND_ITEM", {
      itemName: "herb",
      quantity: 2,
      tags,
    })
    tags.push("consumable")

    expect(catalog.render(message)).toBe("herb x2")
    expect(message.parameters.tags).toEqual(["rare"])
    expect(Object.isFrozen(message)).toBe(true)
    expect(Object.isFrozen(message.parameters)).toBe(true)
    expect(Object.isFrozen(message.parameters.tags)).toBe(true)
    expect(Object.isFrozen(WizWorldMessage)).toBe(true)
    expect(Object.isFrozen(WizWorldMessage.prototype)).toBe(true)
    expect(Object.isFrozen(WizWorldMessageCatalog)).toBe(true)
    expect(Object.isFrozen(WizWorldMessageCatalog.prototype)).toBe(true)
    expect(WizImmutableValue.is(message)).toBe(true)
    expect(message[WIZ_IMMUTABLE_VALUE]).toBe(true)

    const verifyReadonlyParameters = () => {
      // @ts-expect-error message parametersはdeep readonly
      message.parameters.tags.push("mutated")
    }
    void verifyReadonlyParameters
  })

  it("mutable定義でもtemplate callbackとtoken出力をdeep readonlyにする", () => {
    type MutableMessages = {
      NOTICE: {
        metadata: {
          tags: string[]
        }
      }
    }
    const catalog = WizWorldMessageCatalog.create<MutableMessages>({
      NOTICE: (parameters) => {
        expectTypeOf(parameters).toEqualTypeOf<
          WizDeepReadonly<MutableMessages["NOTICE"]>
        >()
        const verifyReadonlyTemplateInput = () => {
          // @ts-expect-error template callback inputはdeep readonly
          parameters.metadata.tags.push("mutated")
        }
        void verifyReadonlyTemplateInput
        return parameters.metadata.tags.join(",")
      },
    })
    const source = { metadata: { tags: ["safe"] } }
    const message = WizWorldMessage.create("NOTICE", source)
    source.metadata.tags.push("late")

    const verifyReadonlyToken = () => {
      // @ts-expect-error token出力はdeep readonly
      message.parameters.metadata.tags[0] = "mutated"
    }
    void verifyReadonlyToken
    expect(catalog.render(message)).toBe("safe")
  })

  it("message tokenをworld eventとしてprototype付きで安全に返す", () => {
    type State = Readonly<{ found: number }>
    type Action = Readonly<{ type: "FIND" }>
    const module = WizWorldModule.define<
      State,
      Action,
      WizWorldMessage<"FOUND_ITEM", Messages["FOUND_ITEM"]>
    >({
      name: "finder",
      accepts: (action): action is Action =>
        typeof action === "object" &&
        action !== null &&
        "type" in action &&
        action.type === "FIND",
      reduce: (state) => ({
        accepted: true,
        state: { found: state.found + 1 },
        events: [
          WizWorldMessage.create("FOUND_ITEM", {
            itemName: "herb",
            quantity: 1,
            tags: [],
          }),
        ],
      }),
    })
    const world = WizWorld.create<State>({ found: 0 }).with(module)

    const result = world.dispatch(world.initialState, { type: "FIND" })

    expect(result.events[0]).toBeInstanceOf(WizWorldMessage)
    expect(result.events[0]?.key).toBe("FOUND_ITEM")
  })

  it("隠しproperty・accessor・array extraを実行や欠落なしに拒否する", () => {
    const hidden = Symbol("hidden")
    const symbolParameters = {
      visible: "safe",
      [hidden]: "secret",
    }
    expect(() => WizWorldMessage.create("NOTICE", symbolParameters)).toThrow(
      WizWorldMessageValueError
    )

    let accessCount = 0
    const accessorParameters = { visible: "safe" }
    Object.defineProperty(accessorParameters, "secret", {
      enumerable: true,
      get: () => {
        accessCount += 1
        return "secret"
      },
    })
    expect(() =>
      WizWorldMessage.create(
        "NOTICE",
        accessorParameters as Readonly<Record<string, string>>
      )
    ).toThrow(WizWorldMessageValueError)
    expect(accessCount).toBe(0)

    const values = ["safe"]
    Object.defineProperty(values, "metadata", {
      enumerable: true,
      value: "hidden",
    })
    expect(() => WizWorldMessage.create("NOTICE", { values })).toThrow(
      WizWorldMessageValueError
    )
  })

  it("循環・JSONで意味を失う数値・非canonical keyをpath付きで拒否する", () => {
    const cyclic: Record<string, WizWorldMessageValue> = {}
    cyclic.self = cyclic

    expect(() => WizWorldMessage.create("NOTICE", cyclic)).toThrow(
      WizWorldMessageValueError
    )
    try {
      WizWorldMessage.create("NOTICE", cyclic)
    } catch (error) {
      expect(error).toMatchObject({
        path: "$.self",
        reason: "cyclic references are not supported",
      })
    }
    expect(() =>
      WizWorldMessage.create("NOTICE", { value: Number.NaN })
    ).toThrow(WizWorldMessageValueError)
    expect(() => WizWorldMessage.create(" NOTICE ", { value: 1 })).toThrow(
      RangeError
    )
    expect(() =>
      WizWorldMessage.create(1 as unknown as "NOTICE", { value: 1 })
    ).toThrow("World message key must be a string")
  })

  it("型検査を迂回したroot primitiveとarrayをparametersとして保持しない", () => {
    const createMessage = Reflect.get(WizWorldMessage, "create")
    expect(() =>
      Reflect.apply(createMessage, WizWorldMessage, ["NOTICE", 1])
    ).toThrow(WizWorldMessageValueError)
    expect(() =>
      Reflect.apply(createMessage, WizWorldMessage, ["NOTICE", []])
    ).toThrow(WizWorldMessageValueError)
  })

  it("Proxy reflection failureをmessage value errorへ正規化する", () => {
    const proxy = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          throw new Error("PROXY_TRAP_RAN")
        },
      }
    )

    expect(() =>
      WizWorldMessage.create(
        "NOTICE",
        proxy as Readonly<Record<string, WizWorldMessageValue>>
      )
    ).toThrow(
      expect.objectContaining({
        path: "$",
        reason: "value could not be inspected safely",
      })
    )
  })
})
