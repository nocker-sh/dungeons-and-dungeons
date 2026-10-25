import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import { type WorldContentSnapshotData, WorldContent } from "@/lib/wiz/core/content/world-content"
import type { WizItemEffectApplicationService } from "@/lib/wiz/core/domain/services/item-effect-service"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizRpgBattleModel } from "@/lib/wiz/core/rpg/battle-model"
import { WizRpgComponentIdentity } from "@/lib/wiz/core/rpg/component-identity"
import { WizRpgSceneRuntime } from "@/lib/wiz/core/rpg/scene-runtime"
import { WizRpgScenes } from "@/lib/wiz/core/rpg/scenes"
import { WizRpgWorld } from "@/lib/wiz/core/rpg/world"
import {
  type WizRpgRuntimeIdentityComponentKind,
  WizRpgWorldIdentity,
} from "@/lib/wiz/core/rpg/world-identity"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import { WizRpgMechanics } from "@/lib/wiz/core/presets/rpg-mechanics"
import {
  type WizStandardPluginSceneSnapshotData,
  type WizStandardRewardCustomCodec,
  type WizStandardSessionPluginSceneState,
  WizStandardSessionCodec,
} from "@/lib/wiz/core/presets/standard-session"
import {
  type WizStandardAction,
  type WizStandardActions,
  type WizStandardEvent,
  type WizStandardRejectionReason,
  type WizStandardSceneWorldOptions,
  type WizStandardState,
  WizStandardSceneWorld,
} from "@/lib/wiz/core/presets/standard-scene-world"
import { type WizPreset, WizPresetValue } from "@/lib/wiz/core/presets/wiz-preset"
import type { WizPluginSceneAction } from "@/lib/wiz/core/runtime/plugin/plugin-scene"
import { WizPluginSceneNavigation } from "@/lib/wiz/core/runtime/plugin/plugin-scene-navigation"
import type { WizSceneBattleMonsterAuthority } from "@/lib/wiz/core/runtime/converters/battle-monster-adapter"
import type { WizSceneTransition } from "@/lib/wiz/core/runtime/scene-transition"
import type { WorldSnapshot } from "@/lib/wiz/core/save/world-snapshot"
import type {
  WizBattleMonsterCustom,
  WizBattleStatusCustom,
  WizDefaultTypes,
  WizTypes,
} from "@/lib/wiz/core/types/wiz-types"
import type { WizVaultPlayer } from "@/lib/wiz/core/vault/states/player/value"
import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"

const worldDefinitionConstructionToken = Symbol("WizRpgWorldDefinition.constructor")
const worldDefinitionOwnership = new WizObjectService()

const captureItemEffect = (
  itemEffect: WizItemEffectApplicationService<WizVaultPlayer>,
): WizItemEffectApplicationService<WizVaultPlayer> => {
  if (
    typeof itemEffect !== "object" ||
    itemEffect === null ||
    typeof itemEffect.apply !== "function"
  ) {
    throw new TypeError("RPG item effect must provide apply()")
  }
  return Object.freeze({
    apply: Object.freeze(itemEffect.apply.bind(itemEffect)),
  })
}

type StandardScene<
  TSceneState extends WizStandardSessionPluginSceneState,
  TTypes extends WizTypes,
  TRewardCustom,
> = WizStandardState<TSceneState, TTypes, TRewardCustom>

type StandardEvent<
  TSceneState extends WizStandardSessionPluginSceneState,
  TActionOutput extends WizPluginSceneAction,
  TPluginEvent,
  TTypes extends WizTypes,
> = WizStandardEvent<TSceneState, TActionOutput, TPluginEvent, TTypes>

type StandardCommand<TSceneState extends WizStandardSessionPluginSceneState, TActionInput> =
  | WizStandardAction<TActionInput>
  | WizPluginSceneNavigation<TSceneState>

type WizRpgRuntimeComponentIdentity = Readonly<{
  identity: WizRpgComponentIdentity
  key: string
  kind: WizRpgRuntimeIdentityComponentKind
}>

