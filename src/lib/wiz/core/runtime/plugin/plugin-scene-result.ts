import type { WizPluginSceneState } from "@/lib/wiz/core/runtime/plugin/plugin-scene"
import {
  type WizSceneAcceptedResultValue,
  type WizSceneRejectedResultValue,
  type WizSceneResult,
  WizSceneResultFactory,
} from "@/lib/wiz/core/runtime/scene-result"
import type { WizSceneTransition } from "@/lib/wiz/core/runtime/scene-transition"
import type { WizState } from "@/lib/wiz/core/runtime/state"

type WizPluginOnlyState<TState extends WizPluginSceneState> = string extends TState["type"]
  ? never
  : [Extract<TState["type"], WizState["type"]>] extends [never]
    ? TState
    : never

export type WizPluginSceneAcceptedResult<
  TState extends WizPluginSceneState,
  TEvent = never,
> = WizSceneAcceptedResultValue<TState, TEvent>

export type WizPluginSceneRejectedResult<
  TState extends WizPluginSceneState,
  TReason extends string = string,
> = WizSceneRejectedResultValue<TState, TReason>

export type WizPluginSceneResult<
  TState extends WizPluginSceneState,
  TEvent = never,
  TReason extends string = string,
> = WizSceneResult<TState, TEvent, TReason>

export class WizPluginSceneResultFactory {
  private constructor() {
    throw new TypeError("WizPluginSceneResultFactory is a static-only factory")
  }

  static accept<
    TState extends WizPluginSceneState,
    const TEvents extends readonly unknown[] = readonly [],
  >(
    state: TState & WizPluginOnlyState<TState>,
    transition?: WizSceneTransition,
    events?: TEvents,
  ): WizPluginSceneAcceptedResult<TState, TEvents[number]> {
    return WizSceneResultFactory.accept<TState, TEvents>(state, transition, events)
  }

  static reject<TState extends WizPluginSceneState, const TReason extends string>(
    state: TState & WizPluginOnlyState<TState>,
    reason: TReason,
  ): WizPluginSceneRejectedResult<TState, TReason> {
    return WizSceneResultFactory.reject<TState, TReason>(state, reason)
  }
}

Object.freeze(WizPluginSceneResultFactory.prototype)
Object.freeze(WizPluginSceneResultFactory)
