import type { WizValueValidationSource } from "@/lib/wiz/core/value-validation"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

export function assertRecordValue(
  source: WizValueValidationSource,
  path: string,
  value: unknown
): asserts value is Readonly<Record<PropertyKey, unknown>> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new WizValueValidationError(source, path, value, "a plain object")
  }
}
