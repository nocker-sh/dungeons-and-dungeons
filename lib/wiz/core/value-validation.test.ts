import { describe, expect, it } from "vite-plus/test"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

describe("WizValueValidationError", () => {
  it("diagnostic valueをdefensive copyしてdeep freezeする", () => {
    const value = { output: [{ amount: Number.NaN }] }
    const error = new WizValueValidationError(
      "damage-calculator",
      "damageFormula",
      value,
      "a finite non-negative number"
    )

    value.output[0]!.amount = 10

    expect(error.value).toEqual({
      output: [{ amount: Number.NaN }],
    })
    expect(Object.isFrozen(error)).toBe(true)
    expect(Object.isFrozen(error.value)).toBe(true)
    const diagnostic = error.value as {
      readonly output: readonly Readonly<{ amount: number }>[]
    }
    expect(Object.isFrozen(diagnostic.output)).toBe(true)
    expect(Object.isFrozen(diagnostic.output[0])).toBe(true)
  })

  it("diagnostic型名の取得でconstructor getterを実行しない", () => {
    class ExternalValue {}
    const value = new ExternalValue()
    Object.defineProperty(value, "constructor", {
      get: () => {
        throw new Error("constructor getter must not execute")
      },
    })

    const error = new WizValueValidationError(
      "damage-calculator",
      "damageFormula",
      value,
      "a plain value"
    )

    expect(error.value).toEqual({ valueType: "ExternalValue" })
  })
})
