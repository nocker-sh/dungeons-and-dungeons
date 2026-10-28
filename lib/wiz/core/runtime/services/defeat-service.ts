import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export type WizRuntimeVaultState<TState> = Readonly<{
  readonly vault: WizVaultValue
  readonly withVault: (vault: WizVaultValue) => TState
  readonly updateVault: (update: (vault: WizVaultValue) => WizVaultValue) => TState
}>

export type WizRuntimeDefeatCheckResult<TState> = Readonly<{
  state: TState
  defeated: boolean
}>

/** 敗北後のworld stateを決める差し替え可能なruntime port。 */
export type WizRuntimeDefeatPolicy = Readonly<{
  readonly check: <TState extends WizRuntimeVaultState<TState>>(
    state: TState,
  ) => Readonly<{ state: TState; defeated?: boolean }>
}>

/** playerの敗北条件を評価するruntime service。 */
export class WizRuntimeDefeatService implements WizRuntimeDefeatPolicy {
  constructor() {
    Object.freeze(this)
  }

  check<TState extends WizRuntimeVaultState<TState>>(
    state: TState,
  ): WizRuntimeDefeatCheckResult<TState> {
    const defeated = state.vault.player.isDead()
    return Object.freeze({
      state:
        defeated && !state.vault.isEnded
          ? state.updateVault((vault) => vault.withEnded(true))
          : state,
      defeated,
    })
  }
}
