import { describe, expect, expectTypeOf, it } from "vite-plus/test"
import { z } from "zod"
import {
  WIZ_WORLD_SAVE_SCHEMA_VERSION,
  WizWorldSaveCodec,
  WizWorldSaveContentVersionError,
  WizWorldSaveSchemaVersionError,
  WizWorldSaveSerializationError,
} from "@/lib/wiz/core/save/world-save-codec"
import { WizStandardSchema, type WizStandardSchemaDefinition } from "@/lib/wiz/core/standard-schema"

const zPayload = z.strictObject({
  payload: z.strictObject({
    tags: z.array(z.string()),
  }),
})

describe("WizWorldSaveCodec", () => {
  it("Standard Schemaを必須dependencyとしてversion envelopeを不変化する", () => {
    const codec = WizWorldSaveCodec.define({
      contentVersion: "world-content-v1",
      schema: zPayload,
    })
    const source = { payload: { tags: ["before"] } }
    const envelope = codec.encode(source)

    source.payload.tags[0] = "after"
    source.payload.tags.push("added")
    const decoded = codec.decodeSnapshot(JSON.parse(JSON.stringify(envelope)))
    const verifyReadonlyValues = () => {
      // @ts-expect-error encoded snapshotはdeep readonly
      envelope.snapshot.payload.tags.push("mutated")
      // @ts-expect-error decoded snapshotもdeep readonly
      decoded.payload.tags[0] = "mutated"
    }
    void verifyReadonlyValues

    expect(envelope).toEqual({
      schemaVersion: WIZ_WORLD_SAVE_SCHEMA_VERSION,
      contentVersion: "world-content-v1",
      snapshot: { payload: { tags: ["before"] } },
    })
    expect(decoded.payload.tags).toEqual(["before"])
    expect(Object.isFrozen(envelope)).toBe(true)
    expect(Object.isFrozen(envelope.snapshot.payload.tags)).toBe(true)
    expect(Object.isFrozen(decoded.payload.tags)).toBe(true)
  })

  it("手書きStandard Schemaのinput/output変換を型とJSON ownershipへ伝える", () => {
    type RawSnapshot = Readonly<{
      value: string
    }>
    type ParsedSnapshot = {
      value: number
      normalized: true
      tags: string[]
    }
    const outputHolder: { current: ParsedSnapshot | null } = { current: null }
    const schema: WizStandardSchemaDefinition<RawSnapshot, ParsedSnapshot> = {
      "~standard": {
        validate: (input: unknown) => {
          if (
            typeof input !== "object" ||
            input === null ||
            !("value" in input) ||
            typeof input.value !== "string"
          ) {
            return {
              issues: [{ message: "value must be a string", path: ["value"] }],
            }
          }

          const parsedSnapshot: ParsedSnapshot = {
            value: Number(input.value),
            normalized: true,
            tags: ["captured"],
          }
          outputHolder.current = parsedSnapshot
          return { value: parsedSnapshot }
        },
        vendor: "world-save-test",
        version: 1,
      },
    }
    const codec = WizWorldSaveCodec.define({
      contentVersion: "transformed-v1",
      schema,
    })
    const envelope = codec.encode({ value: "7" })
    const decoded = codec.decodeSnapshot(envelope)
    const encodedValue: "7" = envelope.snapshot.value
    const parsedValue: number = decoded.value
    const normalized: true = decoded.normalized

    outputHolder.current?.tags.push("mutated")

    expectTypeOf(codec).toEqualTypeOf<WizWorldSaveCodec<RawSnapshot, ParsedSnapshot>>()
    expect(encodedValue).toBe("7")
    expect(parsedValue).toBe(7)
    expect(normalized).toBe(true)
    expect(decoded.tags).toEqual(["captured"])
    expect(Object.isFrozen(decoded.tags)).toBe(true)
  })

  it("envelopeをplain own data propertiesとexact three keysで検証する", () => {
    const codec = WizWorldSaveCodec.define({
      contentVersion: "strict-v1",
      schema: z.strictObject({ value: z.number() }),
    })
    const inherited = Object.create({
      schemaVersion: 1,
      contentVersion: "strict-v1",
      snapshot: { value: 1 },
    })
    const excessive = {
      schemaVersion: 1,
      contentVersion: "strict-v1",
      snapshot: { value: 1 },
      extra: true,
    }
    const symbolKey = {
      schemaVersion: 1,
      contentVersion: "strict-v1",
      snapshot: { value: 1 },
      [Symbol("extra")]: true,
    }
    let getterCalls = 0
    const accessorEnvelope = Object.create(null)
    Object.defineProperties(accessorEnvelope, {
      schemaVersion: { enumerable: true, value: 1 },
      contentVersion: { enumerable: true, value: "strict-v1" },
      snapshot: {
        enumerable: true,
        get: () => {
          getterCalls += 1
          return { value: 1 }
        },
      },
    })

    expect(() => codec.parse(inherited)).toThrow("World save envelope must be a plain object")
    expect(() => codec.parse(excessive)).toThrow("must contain exactly")
    expect(() => codec.parse(symbolKey)).toThrow("must contain exactly")
    expect(() => codec.parse(accessorEnvelope)).toThrow('property "snapshot"')
    expect(getterCalls).toBe(0)
  })

  it("unknown envelopeのversion値を正規化せず厳密に拒否する", () => {
    const codec = WizWorldSaveCodec.define({
      contentVersion: "strict-v1",
      schema: z.strictObject({ value: z.number() }),
    })
    const parseWithVersion = (schemaVersion: unknown, contentVersion: unknown) =>
      codec.parse({
        schemaVersion,
        contentVersion,
        snapshot: { value: 1 },
      })

    for (const schemaVersion of [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(() => parseWithVersion(schemaVersion, "strict-v1")).toThrow(
        "schemaVersion must be a positive safe integer",
      )
    }
    for (const contentVersion of ["", " ", " strict-v1", "strict-v1 "]) {
      expect(() => parseWithVersion(1, contentVersion)).toThrow(
        "contentVersion must not be blank or have surrounding whitespace",
      )
    }
  })

  it("supported schema/content versionの不一致を専用errorで拒否する", () => {
    const codec = WizWorldSaveCodec.define({
      contentVersion: "world-content-v2",
      schema: z.strictObject({ value: z.number() }),
    })

    expect(() =>
      codec.parse({
        schemaVersion: 2,
        contentVersion: "world-content-v2",
        snapshot: { value: 1 },
      }),
    ).toThrow(WizWorldSaveSchemaVersionError)
    expect(() =>
      codec.parse({
        schemaVersion: 1,
        contentVersion: "world-content-v1",
        snapshot: { value: 1 },
      }),
    ).toThrow(WizWorldSaveContentVersionError)

    try {
      codec.parse({
        schemaVersion: 2,
        contentVersion: "world-content-v2",
        snapshot: { value: 1 },
      })
    } catch (error) {
      expect(error).toMatchObject({
        code: "SCHEMA_VERSION_MISMATCH",
        actualSchemaVersion: 2,
        supportedSchemaVersion: 1,
      })
    }
    try {
      codec.parse({
        schemaVersion: 1,
        contentVersion: "world-content-v1",
        snapshot: { value: 1 },
      })
    } catch (error) {
      expect(error).toMatchObject({
        code: "CONTENT_VERSION_MISMATCH",
        actualContentVersion: "world-content-v1",
        expectedContentVersion: "world-content-v2",
      })
    }
  })

  it("構成時に曖昧なversion値を拒否する", () => {
    for (const contentVersion of ["", "   ", " world-v1", "world-v1 "]) {
      expect(() =>
        WizWorldSaveCodec.define({
          contentVersion,
          schema: z.unknown(),
        }),
      ).toThrow(RangeError)
    }
    expect(() =>
      WizWorldSaveCodec.define({
        contentVersion: "world-v1",
        schemaVersion: Number.MAX_SAFE_INTEGER + 1,
        schema: z.unknown(),
      }),
    ).toThrow(RangeError)
  })

  it("構築時にStandard Schema validatorを捕捉し外部差し替えを受けない", () => {
    const schema = z.strictObject({ version: z.literal(1) })
    const codec = WizWorldSaveCodec.define({
      contentVersion: "world-content-v1",
      schema,
    })
    const privateView = codec as unknown as {
      schema: z.ZodType
    }
    const verifyReadonlyAuthority = () => {
      // @ts-expect-error parse portは構築後に差し替えられない。
      codec.parse = () => Object.freeze({})
      // @ts-expect-error codec factoryは構築後に差し替えられない。
      WizWorldSaveCodec.define = () => codec
    }
    void verifyReadonlyAuthority

    expect(Reflect.ownKeys(codec)).not.toContain("schema")
    expect(Object.isFrozen(WizWorldSaveCodec.prototype)).toBe(true)
    expect(Object.isFrozen(WizWorldSaveCodec)).toBe(true)
    expect(Reflect.set(codec, "schema", z.never())).toBe(false)
    expect(Reflect.set(schema, "parse", () => ({ version: "forged" }))).toBe(true)
    expect(() =>
      Object.defineProperty(WizWorldSaveCodec.prototype, "parse", {
        configurable: true,
        value: (input: unknown) => input,
      }),
    ).toThrow(TypeError)
    expect(() =>
      Object.defineProperty(WizStandardSchema.prototype, "validate", {
        configurable: true,
        value: (input: unknown) => input,
      }),
    ).toThrow(TypeError)
    expect(() =>
      codec.encode({ version: "invalid" } as unknown as { readonly version: 1 }),
    ).toThrow()
    expect(() => privateView.schema.parse({ version: 1 })).toThrow()
  })

  it("所有した同一snapshotを検証してProxyによる検証後差し替えを拒否する", () => {
    const codec = WizWorldSaveCodec.define({
      contentVersion: "proxy-boundary-v1",
      schema: z.strictObject({ value: z.number() }),
    })
    const target = { value: 1 }
    const proxy = new Proxy(target, {
      get: (_target, key) => (key === "value" ? 1 : Reflect.get(target, key)),
      getOwnPropertyDescriptor: (_target, key) =>
        key === "value"
          ? {
              configurable: true,
              enumerable: true,
              value: "not-a-number",
              writable: true,
            }
          : Reflect.getOwnPropertyDescriptor(target, key),
    }) as { value: number }

    expect(() => codec.encode(proxy)).toThrow()
    expect(() =>
      codec.parse({
        schemaVersion: 1,
        contentVersion: "proxy-boundary-v1",
        snapshot: proxy,
      }),
    ).toThrow()
  })

  it("Proxy reflection failureをpath付きserialization errorへ正規化する", () => {
    const codec = WizWorldSaveCodec.define({
      contentVersion: "proxy-reflection-v1",
      schema: z.strictObject({ payload: z.unknown() }),
    })
    const proxy = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          throw new Error("PROXY_TRAP_RAN")
        },
      },
    )

    expect(() => codec.encode({ payload: proxy })).toThrow(
      expect.objectContaining({
        path: "$.snapshot.payload",
        reason: "value could not be inspected safely",
        valueType: "Object",
      }),
    )
  })

  it("null prototype objectをJSONと同じ通常plain objectへ正規化する", () => {
    const codec = WizWorldSaveCodec.define({
      contentVersion: "prototype-canonicalization-v1",
      schema: z.strictObject({
        nested: z.strictObject({ value: z.number() }),
      }),
    })
    const nested = Object.assign(Object.create(null) as { value: number }, { value: 1 })
    const snapshot = Object.assign(Object.create(null) as { nested: { value: number } }, { nested })

    const encoded = codec.encode(snapshot)
    const parsed = codec.parse(JSON.parse(JSON.stringify(encoded)))

    expect(Object.getPrototypeOf(encoded.snapshot)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(encoded.snapshot.nested)).toBe(Object.prototype)
    expect(parsed).toEqual(encoded)
  })

  it("JSON round-tripで意味が変わる値をpath付きで拒否する", () => {
    const codec = WizWorldSaveCodec.define({
      contentVersion: "world-content-v1",
      schema: z.strictObject({ payload: z.unknown() }),
    })

    for (const payload of [
      new Date("2026-01-01T00:00:00.000Z"),
      Number.NaN,
      Number.POSITIVE_INFINITY,
      undefined,
      BigInt(1),
      () => "value",
    ]) {
      expect(() => codec.encode({ payload })).toThrow(WizWorldSaveSerializationError)
    }

    try {
      codec.encode({ payload: { nested: new Date("2026-01-01T00:00:00.000Z") } })
      throw new TypeError("Expected a JSON serialization error")
    } catch (error) {
      expect(error).toBeInstanceOf(WizWorldSaveSerializationError)
      expect(error).toMatchObject({
        code: "NON_JSON_VALUE",
        path: "$.snapshot.payload.nested",
        valueType: "Date",
      })
    }
    expect(() => codec.encode({ payload: { value: -0 } })).toThrow(
      expect.objectContaining({
        path: "$.snapshot.payload.value",
        reason: "negative zero does not survive a JSON round-trip",
      }),
    )
  })

  it("循環参照・sparse配列・JSONで失われるpropertyを拒否する", () => {
    const codec = WizWorldSaveCodec.define({
      contentVersion: "world-content-v1",
      schema: z.strictObject({ payload: z.unknown() }),
    })
    const cyclic: { self?: unknown } = {}
    cyclic.self = cyclic
    const sparse: string[] = []
    sparse.length = 1
    const arrayWithMetadata = ["value"] as string[] & { metadata?: string }
    arrayWithMetadata.metadata = "discarded"
    class SpecializedArray extends Array<string> {
      describe(): string {
        return this.join(",")
      }
    }
    const specializedArray = new SpecializedArray("value")
    const shared = { value: "shared" }
    const objectWithAccessor = Object.defineProperty({}, "value", {
      enumerable: true,
      get: () => "discarded",
    })
    let arrayAccessorCount = 0
    const arrayWithAccessor = ["initial"]
    Object.defineProperty(arrayWithAccessor, "0", {
      enumerable: true,
      get: () => {
        arrayAccessorCount += 1
        return "discarded"
      },
    })

    expect(() => codec.encode({ payload: cyclic })).toThrow(WizWorldSaveSerializationError)
    expect(() => codec.encode({ payload: sparse })).toThrow(WizWorldSaveSerializationError)
    expect(() => codec.encode({ payload: arrayWithMetadata })).toThrow(
      WizWorldSaveSerializationError,
    )
    expect(() => codec.encode({ payload: objectWithAccessor })).toThrow(
      WizWorldSaveSerializationError,
    )
    expect(() => codec.encode({ payload: arrayWithAccessor })).toThrow(
      WizWorldSaveSerializationError,
    )
    expect(() => codec.encode({ payload: specializedArray })).toThrow(
      expect.objectContaining({
        path: "$.snapshot.payload",
        reason:
          "array subclasses and arrays from another realm must be converted to plain arrays first",
      }),
    )
    expect(() => codec.encode({ payload: { first: shared, second: shared } })).toThrow(
      expect.objectContaining({
        path: "$.snapshot.payload.second",
        reason:
          "shared object references are not supported; first encountered at $.snapshot.payload.first",
      }),
    )
    expect(arrayAccessorCount).toBe(0)
  })
})
