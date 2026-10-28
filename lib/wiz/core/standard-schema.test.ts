import { describe, expect, expectTypeOf, it } from "vite-plus/test"
import {
  WizStandardSchema,
  type WizStandardSchemaDefinition,
  WizStandardSchemaValidationError,
} from "@/lib/wiz/core/standard-schema"

type RawLevel = Readonly<{
  level: string
}>

type ParsedLevel = Readonly<{
  level: number
  normalized: true
}>

const levelSchema: WizStandardSchemaDefinition<RawLevel, ParsedLevel> = Object.freeze({
  "~standard": Object.freeze({
    validate: (input: unknown) => {
      if (
        typeof input !== "object" ||
        input === null ||
        !("level" in input) ||
        typeof input.level !== "string"
      ) {
        return {
          issues: [
            {
              message: "level must be a string",
              path: [{ key: "level", ignored: "metadata" }],
            },
          ],
        }
      }

      return {
        value: {
          level: Number(input.level),
          normalized: true as const,
        },
      }
    },
    vendor: "open-wiz-test",
    version: 1,
  }),
})

describe("WizStandardSchema", () => {
  it("手書きStandard Schemaのinput/outputを推論して同期変換する", () => {
    const schema = WizStandardSchema.capture(levelSchema, "Level schema")
    const output = schema.validate({ level: "3" })

    expectTypeOf(schema).toEqualTypeOf<WizStandardSchema<RawLevel, ParsedLevel>>()
    expectTypeOf(output).toEqualTypeOf<ParsedLevel>()
    expect(output).toEqual({ level: 3, normalized: true })
    expect(schema.vendor).toBe("open-wiz-test")
    expect(Object.isFrozen(schema)).toBe(true)
  })

  it("validation authorityをprototypeとstatic factoryの改変から隔離する", () => {
    const schema = WizStandardSchema.capture(levelSchema, "Protected schema")
    const verifyReadonlyAuthority = () => {
      // @ts-expect-error validate portは構築後に差し替えられない。
      schema.validate = () => ({ level: 99, normalized: true })
      // @ts-expect-error capture factoryは構築後に差し替えられない。
      WizStandardSchema.capture = () => schema
    }
    void verifyReadonlyAuthority

    expect(Object.isFrozen(WizStandardSchema.prototype)).toBe(true)
    expect(Object.isFrozen(WizStandardSchema)).toBe(true)
    expect(() =>
      Object.defineProperty(WizStandardSchema.prototype, "validate", {
        configurable: true,
        value: () => ({ level: 99, normalized: true }),
      }),
    ).toThrow(TypeError)
    expect(() =>
      Object.defineProperty(WizStandardSchema, "capture", {
        configurable: true,
        value: () => schema,
      }),
    ).toThrow(TypeError)
    expect(() => schema.validate({ level: 3 })).toThrow(WizStandardSchemaValidationError)
  })

  it("issue/pathを所有したerrorにしvalidator参照を構築時に捕捉する", () => {
    const mutableIssue = {
      message: "invalid",
      path: [{ key: "level", metadata: "before" }],
    }
    const standard = {
      validate: (): ReturnType<
        WizStandardSchemaDefinition<unknown, ParsedLevel>["~standard"]["validate"]
      > => ({ issues: [mutableIssue] }),
      vendor: "mutable-test",
      version: 1 as const,
    }
    const definition: WizStandardSchemaDefinition<unknown, ParsedLevel> = {
      "~standard": standard,
    }
    const schema = WizStandardSchema.capture(definition, "Captured schema")
    standard.validate = () => ({
      value: { level: 99, normalized: true },
    })

    let capturedError: unknown
    try {
      schema.validate(null)
    } catch (error) {
      capturedError = error
    }
    mutableIssue.message = "changed"
    mutableIssue.path[0].key = "changed"

    expect(capturedError).toBeInstanceOf(WizStandardSchemaValidationError)
    expect(capturedError).toMatchObject({
      code: "STANDARD_SCHEMA_VALIDATION_FAILED",
      source: "Captured schema",
      issues: [
        {
          message: "invalid",
          path: [{ key: "level" }],
        },
      ],
    })
    const validationError = capturedError as WizStandardSchemaValidationError
    expect(Object.isFrozen(validationError)).toBe(true)
    expect(Object.isFrozen(validationError.issues)).toBe(true)
    expect(Object.isFrozen(validationError.issues[0]?.path)).toBe(true)
  })

  it("async/thenable validatorを同期境界で拒否する", () => {
    const asynchronous: WizStandardSchemaDefinition<unknown, ParsedLevel> = {
      "~standard": {
        validate: async () => ({ value: { level: 1, normalized: true } }),
        vendor: "async-test",
        version: 1,
      },
    }
    const thenable: WizStandardSchemaDefinition<unknown, ParsedLevel> = {
      "~standard": {
        validate: () => {
          const promise = Promise.resolve({
            value: { level: 1, normalized: true as const },
          })
          const customThenable: PromiseLike<{
            value: {
              level: number
              normalized: true
            }
          }> = Object.create(null)
          // eslint-disable-next-line unicorn/no-thenable -- 同期Promise以外のthenable拒否を検証する。
          Object.defineProperty(customThenable, "then", {
            value: promise.then.bind(promise),
          })

          return customThenable
        },
        vendor: "thenable-test",
        version: 1,
      },
    }

    expect(() => WizStandardSchema.capture(asynchronous, "Async schema").validate(null)).toThrow(
      "Async schema must validate synchronously",
    )
    expect(() => WizStandardSchema.capture(thenable, "Thenable schema").validate(null)).toThrow(
      "Thenable schema must validate synchronously",
    )
  })
})
