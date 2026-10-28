import type { WizPresetValidationDiagnostic } from "@/lib/wiz/core/presets/preset-validation"

export const freezeDiagnostics = (
  diagnostics: readonly WizPresetValidationDiagnostic[]
): readonly WizPresetValidationDiagnostic[] =>
  Object.freeze(
    diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic }))
  )
