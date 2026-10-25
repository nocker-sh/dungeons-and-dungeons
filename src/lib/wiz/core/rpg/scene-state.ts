import {
  WIZ_IMMUTABLE_VALUE,
  type WizDeepReadonly,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { WizStandardSceneName } from "@/lib/wiz/core/runtime/standard-scene-name"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

const sceneDataOwnership = new WizObjectService()

/**
 * 標準scene runtimeへ独自sceneを追加するための、汎用immutable state。
 *
 * scene固有値を`data`へまとめることで、vault更新の定型実装を繰り返さずに済む。
 * `withData` / `mapData` / `withVault` は元のinstanceを変更せず新しいstateを返す。
 */
export class WizRpgSceneState<TType extends string, TData extends object> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly type: TType
  readonly vault: WizVaultValue
  readonly data: WizDeepReadonly<TData>

  private constructor(type: TType, vault: WizVaultValue, data: TData | WizDeepReadonly<TData>) {
    WizStandardSceneName.assertPlugin(type)
    this.type = type
    this.vault = vault
    this.data = sceneDataOwnership.ownImmutable<TData>(data)
    WizImmutableValue.freeze(this)
  }

  static create<const TType extends string, const TData extends object>(
    type: TType,
    vault: WizVaultValue,
    data: TData,
  ): WizRpgSceneState<TType, TData> {
    return new WizRpgSceneState(type, vault, data)
  }

  withVault(vault: WizVaultValue): WizRpgSceneState<TType, TData> {
    return new WizRpgSceneState(this.type, vault, this.data)
  }

  updateVault(update: (vault: WizVaultValue) => WizVaultValue): WizRpgSceneState<TType, TData> {
    return this.withVault(update(this.vault))
  }

  withData<TNextData extends object>(data: TNextData): WizRpgSceneState<TType, TNextData> {
    return new WizRpgSceneState(this.type, this.vault, data)
  }

  mapData<TNextData extends object>(
    update: (data: WizDeepReadonly<TData>) => TNextData,
  ): WizRpgSceneState<TType, TNextData> {
    return this.withData(update(this.data))
  }
}

Object.freeze(WizRpgSceneState.prototype)
Object.freeze(WizRpgSceneState)
