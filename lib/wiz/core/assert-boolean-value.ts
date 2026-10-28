import type { WizValueValidationSource } from "@/lib/wiz/core/value-validation"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

export function assertBooleanValue(
  source: WizValueValidationSource,
  path: string,
  value: unknown
): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new WizValueValidationError(source, path, value, "a boolean")
  }
}
