import type { WizState } from "@/lib/wiz/core/runtime/state"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

/**
 * world全体のstandard runtime context。
 *
 * `TExtraState` を指定すると、プラグインシーンを `initialWorldState` に置けるようになる。
 */
export type WizContext<TExtraState = never> = {
  readonly initialVault: WizVaultValue
  readonly initialWorldState: WizState | TExtraState
}

export function wizContext<TExtraState = never>(
  data: WizContext<TExtraState>,
): WizContext<TExtraState> {
  return Object.freeze({
    initialVault: data.initialVault,
    initialWorldState: data.initialWorldState,
  })
}