const withRuntimeComponentIdentity = (
  components: readonly WizRpgRuntimeComponentIdentity[],
  kind: WizRpgRuntimeIdentityComponentKind,
  key: string,
  identity: WizRpgComponentIdentity,
  replacedKinds: readonly WizRpgRuntimeIdentityComponentKind[] = [],
): readonly WizRpgRuntimeComponentIdentity[] => {
  const authenticIdentity = WizRpgComponentIdentity.require(
    identity,
    `RPG ${kind} component identity`,
  )
  return Object.freeze(
    [
      ...components.filter(
        (component) =>
          !replacedKinds.includes(component.kind) &&
          (component.kind !== kind || component.key !== key),
      ),
      Object.freeze({ identity: authenticIdentity, key, kind }),
    ].sort(
      (left, right) => left.kind.localeCompare(right.kind) || left.key.localeCompare(right.key),
    ),
  )
}

export type WizRpgStandardWorld<
  TArrays extends WorldContentArrays,
  TTypes extends WizTypes = WizDefaultTypes,
  TRewardCustom = undefined,
  TMechanicsReason extends string = never,
  TSceneState extends WizStandardSessionPluginSceneState = never,
  TActionInput = never,
  TActionOutput extends WizPluginSceneAction = never,
  TPluginEvent = never,
  TPluginReason extends string = never,
> = WizRpgWorld<
  StandardScene<TSceneState, TTypes, TRewardCustom>,
  StandardCommand<TSceneState, TActionInput>,
  StandardEvent<TSceneState, TActionOutput, TPluginEvent, TTypes>,
  WizStandardRejectionReason<TPluginReason, TMechanicsReason>,
  WizStandardActions<TArrays>
>

type WizRpgWorldDefinitionData<
  TArrays extends WorldContentArrays,
  TTypes extends WizTypes,
  TRewardCustom,
  TRewardInput,
  TMechanicsReason extends string,
  TSceneState extends WizStandardSessionPluginSceneState,
  TActionInput,
  TActionOutput extends WizPluginSceneAction,
  TPluginEvent,
  TPluginReason extends string,
  TPluginData extends object,
  TPluginSnapshot extends WizStandardPluginSceneSnapshotData<TPluginData>,
  TPluginContent extends WorldContentArrays,
> = Readonly<{
  components: readonly WizRpgRuntimeComponentIdentity[]
  content: WorldContent<TArrays>
  revision: string
  initialSnapshot?:
    | WorldSnapshot<WorldContentSnapshotData<TArrays>>
    | WorldContentSnapshotData<TArrays>
  initialTransition?: WizSceneTransition
  environment?: WizWorldEnvironment
  itemEffect?: WizItemEffectApplicationService<WizVaultPlayer>
  mechanics?: WizRpgMechanics<TTypes, TRewardCustom, TArrays, TMechanicsReason>
  preset?: WizPresetValue<TTypes>
  battleMonsterAdapter?: WizSceneBattleMonsterAuthority<
    WizBattleStatusCustom<TTypes["BattleStatus"]>,
    WizBattleMonsterCustom<TTypes>
  >
  rewardCodec?: WizStandardRewardCustomCodec<TRewardCustom, TRewardInput>
  scenes?: WizRpgScenes<
    TSceneState,
    TActionInput,
    TActionOutput,
    TPluginEvent,
    TPluginReason,
    TPluginData,
    TPluginSnapshot,
    TPluginContent
  >
}>

/**
 * 標準RPG scene featureを段階的に構成する不変definition。
 *
 * `with*()`は常に新しいdefinitionを返し、`build()`で汎用RPG rootへ接続する。
 */
export class WizRpgWorldDefinition<
  TArrays extends WorldContentArrays,
  TTypes extends WizTypes = WizDefaultTypes,
  TRewardCustom = undefined,
  TRewardInput = TRewardCustom,
  TMechanicsReason extends string = never,
  TSceneState extends WizStandardSessionPluginSceneState = never,
  TActionInput = never,
  TActionOutput extends WizPluginSceneAction = never,
  TPluginEvent = never,
  TPluginReason extends string = never,
  TPluginData extends object = object,
  TPluginSnapshot extends WizStandardPluginSceneSnapshotData<TPluginData> = never,
  TPluginContent extends WorldContentArrays = WorldContentArrays,
