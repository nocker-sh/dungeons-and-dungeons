import type { TargetRequest } from "@/client/components/game/formation/context"
import type { OverlayState } from "@/client/components/game/overlay"
import { modeOf } from "@/client/components/game/mode-of"

export type OverlayAction =
  | { type: "lift"; member: string | null }
  /** 札を押した。delegated は場面が押したときの処理を差し替えているか（戦闘）。 */
  | { type: "pressCard"; member: string; delegated: boolean }
  | { type: "toggleBag" }
  /** 閉じる動きが終わった。 */
  | { type: "bagClosed" }
  | { type: "choose"; request: TargetRequest }
  | { type: "cancelChoosing" }

export type OverlayEffect =
  | { type: "pick"; request: TargetRequest; member: string }
  | { type: "cancel"; request: TargetRequest }
  | { type: "delegate"; member: string }

export type OverlayTransition = {
  state: OverlayState
  effect?: OverlayEffect
}

export function reduceOverlay(
  state: OverlayState,
  action: OverlayAction
): OverlayTransition {
  const mode = state.mode
  switch (action.type) {
    case "lift":
      if (mode.kind !== "free") return { state }
      return { state: { ...state, lifted: action.member } }
    case "pressCard":
      if (mode.kind === "bag") return { state }
      if (mode.kind === "choosing") {
        if (!mode.request.eligible.includes(action.member)) return { state }
        return {
          state: { ...state, mode: modeOf(mode.back) },
          effect: {
            type: "pick",
            request: mode.request,
            member: action.member,
          },
        }
      }
      if (action.delegated)
        return { state, effect: { type: "delegate", member: action.member } }
      return {
        state: {
          ...state,
          lifted: state.lifted === action.member ? null : action.member,
        },
      }
    case "toggleBag":
      if (mode.kind === "free")
        return {
          state: {
            ...state,
            mode: { kind: "bag", closing: false },
            lifted: null,
          },
        }
      if (mode.kind === "bag" && !mode.closing)
        return {
          state: {
            ...state,
            mode: { kind: "bag", closing: true },
            closeRequests: state.closeRequests + 1,
          },
        }
      return { state }
    case "bagClosed":
      if (mode.kind !== "bag") return { state }
      return { state: { ...state, mode: { kind: "free" } } }
    case "choose":
      if (mode.kind === "free")
        return {
          state: {
            ...state,
            mode: { kind: "choosing", request: action.request, back: "free" },
          },
        }
      if (mode.kind === "bag" && !mode.closing)
        return {
          state: {
            ...state,
            mode: { kind: "choosing", request: action.request, back: "bag" },
          },
        }
      return { state }
    case "cancelChoosing":
      if (mode.kind !== "choosing") return { state }
      return {
        state: { ...state, mode: modeOf(mode.back) },
        effect: { type: "cancel", request: mode.request },
      }
  }
}
