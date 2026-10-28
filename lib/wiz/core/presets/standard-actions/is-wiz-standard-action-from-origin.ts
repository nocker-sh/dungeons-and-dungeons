import type {
  WizStandardActionValueFor,
  WizStandardPublicAction,
} from "@/lib/wiz/core/presets/standard-actions/standard-action-value"
import {
  WizStandardActionValue,
  standardActionOrigins,
} from "@/lib/wiz/core/presets/standard-actions/standard-action-value"

/** @internal */
export const isWizStandardActionFromOrigin = (
  action: unknown,
  origin: symbol
): action is WizStandardActionValueFor<WizStandardPublicAction> =>
  action instanceof WizStandardActionValue &&
  standardActionOrigins.get(action) === origin
