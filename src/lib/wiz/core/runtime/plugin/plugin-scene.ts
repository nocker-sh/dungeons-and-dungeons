import type { WizImmutableValueContract } from "@/lib/wiz/core/immutable-value"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

/**
 * プラグインシーンが満たすべき最小契約。
 *
 * カスタムシーンを `WizRootReducer` に登録するには、シーン状態がこの形を満たす必要がある:
 * - `type` で discriminated union として識別される
 * - `vault` を保持し、`withVault` / `updateVault` で更新できる
 * - `WizImmutableValue` contractを宣言し、observableな可変状態を持たない
 *
 * 既存の `WizStateVillage` などはすべてこの形を満たしている (`type` フィールドと vault 操作)。
 */
export type WizPluginSceneState = WizImmutableValueContract &
  Readonly<{
    type: string
    vault: WizVaultValue
    withVault(vault: WizVaultValue): WizPluginSceneState
    updateVault(fn: (vault: WizVaultValue) => WizVaultValue): WizPluginSceneState
  }>

/**
 * プラグインアクションが満たすべき最小契約。
 */
export type WizPluginSceneAction = {
  readonly type: string
}
