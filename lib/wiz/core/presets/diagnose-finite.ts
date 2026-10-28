import type { MutableDiagnostic } from "@/lib/wiz/core/presets/preset-validation"

export const diagnoseFinite = (
  diagnostics: MutableDiagnostic[],
  path: string,
  value: number
): boolean => {
  if (Number.isFinite(value)) {
    return true
  }
  diagnostics.push({
    code: "not_finite",
    path,
    value,
    expected: "finite_number",
    message: `${path} must be a finite number; received ${String(value)}`,
  })
  return false
}
