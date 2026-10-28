import type {
  WizValueValidationSource,
  NumericConstraints,
} from "@/lib/wiz/core/value-validation"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"
import { numericExpectation } from "@/lib/wiz/core/numeric-expectation"

export function assertFiniteNumberValue(
  source: WizValueValidationSource,
  path: string,
  value: unknown,
  constraints: NumericConstraints = {}
): asserts value is number {
  const isInteger = constraints.safeInteger
    ? Number.isSafeInteger(value)
    : !constraints.integer || Number.isInteger(value)
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !isInteger ||
    (constraints.minimum !== undefined && value < constraints.minimum) ||
    (constraints.maximum !== undefined && value > constraints.maximum)
  ) {
    throw new WizValueValidationError(
      source,
      path,
      value,
      numericExpectation(constraints)
    )
  }
}
