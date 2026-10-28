import type { MutableDiagnostic } from "@/lib/wiz/core/presets/preset-validation"
import { diagnoseFinite } from "@/lib/wiz/core/presets/diagnose-finite"

export const diagnoseRange = (
  diagnostics: MutableDiagnostic[],
  path: string,
  value: number,
  minimum: number,
  maximum: number | undefined,
  expected: "probability" | "percentage" | "non_negative_number"
): void => {
  if (!diagnoseFinite(diagnostics, path, value)) {
    return
  }
  if (value >= minimum && (maximum === undefined || value <= maximum)) {
    return
  }
  const range =
    maximum === undefined ? `${minimum} or greater` : `${minimum}..${maximum}`
  diagnostics.push({
    code: "out_of_range",
    path,
    value,
    minimum,
    ...(maximum === undefined ? {} : { maximum }),
    expected,
    message: `${path} must be within ${range}; received ${value}`,
  })
}
