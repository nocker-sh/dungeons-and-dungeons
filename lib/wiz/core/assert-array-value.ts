import type { WizValueValidationSource } from "@/lib/wiz/core/value-validation"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

export function assertArrayValue(
  source: WizValueValidationSource,
  path: string,
  value: unknown
): asserts value is readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new WizValueValidationError(source, path, value, "an array")
  }
}