> {
  readonly #data: WizRpgWorldDefinitionData<
    TArrays,
    TTypes,
    TRewardCustom,
    TRewardInput,
    TMechanicsReason,
    TSceneState,
    TActionInput,
    TActionOutput,
    TPluginEvent,
    TPluginReason,
    TPluginData,
    TPluginSnapshot,
    TPluginContent
  >

  private constructor(
    token: symbol,
    data: WizRpgWorldDefinitionData<
      TArrays,
      TTypes,
      TRewardCustom,
      TRewardInput,
      TMechanicsReason,
      TSceneState,
      TActionInput,
      TActionOutput,
      TPluginEvent,
      TPluginReason,
      TPluginData,
      TPluginSnapshot,
      TPluginContent
    >,
  ) {
    if (token !== worldDefinitionConstructionToken) {
      throw new TypeError("WizRpgWorldDefinition must be created with forContent()")
    }
    this.#data = Object.freeze({
      ...data,
      components: Object.freeze([...data.components]),
    })
    Object.freeze(this)
  }

  static forContent<const TArrays extends WorldContentArrays>(
    content: WorldContent<TArrays>,
    revision: string,
  ): WizRpgWorldDefinition<TArrays> {
    WorldContent.require(content, "RPG world content")
    if (revision.trim().length === 0 || revision !== revision.trim()) {
      throw new RangeError(
        "RPG world revision must be a non-blank string without surrounding whitespace",
      )
    }
    return new WizRpgWorldDefinition(worldDefinitionConstructionToken, {
      components: Object.freeze([]),
      content,
      revision,
    })
  }

  withInitialSnapshot(
    initialSnapshot:
      | WorldSnapshot<WorldContentSnapshotData<TArrays>>
      | WorldContentSnapshotData<TArrays>,
  ): WizRpgWorldDefinition<
    TArrays,
    TTypes,
    TRewardCustom,
    TRewardInput,
    TMechanicsReason,
    TSceneState,
    TActionInput,
    TActionOutput,
    TPluginEvent,
    TPluginReason,
    TPluginData,
    TPluginSnapshot,
    TPluginContent
  > {
    return new WizRpgWorldDefinition(worldDefinitionConstructionToken, {
      ...this.#data,
      initialSnapshot: this.#data.content.validateSnapshot(initialSnapshot),
    })
  }

  withInitialTransition(
    initialTransition: WizSceneTransition,
  ): WizRpgWorldDefinition<
    TArrays,
    TTypes,
    TRewardCustom,
    TRewardInput,
    TMechanicsReason,
    TSceneState,
    TActionInput,
    TActionOutput,
    TPluginEvent,
    TPluginReason,
    TPluginData,
    TPluginSnapshot,
    TPluginContent
  > {
    return new WizRpgWorldDefinition(worldDefinitionConstructionToken, {
      ...this.#data,
      initialTransition: worldDefinitionOwnership.ownImmutable(initialTransition),
    })
  }

  withEnvironment(
    environment: WizWorldEnvironment,
    identity: WizRpgComponentIdentity,
  ): WizRpgWorldDefinition<
    TArrays,
    TTypes,
    TRewardCustom,
    TRewardInput,
    TMechanicsReason,
    TSceneState,
    TActionInput,
    TActionOutput,
    TPluginEvent,
    TPluginReason,
    TPluginData,
    TPluginSnapshot,
    TPluginContent
  > {
    WizWorldEnvironment.require(environment, "RPG world environment")
    return new WizRpgWorldDefinition(worldDefinitionConstructionToken, {
      ...this.#data,
      components: withRuntimeComponentIdentity(
        this.#data.components,
        "environment",
        "environment",
        identity,
      ),
      environment,
    })
  }

  withItemEffect(
    itemEffect: WizItemEffectApplicationService<WizVaultPlayer>,
    identity: WizRpgComponentIdentity,
  ): WizRpgWorldDefinition<
    TArrays,
    TTypes,
    TRewardCustom,
    TRewardInput,
    TMechanicsReason,
    TSceneState,
    TActionInput,
    TActionOutput,
    TPluginEvent,
    TPluginReason,
    TPluginData,
    TPluginSnapshot,
    TPluginContent
  > {
    return new WizRpgWorldDefinition(worldDefinitionConstructionToken, {
      ...this.#data,
      components: withRuntimeComponentIdentity(
        this.#data.components,
        "item-effect",
        "item-effect",
        identity,
      ),
      itemEffect: captureItemEffect(itemEffect),
    })
  }

  withMechanics<TNextReason extends string>(
    mechanics: WizRpgMechanics<TTypes, TRewardCustom, TArrays, TNextReason>,
    identity: WizRpgComponentIdentity,
  ): WizRpgWorldDefinition<
    TArrays,
    TTypes,
    TRewardCustom,
    TRewardInput,
    TNextReason,
    TSceneState,
    TActionInput,
    TActionOutput,
    TPluginEvent,
    TPluginReason,
    TPluginData,
    TPluginSnapshot,
    TPluginContent
  > {
    WizRpgMechanics.require(mechanics, "RPG mechanics")
    return new WizRpgWorldDefinition(worldDefinitionConstructionToken, {
      ...this.#data,
      components: withRuntimeComponentIdentity(
        this.#data.components,
        "mechanics",
        "mechanics",
        identity,
      ),
      mechanics,
    })
  }

  withPreset(
    preset: WizPreset<TTypes>,
    identity: WizRpgComponentIdentity,
  ): WizRpgWorldDefinition<
    TArrays,
    TTypes,
    TRewardCustom,
    TRewardInput,
    TMechanicsReason,
    TSceneState,
    TActionInput,
    TActionOutput,
    TPluginEvent,
    TPluginReason,
    TPluginData,
    TPluginSnapshot,
    TPluginContent
  > {
    const presetValue = WizPresetValue.from(preset)
    return new WizRpgWorldDefinition(worldDefinitionConstructionToken, {
      ...this.#data,
      components: withRuntimeComponentIdentity(this.#data.components, "preset", "preset", identity),
      preset: presetValue,
    })
  }

  withBattleModel<
    TNextTypes extends WizTypes,
    TNextRewardCustom,
    TNextRewardInput,
    TNextReason extends string,
  >(
    model: WizRpgBattleModel<TNextTypes, TNextRewardCustom, TNextRewardInput, TArrays, TNextReason>,
    identity: WizRpgComponentIdentity,
  ): WizRpgWorldDefinition<
    TArrays,
    TNextTypes,
    TNextRewardCustom,
    TNextRewardInput,
    TNextReason,
    TSceneState,
    TActionInput,
    TActionOutput,
    TPluginEvent,
    TPluginReason,
    TPluginData,
    TPluginSnapshot,
    TPluginContent
  > {
    WizRpgBattleModel.require(model, "RPG battle model")
    return new WizRpgWorldDefinition(worldDefinitionConstructionToken, {
      ...this.#data,
      battleMonsterAdapter: model.monsterAdapter,
      components: withRuntimeComponentIdentity(
        this.#data.components,
        "battle-model",
        "battle-model",
        identity,
        ["mechanics", "preset"],
      ),
      mechanics: model.mechanics,
      preset: model.preset,
      rewardCodec: model.rewardCodec,
    })
  }

  withScenes<
    TNextState extends WizStandardSessionPluginSceneState,
    TNextActionInput,
    TNextActionOutput extends WizPluginSceneAction,
    TNextEvent,
    TNextReason extends string,
    TNextData extends object,
    TNextSnapshot extends WizStandardPluginSceneSnapshotData<TNextData>,
    TNextContent extends WorldContentArrays,
  >(
    scenes: WizRpgScenes<
      TNextState,
      TNextActionInput,
      TNextActionOutput,
      TNextEvent,
      TNextReason,
      TNextData,
      TNextSnapshot,
      TNextContent
    > &
      (TArrays extends TNextContent ? unknown : never),
    identity: WizRpgComponentIdentity,
  ): WizRpgWorldDefinition<
    TArrays,
    TTypes,
    TRewardCustom,
    TRewardInput,
    TMechanicsReason,
    TNextState,
    TNextActionInput,
    TNextActionOutput,
    TNextEvent,
    TNextReason,
    TNextData,
    TNextSnapshot,
    TNextContent
  > {
    WizRpgScenes.require(scenes, "RPG scenes")
    return new WizRpgWorldDefinition(worldDefinitionConstructionToken, {
      ...this.#data,
      components: withRuntimeComponentIdentity(this.#data.components, "scenes", "scenes", identity),
      scenes,
    })
  }

  build(): WizRpgStandardWorld<
    TArrays,
    TTypes,
    TRewardCustom,
    TMechanicsReason,
    TSceneState,
    TActionInput,
    TActionOutput,
    TPluginEvent,
    TPluginReason
  > {
    const identity = this.#data.components.reduce(
      (current, component) => component.identity.extend(current, component.kind, component.key),
      WizRpgWorldIdentity.create(this.#data.content.arrays, this.#data.revision),
    )
    const components = this.#data.components.map((component) =>
      component.identity.describe(component.kind, component.key),
    )
    const scenes = this.#data.scenes
    const sceneWorldOptions = {
      battleMonsterAdapter: this.#data.battleMonsterAdapter,
      content: this.#data.content,
      environment: this.#data.environment,
      initialSnapshot: this.#data.initialSnapshot,
      initialTransition: this.#data.initialTransition,
      itemEffect: this.#data.itemEffect,
      mechanics: this.#data.mechanics,
      pluginScenes: scenes?.registry,
      preset: this.#data.preset ?? (WizPresetValue.create() as unknown as WizPresetValue<TTypes>),
    } as unknown as Omit<
      WizStandardSceneWorldOptions<
        TArrays,
        TSceneState,
        TActionInput,
        TActionOutput,
        TTypes,
        TPluginEvent,
        TPluginReason,
        TRewardCustom,
        TMechanicsReason
      >,
      "preset"
    > &
      Readonly<{ preset: WizPresetValue<TTypes> }>
    const sceneWorld = WizStandardSceneWorld.create<
      TArrays,
      TTypes,
      TSceneState,
      TActionInput,
      TActionOutput,
      TPluginEvent,
      TPluginReason,
      TRewardCustom,
      TMechanicsReason
    >(sceneWorldOptions)
    const rewardCodec = this.#data.rewardCodec
    const sceneCodec = (scenes === undefined
      ? rewardCodec === undefined
        ? WizStandardSessionCodec.create({
            contentVersion: identity.value,
          })
        : WizStandardSessionCodec.create({
            contentVersion: identity.value,
            rewardCustom: rewardCodec,
          })
      : rewardCodec === undefined
        ? WizStandardSessionCodec.create({
            contentVersion: identity.value,
            pluginScenes: scenes.codecs,
          })
        : WizStandardSessionCodec.create({
            contentVersion: identity.value,
            pluginScenes: scenes.codecs,
            rewardCustom: rewardCodec,
          })) as unknown as WizStandardSessionCodec<
      TSceneState,
      TPluginData,
      TPluginSnapshot,
      TArrays,
      TRewardCustom,
      TRewardInput
    >
    const boundSceneCodec = sceneCodec as Parameters<typeof sceneWorld.save>[1]
    const runtime = WizRpgSceneRuntime.define<
      StandardScene<TSceneState, TTypes, TRewardCustom>,
      StandardCommand<TSceneState, TActionInput>,
      StandardEvent<TSceneState, TActionOutput, TPluginEvent, TTypes>,
      WizStandardRejectionReason<TPluginReason, TMechanicsReason>,
      WizStandardActions<TArrays>
    >({
      actions: sceneWorld.actions,
      components,
      capture: (scene) =>
        sceneWorld.save(scene as StandardScene<TSceneState, TTypes, TRewardCustom>, boundSceneCodec)
          .snapshot,
      identity,
      dispatch: (scene, action) => {
        const currentScene = scene as StandardScene<TSceneState, TTypes, TRewardCustom>
        if (action instanceof WizPluginSceneNavigation) {
          const result = sceneWorld.navigate(currentScene, action)
          return result.accepted
            ? {
                accepted: true,
                error: undefined,
                events: result.events,
                state: result.state as WizDeepReadonly<
                  StandardScene<TSceneState, TTypes, TRewardCustom>
                >,
              }
            : {
                accepted: false,
                error: {
                  actionType: action.type,
                  code: "ACTION_REJECTED",
                  reason: result.reason,
                },
                events: [],
                state: result.state as WizDeepReadonly<
                  StandardScene<TSceneState, TTypes, TRewardCustom>
                >,
              }
        }
        return sceneWorld.dispatch(
          currentScene,
          action as WizDeepReadonly<WizStandardAction<TActionInput>> &
            WizStandardAction<TActionInput>,
        )
      },
      initialScene: sceneWorld.initialState,
      ownsAction: (action): action is StandardCommand<TSceneState, TActionInput> =>
        action instanceof WizPluginSceneNavigation || sceneWorld.ownsAction(action),
      restore: (input: unknown) =>
        sceneWorld.restore(
          {
            contentVersion: identity.value,
            schemaVersion: sceneCodec.schemaVersion,
            snapshot: input,
          },
          boundSceneCodec,
        ),
    })

    return WizRpgWorld.fromRuntime(runtime)
  }
}

Object.freeze(WizRpgWorldDefinition.prototype)
Object.freeze(WizRpgWorldDefinition)
