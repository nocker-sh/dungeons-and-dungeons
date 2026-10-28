import type { MutableDiagnostic } from "@/lib/wiz/core/presets/preset-validation"
import { diagnoseFinite } from "@/lib/wiz/core/presets/diagnose-finite"
import { diagnoseRange } from "@/lib/wiz/core/presets/diagnose-range"

export const diagnoseNonNegativeInteger = (
  diagnostics: MutableDiagnostic[],
  path: string,
  value: number
): void => {
  if (!diagnoseFinite(diagnostics, path, value)) {
    return
  }
  if (!Number.isInteger(value)) {
    diagnostics.push({
      code: "not_integer",
      path,
      value,
      expected: "non_negative_integer",
      message: `${path} must be a non-negative integer; received ${value}`,
    })
    return
  }
  diagnoseRange(diagnostics, path, value, 0, undefined, "non_negative_number")
}
