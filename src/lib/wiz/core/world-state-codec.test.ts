import { z } from "zod"
import { describe, expect, expectTypeOf, it } from "vite-plus/test"
import { WIZ_IMMUTABLE_VALUE, WizImmutableValue } from "@/lib/wiz/core/immutable-value"
import type { WizStandardSchemaDefinition } from "@/lib/wiz/core/standard-schema"
import { WizWorldStateCodec } from "@/lib/wiz/core/world-state-codec"
import { WizWorldStateOwnership } from "@/lib/wiz/core/world/world"

class JourneyState {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly itemIds: readonly string[]

  constructor(
    readonly chapter: number,
    itemIds: readonly string[],
  ) {
    this.itemIds = Object.freeze([...itemIds])
    WizImmutableValue.freeze(this)
  }

  addItem(itemId: string): JourneyState {
    return new JourneyState(this.chapter, [...this.itemIds, itemId])
  }
}

const zJourneyData = z.strictObject({
  chapter: z.number().int().nonnegative(),
  itemIds: z.array(z.string().min(1)),
})

describe("WizWorldStateCodec", () => {
  it("任意のclass stateをplain dataへ保存してprototypeを復元する", () => {
    const codec = WizWorldStateCodec.define({
      contentVersion: "journey-v1",
      schema: zJourneyData,
      capture: (state: JourneyState) => {
        const verifyReadonlyCaptureState = () => {
          // @ts-expect-error capture stateはdeep readonlyなimmutable class exact type
          state.chapter = 99
        }
        void verifyReadonlyCaptureState
        return {
          chapter: state.chapter,
          itemIds: [...state.itemIds],
        }
      },
      restore: (data) => {
        const verifyReadonlyRestoreData = () => {
          // @ts-expect-error validated restore dataはdeep readonly
          data.itemIds.push("mutated")
        }
        void verifyReadonlyRestoreData
        return new JourneyState(data.chapter, data.itemIds)
      },
    })
    const state = new JourneyState(2, ["potion"])

    const captured = codec.capture(state)
    const envelope = codec.encode(state)
    const restored = codec.restore(JSON.parse(JSON.stringify(envelope)))
    const verifyReadonlyOutput = () => {
      // @ts-expect-error capture結果はdeep readonly
      captured.itemIds.push("mutated")
      // @ts-expect-error envelope dataもdeep readonly
      envelope.snapshot.itemIds[0] = "mutated"
    }

    void verifyReadonlyOutput
    expect(envelope).toEqual({
      schemaVersion: 1,
      contentVersion: "journey-v1",
      snapshot: { chapter: 2, itemIds: ["potion"] },
    })
    expect(Object.isFrozen(envelope)).toBe(true)
    expect(Object.isFrozen(envelope.snapshot.itemIds)).toBe(true)
    expect(restored).toBeInstanceOf(JourneyState)
    expect(restored.addItem("key").itemIds).toEqual(["potion", "key"])
    expect(Object.isFrozen(restored)).toBe(true)
  })

  it("capture結果とunknown restore入力をschema/JSON-safe境界で検証する", () => {
    const invalidCapture = WizWorldStateCodec.define<JourneyState, z.infer<typeof zJourneyData>>({
      contentVersion: "journey-v1",
      schema: zJourneyData,
      capture: () => ({ chapter: Number.NaN, itemIds: [] }),
      restore: (data) => new JourneyState(data.chapter, data.itemIds),
    })

    expect(() => invalidCapture.capture(new JourneyState(1, []))).toThrow()
    expect(() =>
      invalidCapture.restore({
        schemaVersion: 1,
        contentVersion: "journey-v1",
        snapshot: { chapter: "invalid", itemIds: [] },
      }),
    ).toThrow()
  })

  it("手書きStandard Schemaの変換outputをrestore型とimmutable ownershipへ伝える", () => {
    type RawJourney = {
      chapter: string
      itemIds: string[]
    }
    type ParsedJourney = {
      chapter: number
      itemIds: string[]
      normalized: true
    }
    const outputHolder: { current: ParsedJourney | null } = { current: null }
    const schema: WizStandardSchemaDefinition<RawJourney, ParsedJourney> = {
      "~standard": {
        validate: (input: unknown) => {
          if (
            typeof input !== "object" ||
            input === null ||
            !("chapter" in input) ||
            typeof input.chapter !== "string"
          ) {
            return {
              issues: [{ message: "chapter must be a string", path: ["chapter"] }],
            }
          }

          const parsedJourney: ParsedJourney = {
            chapter: Number(input.chapter),
            itemIds: ["potion"],
            normalized: true,
          }
          outputHolder.current = parsedJourney

          return { value: parsedJourney }
        },
        vendor: "world-state-test",
        version: 1,
      },
    }
    const codec = WizWorldStateCodec.define({
      contentVersion: "transformed-journey-v1",
      schema,
      capture: (state: JourneyState): RawJourney => ({
        chapter: String(state.chapter),
        itemIds: [...state.itemIds],
      }),
      restore: (plain) => {
        const normalized: true = plain.normalized
        void normalized

        return new JourneyState(plain.chapter, plain.itemIds)
      },
    })
    const captured = codec.capture(new JourneyState(4, ["potion"]))
    const envelope = codec.encode(new JourneyState(4, ["potion"]))
    const parsed = codec.parse(envelope)
    const chapter: number = parsed.snapshot.chapter

    outputHolder.current?.itemIds.push("mutated")
    const restored = codec.restore(envelope)

    expectTypeOf(codec).toEqualTypeOf<WizWorldStateCodec<JourneyState, RawJourney, ParsedJourney>>()
    expect(chapter).toBe(4)
    expect(captured.chapter).toBe("4")
    expect(captured.itemIds).toEqual(["potion"])
    expect(Object.isFrozen(captured)).toBe(true)
    expect(Object.isFrozen(captured.itemIds)).toBe(true)
    expect(parsed.snapshot.itemIds).toEqual(["potion"])
    expect(Object.isFrozen(parsed.snapshot)).toBe(true)
    expect(Object.isFrozen(parsed.snapshot.itemIds)).toBe(true)
    expect(restored).toBeInstanceOf(JourneyState)
    expect(restored.chapter).toBe(4)
  })

  it("plain mutable stateもcapture callbackとrestore出力ではdeep readonlyにする", () => {
    type MutableState = {
      nested: {
        itemIds: string[]
      }
    }
    const codec = WizWorldStateCodec.define<MutableState, { nested: { itemIds: string[] } }>({
      contentVersion: "mutable-v1",
      schema: z.strictObject({
        nested: z.strictObject({
          itemIds: z.array(z.string()),
        }),
      }),
      capture: (state) => {
        const verifyReadonlyCaptureInput = () => {
          // @ts-expect-error capture callback stateはdeep readonly
          state.nested.itemIds.push("mutated")
        }
        void verifyReadonlyCaptureInput
        return { nested: { itemIds: [...state.nested.itemIds] } }
      },
      restore: (data) => ({
        nested: { itemIds: [...data.nested.itemIds] },
      }),
    })
    const restored = codec.restore(
      codec.encode({
        nested: { itemIds: ["potion"] },
      }),
    )
    const verifyReadonlyRestoreOutput = () => {
      // @ts-expect-error restore outputはdeep readonly
      restored.nested.itemIds.push("mutated")
    }
    void verifyReadonlyRestoreOutput

    expect(restored.nested.itemIds).toEqual(["potion"])
  })

  it("構造だけを偽装したstate ownershipでimmutable境界を迂回できない", () => {
    const forgedOwnership = Object.create(WizWorldStateOwnership.prototype)
    Object.defineProperty(forgedOwnership, "own", {
      value: <TValue>(value: TValue): TValue => value,
    })
    Object.freeze(forgedOwnership)

    expect(() =>
      WizWorldStateCodec.define({
        contentVersion: "forged-ownership-v1",
        schema: zJourneyData,
        capture: (state: JourneyState) => ({
          chapter: state.chapter,
          itemIds: [...state.itemIds],
        }),
        restore: (data) => new JourneyState(data.chapter, data.itemIds),
        stateOwnership: forgedOwnership,
      }),
    ).toThrow(/must be created with WizWorldStateOwnership/)
  })

  it("すべての公開操作をbindせず呼べ、callback propertyを凍結する", () => {
    const codec = WizWorldStateCodec.define({
      contentVersion: "destructured-journey-v1",
      schema: zJourneyData,
      capture: (state: JourneyState) => ({
        chapter: state.chapter,
        itemIds: [...state.itemIds],
      }),
      restore: (data) => new JourneyState(data.chapter, data.itemIds),
    })
    const { capture, encode, parse, restore } = codec
    const state = new JourneyState(3, ["key"])

    const captured = capture(state)
    const envelope = encode(state)
    const parsed = parse(envelope)
    const restored = restore(envelope)

    expect(captured).toEqual({ chapter: 3, itemIds: ["key"] })
    expect(parsed.snapshot).toEqual(captured)
    expect(restored).toBeInstanceOf(JourneyState)
    expect(restored.chapter).toBe(3)
    expect(Object.isFrozen(codec)).toBe(true)
    expect(Object.isFrozen(capture)).toBe(true)
    expect(Object.isFrozen(encode)).toBe(true)
    expect(Object.isFrozen(parse)).toBe(true)
    expect(Object.isFrozen(restore)).toBe(true)

    const verifyReadonly = () => {
      // @ts-expect-error codec operationはreadonly function property。
      codec.capture = capture
      // @ts-expect-error codec operationはreadonly function property。
      codec.encode = encode
      // @ts-expect-error codec operationはreadonly function property。
      codec.parse = parse
      // @ts-expect-error codec operationはreadonly function property。
      codec.restore = restore
    }
    void verifyReadonly
  })

  it("codec classとprototypeを凍結する", () => {
    expect(Object.isFrozen(WizWorldStateCodec)).toBe(true)
    expect(Object.isFrozen(WizWorldStateCodec.prototype)).toBe(true)
  })
})
