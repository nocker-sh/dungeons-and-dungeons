import type {
  WizPresetValidationDiagnostic,
  WizPresetValidationInput,
} from "@/lib/wiz/core/presets/preset-validation"
import { freezeDiagnostics } from "@/lib/wiz/core/presets/freeze-diagnostics"
import { diagnoseWizPreset } from "@/lib/wiz/core/presets/diagnose-wiz-preset"

export class WizPresetValidationError extends Error {
  override readonly name = "WizPresetValidationError"
  readonly diagnostics: readonly WizPresetValidationDiagnostic[]

  constructor(diagnostics: readonly WizPresetValidationDiagnostic[]) {
    const immutableDiagnostics = freezeDiagnostics(diagnostics)
    super(
      `Preset validation failed with ${immutableDiagnostics.length} diagnostic${
        immutableDiagnostics.length === 1 ? "" : "s"
      }`
    )
    this.diagnostics = immutableDiagnostics
    Object.freeze(this)
  }
}

export function assertValidWizPreset(preset: WizPresetValidationInput): void {
  const diagnostics = diagnoseWizPreset(preset)
  if (diagnostics.length > 0) {
    throw new WizPresetValidationError(diagnostics)
  }
}

Object.freeze(WizPresetValidationError.prototype)

Object.freeze(WizPresetValidationError)
