import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"

const rpgWorldStateConstructionToken = Symbol("WizRpgWorldState.constructor")
const stateOwnership = new WizObjectService()

export type WizRpgFeatureStates = Readonly<Record<string, unknown>>

/**
 * sceneと横断的feature stateを分離して所有するRPG root state。
 *
 * scene遷移でfeature stateを失わず、各更新は新しいroot instanceを返す。
 */
export class WizRpgWorldState<
  TScene,
  TFeatures extends WizRpgFeatureStates = Readonly<Record<never, never>>,
> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly scene: WizDeepReadonly<TScene>
  readonly features: WizDeepReadonly<TFeatures>

  private constructor(
    token: symbol,
    scene: TScene | WizDeepReadonly<TScene>,
    features: TFeatures | WizDeepReadonly<TFeatures>
  ) {
    if (token !== rpgWorldStateConstructionToken) {
      throw new TypeError("WizRpgWorldState must be created with create()")
    }
    this.scene = stateOwnership.ownImmutable<TScene>(scene)
    this.features = stateOwnership.ownImmutable<TFeatures>(features)
    WizImmutableValue.freeze(this)
  }

  static create<TScene>(
    scene: TScene | WizDeepReadonly<TScene>
  ): WizRpgWorldState<TScene, Readonly<Record<never, never>>>
  static create<TScene, TFeatures extends WizRpgFeatureStates>(
    scene: TScene | WizDeepReadonly<TScene>,
    features: TFeatures | WizDeepReadonly<TFeatures>
  ): WizRpgWorldState<TScene, TFeatures>
  static create<TScene, TFeatures extends WizRpgFeatureStates>(
    scene: TScene | WizDeepReadonly<TScene>,
    features?: TFeatures | WizDeepReadonly<TFeatures>
  ): WizRpgWorldState<TScene, TFeatures | Readonly<Record<never, never>>> {
    return new WizRpgWorldState<
      TScene,
      TFeatures | Readonly<Record<never, never>>
    >(rpgWorldStateConstructionToken, scene, features ?? Object.freeze({}))
  }

  feature<TKey extends keyof TFeatures>(
    key: TKey
  ): WizDeepReadonly<TFeatures[TKey]> {
    return this.features[
      key as keyof WizDeepReadonly<TFeatures>
    ] as WizDeepReadonly<TFeatures[TKey]>
  }

  withScene<TNextScene>(
    scene: TNextScene | WizDeepReadonly<TNextScene>
  ): WizRpgWorldState<TNextScene, TFeatures> {
    return new WizRpgWorldState<TNextScene, TFeatures>(
      rpgWorldStateConstructionToken,
      scene,
      this.features
    )
  }

  withFeature<TKey extends string, TFeatureState>(
    key: TKey,
    featureState: TFeatureState | WizDeepReadonly<TFeatureState>
  ): WizRpgWorldState<
    TScene,
    TFeatures & Readonly<Record<TKey, TFeatureState>>
  > {
    if (key.trim().length === 0 || key !== key.trim()) {
      throw new RangeError(
        "RPG feature key must be a non-blank string without surrounding whitespace"
      )
    }
    return new WizRpgWorldState<
      TScene,
      TFeatures & Readonly<Record<TKey, TFeatureState>>
    >(rpgWorldStateConstructionToken, this.scene, {
      ...this.features,
      [key]: featureState,
    } as WizDeepReadonly<TFeatures & Readonly<Record<TKey, TFeatureState>>>)
  }
}

Object.freeze(WizRpgWorldState.prototype)
Object.freeze(WizRpgWorldState)
