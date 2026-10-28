import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import {
  WizWorldSaveCodec,
  type WizWorldSaveEnvelope,
} from "@/lib/wiz/core/save/world-save-codec"
import type { WizStandardSchemaDefinition } from "@/lib/wiz/core/standard-schema"
import {
  assertAuthenticWizWorldStateOwnership,
  WizWorldStateOwnership,
} from "@/lib/wiz/core/world/world"

export type WizWorldStateCodecDefinition<
  TState,
  TInput extends object,
  TOutput extends object = TInput,
> = Readonly<{
  contentVersion: string
  schemaVersion?: number
  /**
   * 構築後に変更しない、信頼済みの純粋なvalidation dependency。
   * codecはStandard Schemaのvalidator参照を構築時に捕捉する。
   */
  schema: WizStandardSchemaDefinition<TInput, TOutput>
  /** immutable stateをJSON-safeなplain dataへ写す純粋関数。 */
  capture: (state: WizDeepReadonly<TState>) => TInput
  /** 検証済みplain dataから新しいimmutable stateを作る純粋関数。 */
  restore: (data: WizDeepReadonly<TOutput>) => TState
  stateOwnership?: WizWorldStateOwnership<TState>
}>

/**
 * 任意RPGのclass stateとJSON saveの対応をまとめる不変codec。
 *
 * schema/content version・JSON-safe検証は`WizWorldSaveCodec`へ委譲し、
 * stateのprototypeは明示的なcapture/restore関数で復元する。
 */
export class WizWorldStateCodec<
  TState,
  TInput extends object,
  TOutput extends object = TInput,
> {
  readonly contentVersion: string
  readonly schemaVersion: number
  readonly capture: (
    state: TState | WizDeepReadonly<TState>
  ) => WizDeepReadonly<TInput>
  readonly encode: (
    state: TState | WizDeepReadonly<TState>
  ) => WizWorldSaveEnvelope<TInput>
  readonly parse: (input: unknown) => WizWorldSaveEnvelope<TOutput>
  readonly restore: (input: unknown) => WizDeepReadonly<TState>

  private readonly dataCodec: WizWorldSaveCodec<TInput, TOutput>
  private readonly captureState: (state: WizDeepReadonly<TState>) => TInput
  private readonly restoreState: (data: WizDeepReadonly<TOutput>) => TState
  private readonly stateOwnership: WizWorldStateOwnership<TState>

  private constructor(
    definition: WizWorldStateCodecDefinition<TState, TInput, TOutput>
  ) {
    this.dataCodec = WizWorldSaveCodec.define({
      contentVersion: definition.contentVersion,
      schemaVersion: definition.schemaVersion,
      schema: definition.schema,
    })
    this.captureState = Object.freeze(definition.capture.bind(undefined))
    this.restoreState = Object.freeze(definition.restore.bind(undefined))
    const stateOwnership =
      definition.stateOwnership ??
      WizWorldStateOwnership.deepImmutable<TState>()
    assertAuthenticWizWorldStateOwnership(stateOwnership)
    this.stateOwnership = stateOwnership
    this.contentVersion = this.dataCodec.contentVersion
    this.schemaVersion = this.dataCodec.schemaVersion
    this.capture = Object.freeze(
      (state: TState | WizDeepReadonly<TState>): WizDeepReadonly<TInput> => {
        const ownedState = this.stateOwnership.own(state)
        return this.dataCodec.encode(this.captureState(ownedState)).snapshot
      }
    )
    this.encode = Object.freeze(
      (
        state: TState | WizDeepReadonly<TState>
      ): WizWorldSaveEnvelope<TInput> => {
        const ownedState = this.stateOwnership.own(state)
        return this.dataCodec.encode(this.captureState(ownedState))
      }
    )
    this.parse = Object.freeze(
      (input: unknown): WizWorldSaveEnvelope<TOutput> =>
        this.dataCodec.parse(input)
    )
    this.restore = Object.freeze((input: unknown): WizDeepReadonly<TState> => {
      const data = this.dataCodec.decodeSnapshot(input)
      return this.stateOwnership.own(this.restoreState(data))
    })
    Object.freeze(this)
  }

  static define<TState, TInput extends object, TOutput extends object = TInput>(
    definition: WizWorldStateCodecDefinition<TState, TInput, TOutput>
  ): WizWorldStateCodec<TState, TInput, TOutput> {
    return new WizWorldStateCodec(definition)
  }
}

Object.freeze(WizWorldStateCodec.prototype)
Object.freeze(WizWorldStateCodec)
