import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import type {
  WizStandardPluginSceneCodecContent,
  WizStandardPluginSceneCodecData,
  WizStandardPluginSceneCodecSnapshot,
  WizStandardPluginSceneCodecState,
  WizStandardPluginSceneCodecValue,
  WizStandardPluginSceneSnapshotData,
  WizStandardSessionPluginSceneState,
} from "@/lib/wiz/core/presets/standard-session"
import { WizStandardPluginSceneCodec } from "@/lib/wiz/core/presets/standard-session"
import type { WizPluginSceneAction } from "@/lib/wiz/core/runtime/plugin/plugin-scene"
import {
  type WizPluginSceneRegistryActionInput,
  type WizPluginSceneRegistryActionOutput,
  type WizPluginSceneRegistryEvent,
  type WizPluginSceneRegistryReason,
  type WizPluginSceneRegistryState,
  WizPluginSceneRegistry,
} from "@/lib/wiz/core/runtime/plugin/plugin-scene-registry"

const scenesConstructionToken = Symbol("WizRpgScenes.constructor")
const authenticRpgScenes = new WeakSet<object>()

type CodecState<TCodecs extends readonly unknown[]> = WizStandardPluginSceneCodecState<
  TCodecs[number]
>

type HasExactSceneStates<TRegistry, TCodecs extends readonly unknown[]> = [
  WizPluginSceneRegistryState<TRegistry>,
] extends [CodecState<TCodecs>]
  ? [CodecState<TCodecs>] extends [WizPluginSceneRegistryState<TRegistry>]
    ? true
    : false
  : false

/**
 * 追加sceneのruntime moduleと保存codecを一単位にした不変composition value。
 */
export class WizRpgScenes<
  TState extends WizStandardSessionPluginSceneState,
  TActionInput,
  TActionOutput extends WizPluginSceneAction,
  TEvent,
  TReason extends string,
  TData extends object,
  TSnapshot extends WizStandardPluginSceneSnapshotData<TData>,
  TContent extends WorldContentArrays,
> {
  declare private readonly contentType: (content: TContent) => TContent
  declare private readonly dataType: (data: TData) => TData
  declare private readonly snapshotType: (snapshot: TSnapshot) => TSnapshot
  readonly registry: WizPluginSceneRegistry<TState, TActionInput, TActionOutput, TEvent, TReason>
  readonly codecs: readonly WizStandardPluginSceneCodecValue[]

  private constructor(
    token: symbol,
    registry: WizPluginSceneRegistry<TState, TActionInput, TActionOutput, TEvent, TReason>,
    codecs: readonly WizStandardPluginSceneCodecValue[],
  ) {
    if (token !== scenesConstructionToken) {
      throw new TypeError("WizRpgScenes must be created with define()")
    }
    WizPluginSceneRegistry.require(registry, "RPG scene registry")
    for (const [index, codec] of codecs.entries()) {
      WizStandardPluginSceneCodec.require(codec, `RPG scene codec at index ${index}`)
    }
    const codecTypes = codecs.map((codec) => codec.type)
    const duplicateType = codecTypes.find((type, index) => codecTypes.indexOf(type) !== index)
    if (duplicateType !== undefined) {
      throw new RangeError(`Duplicate RPG scene codec "${duplicateType}"`)
    }
    const compareTypes = (left: string, right: string): number => left.localeCompare(right)
    const registryTypes = [...registry.sceneTypes].sort(compareTypes)
    const sortedCodecTypes = [...codecTypes].sort(compareTypes)
    if (
      registryTypes.length !== sortedCodecTypes.length ||
      registryTypes.some((type, index) => type !== sortedCodecTypes[index])
    ) {
      throw new TypeError("RPG scene modules and codecs must declare the same scene types")
    }
    this.registry = registry
    this.codecs = Object.freeze([...codecs])
    authenticRpgScenes.add(this)
    Object.freeze(this)
  }

  static define<
    TRegistry extends object,
    const TCodecs extends readonly WizStandardPluginSceneCodecValue[],
  >(
    registry: TRegistry,
    codecs: TCodecs,
    ...validation: HasExactSceneStates<TRegistry, TCodecs> extends true ? [] : [never]
  ): WizRpgScenes<
    WizPluginSceneRegistryState<TRegistry>,
    WizPluginSceneRegistryActionInput<TRegistry>,
    WizPluginSceneRegistryActionOutput<TRegistry>,
    WizPluginSceneRegistryEvent<TRegistry>,
    WizPluginSceneRegistryReason<TRegistry>,
    WizStandardPluginSceneCodecData<TCodecs[number]>,
    WizStandardPluginSceneCodecSnapshot<TCodecs[number]>,
    WizStandardPluginSceneCodecContent<TCodecs[number]>
  > {
    void validation
    return new WizRpgScenes<
      WizPluginSceneRegistryState<TRegistry>,
      WizPluginSceneRegistryActionInput<TRegistry>,
      WizPluginSceneRegistryActionOutput<TRegistry>,
      WizPluginSceneRegistryEvent<TRegistry>,
      WizPluginSceneRegistryReason<TRegistry>,
      WizStandardPluginSceneCodecData<TCodecs[number]>,
      WizStandardPluginSceneCodecSnapshot<TCodecs[number]>,
      WizStandardPluginSceneCodecContent<TCodecs[number]>
    >(
      scenesConstructionToken,
      registry as unknown as WizPluginSceneRegistry<
        WizPluginSceneRegistryState<TRegistry>,
        WizPluginSceneRegistryActionInput<TRegistry>,
        WizPluginSceneRegistryActionOutput<TRegistry>,
        WizPluginSceneRegistryEvent<TRegistry>,
        WizPluginSceneRegistryReason<TRegistry>
      >,
      codecs,
    )
  }

  /** @internal standard world composition boundary only. */
  static require(value: unknown, label: string): void {
    if (typeof value !== "object" || value === null || !authenticRpgScenes.has(value)) {
      throw new TypeError(`${label} must be created with WizRpgScenes.define()`)
    }
  }
}

Object.freeze(WizRpgScenes.prototype)
Object.freeze(WizRpgScenes)
