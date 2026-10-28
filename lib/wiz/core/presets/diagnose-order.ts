import type { MutableDiagnostic } from "@/lib/wiz/core/presets/preset-validation"

export const diagnoseOrder = (
  diagnostics: MutableDiagnostic[],
  path: string,
  minimumPath: string,
  minimum: number,
  maximumPath: string,
  maximum: number
): void => {
  if (
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    minimum <= maximum
  ) {
    return
  }
  diagnostics.push({
    code: "invalid_order",
    path,
    minimumPath,
    maximumPath,
    minimum,
    maximum,
    message: `${minimumPath} must be less than or equal to ${maximumPath}; received ${minimum}..${maximum}`,
  })
}
