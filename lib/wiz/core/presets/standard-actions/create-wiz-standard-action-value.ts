import type {
  WizStandardPublicAction,
  WizStandardActionValueFor,
} from "@/lib/wiz/core/presets/standard-actions/standard-action-value"
import {
  WizStandardActionValue,
  standardActionValueConstructionToken,
} from "@/lib/wiz/core/presets/standard-actions/standard-action-value"

/** @internal */
export const createWizStandardActionValue = <
  TAction extends WizStandardPublicAction,
>(
  origin: symbol,
  action: TAction
): WizStandardActionValueFor<TAction> =>
  WizStandardActionValue.create(
    standardActionValueConstructionToken,
    origin,
    action
  )
