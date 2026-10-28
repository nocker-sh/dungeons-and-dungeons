import type { WizValueValidationSource } from "@/lib/wiz/core/value-validation"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

export function assertTrimmedNonEmptyStringValue(
  source: WizValueValidationSource,
  path: string,
  value: unknown
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value !== value.trim()
  ) {
    throw new WizValueValidationError(
      source,
      path,
      value,
      "a non-empty string without surrounding whitespace"
    )
  }
}
